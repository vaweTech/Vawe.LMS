import {
  adminDb,
  getFirestoreRestAccessToken,
  getFirestoreProjectId,
  getIdentityToolkitRestAccessToken,
} from "@/lib/firebaseAdmin";
import admin from "firebase-admin";
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from "zod";
import { getCrtRosterDocPathsToDelete } from "@/lib/crtRosterCleanup";
import { getStudentCollectionSegmentVariants } from "@/lib/studentCollections";

// Input validation schema
const deleteStudentSchema = z
  .object({
    id: z.string().optional(),
    uid: z.string().optional(),
    email: z.string().email().optional(),
    collegeSubdomain: z.string().optional(),
  })
  .refine((data) => data.id || data.uid || data.email, {
    message: "At least one identifier (id, uid, or email) is required",
  });

function getStudentAdminCollections(collegeSubdomain) {
  const collections = [];
  const seen = new Set();
  for (const segs of getStudentCollectionSegmentVariants(collegeSubdomain, collegeSubdomain)) {
    const key = segs.join("/");
    if (seen.has(key)) continue;
    seen.add(key);
    if (segs.length === 1) {
      collections.push(adminDb.collection(segs[0]));
    } else if (segs.length === 3) {
      collections.push(
        adminDb.collection(segs[0]).doc(segs[1]).collection(segs[2])
      );
    }
  }
  return collections;
}

async function tryLoadStudentByDocId(collections, docId) {
  if (!docId) return null;
  for (const col of collections) {
    try {
      const snap = await col.doc(docId).get();
      if (snap.exists) {
        return { docRef: snap.ref, docId: snap.id, data: snap.data() };
      }
    } catch (err) {
      if (!isDecoderError(err) && !isNetworkError(err)) throw err;
    }
  }
  return null;
}

async function tryLoadStudentByField(collections, field, value) {
  if (!value) return null;
  for (const col of collections) {
    try {
      const snap = await col.where(field, "==", value).limit(1).get();
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { docRef: docSnap.ref, docId: docSnap.id, data: docSnap.data() };
      }
    } catch (err) {
      if (!isDecoderError(err) && !isNetworkError(err)) throw err;
    }
  }
  return null;
}

function isDecoderError(error) {
  if (!error) return false;
  const msg = String(error?.message || "");
  return (
    error.code === "ERR_OSSL_UNSUPPORTED" ||
    msg.includes("DECODER routines") ||
    msg.includes("1E08010C")
  );
}

function isNetworkError(error) {
  if (!error) return false;
  const msg = String(error?.message || "");
  const code = error?.code;
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EPIPE" ||
    msg.includes("socket hang up") ||
    msg.includes("ECONNRESET") ||
    msg.includes("firestore.googleapis.com")
  );
}

function convertFirestoreRestValue(value) {
  if (!value || typeof value !== "object") return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return Boolean(value.booleanValue);
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue !== undefined) {
    const obj = {};
    const fields = value.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      obj[key] = convertFirestoreRestValue(fields[key]);
    }
    return obj;
  }
  if (value.arrayValue !== undefined) {
    const arr = value.arrayValue.values || [];
    return arr.map(convertFirestoreRestValue);
  }
  if (value.referenceValue !== undefined) return value.referenceValue;
  return undefined;
}

function firestoreRestDocToObject(doc) {
  const obj = {};
  const fields = doc?.fields || {};
  for (const key of Object.keys(fields)) {
    obj[key] = convertFirestoreRestValue(fields[key]);
  }
  return obj;
}

async function getFirestoreRestClient() {
  const accessToken = await getFirestoreRestAccessToken();
  const projectId = getFirestoreProjectId();
  if (!accessToken || !projectId) {
    throw new Error(
      "Service account credentials are required. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT."
    );
  }
  return { accessToken, projectId };
}

async function getIdentityToolkitClient() {
  const accessToken = await getIdentityToolkitRestAccessToken();
  const projectId = getFirestoreProjectId();
  if (!accessToken || !projectId) {
    throw new Error(
      "Service account credentials are required. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT."
    );
  }
  return { accessToken, projectId };
}

async function fetchStudentDocViaRest(docId, client) {
  if (!docId) return null;
  const auth = client || (await getFirestoreRestClient());
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/students/${docId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    let errMsg = `Firestore REST API error (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      errMsg = errData?.error?.message || errData?.error || await res.text().catch(() => errMsg);
    } catch {
      // Use default error message
    }
    throw new Error(errMsg);
  }
  const doc = await res.json();
  return {
    docId: doc.name?.split("/").pop(),
    data: firestoreRestDocToObject(doc),
    preferRest: true,
  };
}

async function queryStudentDocViaRest(fieldPath, value, client) {
  if (!value) return null;
  const auth = client || (await getFirestoreRestClient());
  const body = {
    structuredQuery: {
      from: [{ collectionId: "students" }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: "EQUAL",
          value: { stringValue: value },
        },
      },
      limit: 1,
    },
  };
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errMsg = `Firestore query REST API error (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      errMsg = errData?.error?.message || errData?.error || await res.text().catch(() => errMsg);
    } catch {
      // Use default error message
    }
    throw new Error(errMsg);
  }
  const rows = await res.json();
  const doc = rows.find((row) => row.document)?.document;
  if (!doc) return null;
  return {
    docId: doc.name?.split("/").pop(),
    data: firestoreRestDocToObject(doc),
    preferRest: true,
  };
}

async function deletePaymentsViaRest(docId, client) {
  const auth = client || (await getFirestoreRestClient());
  const listUrl = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/students/${docId}/payments`;
  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    let errMsg = `Firestore REST API error (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      errMsg = errData?.error?.message || errData?.error || await res.text().catch(() => errMsg);
    } catch {
      // Use default error message
    }
    throw new Error(errMsg);
  }
  const data = await res.json();
  const docs = data.documents || [];
  await Promise.all(
    docs.map((document) =>
      fetch(document.name, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
    )
  );
}

async function deleteFirestoreDocViaRest(docId, client) {
  return deleteFirestorePathViaRest(`students/${docId}`, client);
}

async function deleteFirestorePathViaRest(docPath, client) {
  const auth = client || (await getFirestoreRestClient());
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/${docPath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    let errMsg = `Firestore delete REST API error (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      errMsg = errData?.error?.message || errData?.error || await res.text().catch(() => errMsg);
    } catch {
      // Use default error message
    }
    throw new Error(errMsg);
  }
}

async function deleteCrtRosterEntries({
  studentData,
  docId,
  uid,
  requestCollegeSubdomain,
  preferRest,
  ensureFirestoreClient,
}) {
  const rosterPaths = getCrtRosterDocPathsToDelete({
    uid,
    docId,
    collegeSubdomain: studentData?.collegeSubdomain || null,
    requestCollegeSubdomain: requestCollegeSubdomain || null,
  });

  for (const rosterPath of rosterPaths) {
    try {
      if (!preferRest) {
        await adminDb.doc(rosterPath).delete();
      } else {
        await deleteFirestorePathViaRest(rosterPath, await ensureFirestoreClient());
      }
    } catch (err) {
      if (isDecoderError(err) || isNetworkError(err)) {
        try {
          await deleteFirestorePathViaRest(rosterPath, await ensureFirestoreClient());
        } catch (restErr) {
          console.warn(`CRT roster delete failed for ${rosterPath}:`, restErr?.message || restErr);
        }
      } else if (err?.code !== 5 && err?.code !== "not-found") {
        console.warn(`CRT roster delete failed for ${rosterPath}:`, err?.message || err);
      }
    }
  }
}

async function deleteAuthUserViaRest(uid, client) {
  const auth =
    client || (await getIdentityToolkitClient());
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${auth.projectId}/accounts:delete`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ localId: uid }),
  });
  if (!res.ok) {
    let errMsg = `Identity Toolkit REST API error (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      errMsg = errData?.error?.message || errData?.error || await res.text().catch(() => errMsg);
    } catch {
      // Use default error message
    }
    throw new Error(errMsg);
  }
}

function normalizeEmail(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plusIndex = local.indexOf("+");
    const withoutPlus = plusIndex === -1 ? local : local.slice(0, plusIndex);
    const withoutDots = withoutPlus.replace(/\./g, "");
    return `${withoutDots}@gmail.com`;
  }
  return `${local}@${domain}`;
}

async function deleteOrphanStudentDocs({
  collections,
  uid,
  email,
  preferRest,
  ensureFirestoreClient,
}) {
  const deletedIds = [];
  const normalizedEmail = email ? normalizeEmail(email) : null;

  for (const col of collections) {
    const queries = [];
    if (uid) queries.push(col.where("uid", "==", uid).limit(10).get());
    if (normalizedEmail) {
      queries.push(col.where("emailNormalized", "==", normalizedEmail).limit(10).get());
      queries.push(col.where("email", "==", email.trim().toLowerCase()).limit(10).get());
    }
    const snaps = await Promise.all(queries);
    for (const snap of snaps) {
      for (const docSnap of snap.docs) {
        const currentId = docSnap.id;
        try {
          if (!preferRest) {
            const paymentsRef = docSnap.ref.collection("payments");
            const paymentsSnap = await paymentsRef.get();
            const batch = adminDb.batch();
            paymentsSnap.forEach((p) => batch.delete(p.ref));
            await batch.commit();
            await docSnap.ref.delete();
          } else {
            await deletePaymentsViaRest(currentId, await ensureFirestoreClient());
            await deleteFirestoreDocViaRest(currentId, await ensureFirestoreClient());
          }
          deletedIds.push(currentId);
        } catch (err) {
          console.warn(`Failed to delete orphan student doc ${currentId}:`, err);
        }
      }
    }
  }

  return deletedIds;
}

async function deleteStudentHandler(request) {
  try {
    const {
      id,
      uid: uidFromClient,
      email: emailFromClient,
      collegeSubdomain: collegeSubdomainFromBody,
    } = request.validatedBody;

    const lookupSubdomain =
      collegeSubdomainFromBody || request.user?.collegeSubdomain || null;
    const studentCollections = getStudentAdminCollections(lookupSubdomain);

    let docId = id || null;
    let docRef = null;
    let studentData = null;
    let preferRest = false;

    let firestoreClient = null;
    const ensureFirestoreClient = async () => {
      if (!firestoreClient) {
        firestoreClient = await getFirestoreRestClient();
      }
      return firestoreClient;
    };

    let identityClient = null;
    const ensureIdentityClient = async () => {
      if (!identityClient) {
        identityClient = await getIdentityToolkitClient();
      }
      return identityClient;
    };

    const applyLoaded = (loaded) => {
      if (!loaded) return;
      docRef = loaded.docRef;
      docId = loaded.docId;
      studentData = loaded.data;
    };

    if (docId) {
      try {
        applyLoaded(await tryLoadStudentByDocId(studentCollections, docId));
      } catch (err) {
        if (!isDecoderError(err) && !isNetworkError(err)) throw err;
        preferRest = true;
        const restDoc = await fetchStudentDocViaRest(docId, await ensureFirestoreClient());
        if (restDoc) {
          studentData = restDoc.data;
          docId = restDoc.docId;
          docRef = null;
        }
      }
    }

    if (!studentData && uidFromClient) {
      try {
        applyLoaded(
          await tryLoadStudentByField(studentCollections, "uid", uidFromClient)
        );
      } catch (err) {
        if (!isDecoderError(err) && !isNetworkError(err)) throw err;
        preferRest = true;
        const restDoc = await queryStudentDocViaRest(
          "uid",
          uidFromClient,
          await ensureFirestoreClient()
        );
        if (restDoc) {
          docId = restDoc.docId;
          studentData = restDoc.data;
          docRef = null;
        }
      }
    }

    if (!studentData && emailFromClient) {
      const normalized = normalizeEmail(emailFromClient);
      try {
        applyLoaded(
          await tryLoadStudentByField(
            studentCollections,
            "emailNormalized",
            normalized
          )
        );
        if (!studentData) {
          applyLoaded(
            await tryLoadStudentByField(
              studentCollections,
              "email",
              emailFromClient.trim().toLowerCase()
            )
          );
        }
      } catch (err) {
        if (!isDecoderError(err) && !isNetworkError(err)) throw err;
        preferRest = true;
        const restDoc =
          (await queryStudentDocViaRest(
            "emailNormalized",
            normalized,
            await ensureFirestoreClient()
          )) ||
          (await queryStudentDocViaRest(
            "email",
            emailFromClient.trim().toLowerCase(),
            await ensureFirestoreClient()
          ));
        if (restDoc) {
          docId = restDoc.docId;
          studentData = restDoc.data;
          docRef = null;
        }
      }
    }

    if (!studentData) {
      const rosterUid = uidFromClient || id || null;
      if (!rosterUid && !emailFromClient) {
        return new Response(
          JSON.stringify({ error: "Student not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const uid = rosterUid;
      await deleteCrtRosterEntries({
        studentData: {
          collegeSubdomain: lookupSubdomain || "",
          email: emailFromClient || "",
        },
        docId: id || null,
        uid,
        requestCollegeSubdomain: lookupSubdomain,
        preferRest,
        ensureFirestoreClient,
      });

      if (uid) {
        try {
          await admin.auth().deleteUser(uid);
        } catch (authErr) {
          if (authErr?.code !== "auth/user-not-found") {
            if (isDecoderError(authErr)) {
              await deleteAuthUserViaRest(uid, await ensureIdentityClient());
            } else {
              console.warn("Failed to delete auth user:", authErr);
            }
          }
        }
      } else if (emailFromClient) {
        try {
          const userRecord = await admin.auth().getUserByEmail(
            emailFromClient.trim().toLowerCase()
          );
          await admin.auth().deleteUser(userRecord.uid);
        } catch (authErr) {
          if (authErr?.code !== "auth/user-not-found") {
            console.warn("Failed to delete auth user by email:", authErr);
          }
        }
      }

      const orphanDeletedIds = await deleteOrphanStudentDocs({
        collections: studentCollections,
        uid,
        email: emailFromClient,
        preferRest,
        ensureFirestoreClient,
      });

      return new Response(
        JSON.stringify({
          success: true,
          deletedId: id || orphanDeletedIds[0] || null,
          deletedUid: uid || null,
          deletedBy: request.user.email,
          note:
            orphanDeletedIds.length > 0
              ? "CRT roster, auth, and student docs removed"
              : "CRT roster / auth removed (no main students doc)",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const uid = studentData?.uid || uidFromClient || null;

    await deleteCrtRosterEntries({
      studentData,
      docId,
      uid,
      requestCollegeSubdomain: lookupSubdomain,
      preferRest,
      ensureFirestoreClient,
    });

    if (uid) {
      try {
        await admin.auth().deleteUser(uid);
      } catch (authErr) {
        if (authErr?.code === "auth/user-not-found") {
          // Already removed
        } else if (isDecoderError(authErr)) {
          try {
            await deleteAuthUserViaRest(uid, await ensureIdentityClient());
            preferRest = true;
          } catch (restAuthErr) {
            console.error("REST auth delete fallback failed:", restAuthErr?.message || restAuthErr);
            throw new Error("Failed to delete Firebase Auth user due to OpenSSL compatibility issue. REST fallback also failed.");
          }
        } else {
          console.warn("Failed to delete auth user:", authErr);
        }
      }
    }

    try {
      if (!preferRest && docRef) {
        const paymentsRef = docRef.collection("payments");
        const paymentsSnap = await paymentsRef.get();
        const batch = adminDb.batch();
        paymentsSnap.forEach((p) => batch.delete(p.ref));
        await batch.commit();
      } else {
        await deletePaymentsViaRest(docId, await ensureFirestoreClient());
      }
    } catch (subErr) {
      if (isNetworkError(subErr) && docId) {
        try {
          await deletePaymentsViaRest(docId, await ensureFirestoreClient());
        } catch (restSubErr) {
          console.warn("REST delete payments fallback failed:", restSubErr);
        }
      } else {
        console.warn("Failed to delete payments subcollection:", subErr);
      }
    }

    try {
      if (!preferRest && docRef) {
        await docRef.delete();
      } else {
        await deleteFirestoreDocViaRest(docId, await ensureFirestoreClient());
        preferRest = true;
      }
    } catch (fsDeleteErr) {
      if ((isDecoderError(fsDeleteErr) || isNetworkError(fsDeleteErr)) && docId) {
        preferRest = true;
        await deleteFirestoreDocViaRest(docId, await ensureFirestoreClient());
      } else {
        throw fsDeleteErr;
      }
    }

    console.log(
      `Student deleted by ${request.user.email}: ${docId || uid || emailFromClient}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        deletedId: docId || id || null,
        deletedUid: uid || null,
        deletedBy: request.user.email,
        note: preferRest ? "Deleted via REST fallback" : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Delete student error:", e);
    // Ensure error message is safe for JSON
    const errorMessage = String(e?.message || "Failed to delete student").replace(/[\x00-\x1F\x7F]/g, "");
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Apply security middleware: Admin auth + Rate limiting + Input validation
export async function POST(request) {
  try {
    const response = await withAdminAuth(request, (req1) =>
      withRateLimit(30, 15 * 60 * 1000)(req1, (req2) =>
        validateInput(deleteStudentSchema)(req2, deleteStudentHandler)
      )
    );
    
    // Ensure response is always valid JSON
    if (response instanceof Response) {
      return response;
    }
    
    // If middleware returned something unexpected, wrap it
    return new Response(
      JSON.stringify({ error: "Unexpected response format" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Catch any unhandled errors from middleware chain
    console.error("Unhandled error in delete-student route:", error);
    const errorMessage = String(error?.message || "Internal server error").replace(/[\x00-\x1F\x7F]/g, "");
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}