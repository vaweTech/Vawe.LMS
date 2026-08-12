import { getCrtRosterDocPathsToDelete } from "@/lib/crtRosterCleanup";
import { getStudentCollectionSegmentVariants } from "@/lib/studentCollections";

function uniqueCollectionPaths(collegeSubdomain, requestCollegeSubdomain) {
  return getStudentCollectionSegmentVariants(
    collegeSubdomain,
    requestCollegeSubdomain
  );
}

async function collectStudentDocRefs({
  db,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  collegeSubdomain,
  requestCollegeSubdomain,
  studentDocId,
  studentId,
  uid,
  email,
}) {
  const refs = new Map();
  const tryIds = [...new Set([studentDocId, studentId, uid].filter(Boolean))];
  const collectionPaths = uniqueCollectionPaths(
    collegeSubdomain,
    requestCollegeSubdomain
  );

  for (const segs of collectionPaths) {
    for (const tryId of tryIds) {
      const ref = doc(db, ...segs, tryId);
      const snap = await getDoc(ref);
      if (snap.exists()) refs.set(ref.path, ref);
    }

    if (!query || !where) continue;

    const base = collection(db, ...segs);
    if (uid) {
      const snap = await getDocs(query(base, where("uid", "==", uid)));
      snap.docs.forEach((d) => refs.set(d.ref.path, d.ref));
    }
    if (email) {
      const normalized = String(email).trim().toLowerCase();
      const snap = await getDocs(query(base, where("email", "==", email)));
      snap.docs.forEach((d) => refs.set(d.ref.path, d.ref));
      if (normalized !== email) {
        const snap2 = await getDocs(
          query(base, where("email", "==", normalized))
        );
        snap2.docs.forEach((d) => refs.set(d.ref.path, d.ref));
      }
    }
  }

  return [...refs.values()];
}

export function shouldUseClientDeleteFallback(message = "") {
  const text = String(message);
  return (
    /DECODER|OpenSSL|1E08010C/i.test(text) ||
    /socket hang up|ECONNRESET|ETIMEDOUT|firestore\.googleapis\.com/i.test(text) ||
    /Service account credentials are required/i.test(text) ||
    /serviceAccountKey\.json/i.test(text) ||
    /FIREBASE_SERVICE_ACCOUNT/i.test(text) ||
    /ENOENT.*serviceAccountKey/i.test(text) ||
    /Student not found/i.test(text)
  );
}

export function getDeleteStudentFallbackReason(message = "") {
  const text = String(message);
  if (
    /Service account credentials are required/i.test(text) ||
    /serviceAccountKey\.json/i.test(text) ||
    /FIREBASE_SERVICE_ACCOUNT/i.test(text)
  ) {
    return "Firebase Admin credentials are not configured on this server (common on localhost)";
  }
  if (/DECODER|OpenSSL|1E08010C/i.test(text)) {
    return "Windows OpenSSL compatibility issue";
  }
  if (/socket hang up|ECONNRESET|ETIMEDOUT/i.test(text)) {
    return "a temporary connection issue to the server";
  }
  return "a server-side error";
}

/**
 * Delete student Firestore data from the browser (roster + payments + student doc).
 * Does not remove Firebase Auth — that requires the admin API in production.
 */
export async function deleteStudentRecordsClient({
  db,
  doc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  writeBatch,
  query,
  where,
  studentId,
  studentDocId,
  uid,
  email,
  collegeSubdomain,
  requestCollegeSubdomain,
}) {
  const authUid = uid || null;
  const rosterIds = [...new Set([studentDocId, studentId, authUid].filter(Boolean))];

  const rosterPaths = getCrtRosterDocPathsToDelete({
    uid: authUid,
    docId: studentDocId || studentId || null,
    collegeSubdomain: collegeSubdomain || null,
    requestCollegeSubdomain: requestCollegeSubdomain || null,
  });

  await Promise.all(
    rosterPaths.map((path) => deleteDoc(doc(db, path)).catch(() => {}))
  );

  const studentRefs = await collectStudentDocRefs({
    db,
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    collegeSubdomain,
    requestCollegeSubdomain,
    studentDocId,
    studentId,
    uid: authUid,
    email,
  });

  for (const studentDocRef of studentRefs) {
    const paymentsSnap = await getDocs(collection(studentDocRef, "payments"));
    if (!paymentsSnap.empty) {
      const batch = writeBatch(db);
      paymentsSnap.forEach((paymentDoc) => batch.delete(paymentDoc.ref));
      await batch.commit();
    }
    await deleteDoc(studentDocRef);
  }

  // CRT admission mirror: students/crtstudent/admission/{docId}
  for (const tryId of rosterIds) {
    try {
      await deleteDoc(doc(db, "students", "crtstudent", "admission", tryId));
    } catch {
      // ignore missing admission docs
    }
  }

  if (!studentRefs.length && !rosterPaths.length) {
    throw new Error("Student record not found in Firestore.");
  }

  return {
    deletedStudentDocs: studentRefs.length,
    deletedRosterPaths: rosterPaths.length,
  };
}

/**
 * Delete a student: Firestore-only on localhost; Admin API on production (Vercel).
 * @returns {{ success: boolean, cancelled?: boolean, message?: string, mode?: string }}
 */
export async function executeStudentDelete({
  firestore,
  student,
  studentId,
  collegeSubdomain,
  requestCollegeSubdomain,
  makeAuthenticatedRequest,
  onRefresh,
}) {
  const firestoreDocId = student?.studentDocId || null;
  const rosterUid = student?.uid || null;
  const rowId = studentId || student?.id || null;
  const apiDocId = firestoreDocId || rowId;

  if (!apiDocId && !rosterUid && !student?.email) {
    throw new Error("Student id is required.");
  }

  const runClientDelete = async () => {
    await deleteStudentRecordsClient({
      ...firestore,
      studentId: rowId,
      studentDocId: firestoreDocId,
      uid: rosterUid || rowId,
      email: student?.email || null,
      collegeSubdomain:
        student?.collegeSubdomain || collegeSubdomain || null,
      requestCollegeSubdomain:
        requestCollegeSubdomain || collegeSubdomain || null,
    });
    await onRefresh?.();
  };

  try {
    const res = await makeAuthenticatedRequest("/api/delete-student", {
      method: "POST",
      body: JSON.stringify({
        id: apiDocId || undefined,
        uid: rosterUid || rowId || undefined,
        email: student?.email || undefined,
        collegeSubdomain:
          student?.collegeSubdomain || collegeSubdomain || undefined,
      }),
    });

    if (res.status >= 200 && res.status < 300) {
      await onRefresh?.();
      return {
        success: true,
        mode: "api",
        message: "Student deleted successfully (Firestore + login access).",
      };
    }

    let errorMessage = `Failed to delete student (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) errorMessage = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  } catch (error) {
    const message = String(error?.message || "");

    const canFallback =
      shouldUseClientDeleteFallback(message) ||
      /Student not found/i.test(message);

    if (!canFallback) {
      throw error;
    }

    const reason = getDeleteStudentFallbackReason(message);
    const proceed = confirm(
      `Full delete failed (${reason}).\n\nRemove Firestore records only? Firebase login will remain until service account is configured.`
    );
    if (!proceed) {
      return { success: false, cancelled: true };
    }

    await runClientDelete();
    return {
      success: true,
      mode: "client-fallback",
      message:
        "Firestore records removed. Add FIREBASE_SERVICE_ACCOUNT_BASE64 to delete Firebase login too.",
    };
  }
}
