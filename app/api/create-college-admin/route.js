import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/apiAuth";
import admin, { adminDb, writeDocumentViaRest, writeDocumentPathViaRest } from "@/lib/firebaseAdmin";

const COLLEGE_HOSTS_COLLECTION = "collegeHosts";
const COLLEGE_TENANTS_COLLECTION = "collegeTenants";
/** Full college-admin profile: users/{uid}/details/profile */
const USER_DETAILS_SUBCOLLECTION = "details";
const USER_DETAILS_DOC_ID = "profile";
const DEFAULT_PASSWORD = "VaweCollegeAdmin@2026";
const USER_COLLECTION = "users";

function parseOptionalLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function normalizeSubdomain(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const isRetryableError = (e) => {
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`;
  return (
    /socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|fetch failed|network|UND_ERR|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(
      msg
    ) ||
    e?.code === "ECONNRESET" ||
    e?.code === "ETIMEDOUT" ||
    e?.code === "UNAVAILABLE" ||
    e?.code === 14
  );
};

async function withRetry(fn, maxAttempts = 6) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableError(e)) {
        const delayMs = [800, 1500, 3000, 5000, 7000][attempt - 1] || 8000;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function POST(req) {
  return withAdminAuth(req, async (authReq) => {
    try {
      const body = await authReq.json();
      const name = String(body.name || "").trim();
      const subdomain = normalizeSubdomain(body.subdomain);
      const email = String(body.email || "").trim().toLowerCase();
      const rootDomain = String(body.rootDomain || "skillwins.in").trim() || "skillwins.in";
      const host = subdomain ? `${subdomain}.${rootDomain}` : "";
      const passwordRaw = String(body.password || "").trim();
      const password = passwordRaw || DEFAULT_PASSWORD;
      const moduleLms = !!body.moduleLms;
      const moduleCrt = !!body.moduleCrt;
      const studentLimit = parseOptionalLimit(body.studentLimit);
      const crtStudentLimit = parseOptionalLimit(body.crtStudentLimit);

      if (!name || !subdomain || !host) {
        return NextResponse.json(
          { error: "name, subdomain, and a valid host are required" },
          { status: 400 }
        );
      }
      if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
      }
      if (!moduleLms && !moduleCrt) {
        return NextResponse.json(
          { error: "Select at least one module: LMS and/or CRT" },
          { status: 400 }
        );
      }

      let userRecord;
      try {
        userRecord = await admin.auth().createUser({
          email,
          password,
          displayName: name,
        });
      } catch (e) {
        if (e?.code === "auth/email-already-exists") {
          return NextResponse.json(
            {
              error:
                "This email already has an account. Use a different email or delete the existing Auth user first.",
            },
            { status: 409 }
          );
        }
        throw e;
      }

      const uid = userRecord.uid;
      const ts = admin.firestore.FieldValue.serverTimestamp();

      /** Minimal fields on users/{uid} for existing auth / AdminAccess reads */
      const userRootDoc = {
        role: "collegeAdmin",
        collegeSubdomain: subdomain,
        collegeAdminPassword: password,
        moduleLms,
        moduleCrt,
        studentLimit,
        crtStudentLimit,
        platformEmpty: true,
        status: "active",
        locked: false,
        createdAt: ts,
        createdBySuperAdminUid: authReq.user.uid,
      };

      /** Full profile at users/{uid}/details/profile */
      const userDetailsDoc = {
        name,
        email,
        role: "collegeAdmin",
        collegeSubdomain: subdomain,
        collegeAdminPassword: password,
        subdomain,
        host,
        moduleLms,
        moduleCrt,
        studentLimit,
        crtStudentLimit,
        platformEmpty: true,
        status: "active",
        locked: false,
        collegeAdminUid: uid,
        createdAt: ts,
        createdBySuperAdminUid: authReq.user.uid,
      };

      const collegeDoc = {
        name,
        subdomain,
        host,
        collegeAdminUid: uid,
        collegeAdminEmail: email,
        collegeAdminPassword: password,
        moduleLms,
        moduleCrt,
        studentLimit,
        crtStudentLimit,
        platformEmpty: true,
        status: "active",
        locked: false,
        emptyLms: moduleLms,
        emptyCrt: moduleCrt,
        updatedAt: ts,
      };

      const tenantDoc = {
        ...collegeDoc,
        createdAt: ts,
      };

      const detailsPath = `users/${uid}/${USER_DETAILS_SUBCOLLECTION}/${USER_DETAILS_DOC_ID}`;

      try {
        await withRetry(() => adminDb.collection("users").doc(uid).set(userRootDoc, { merge: true }));
        await withRetry(() =>
          adminDb.collection("users").doc(uid).collection(USER_DETAILS_SUBCOLLECTION).doc(USER_DETAILS_DOC_ID).set(userDetailsDoc, { merge: true })
        );
        await withRetry(() =>
          adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain).set(collegeDoc, { merge: true })
        );
        await withRetry(() =>
          adminDb.collection(COLLEGE_TENANTS_COLLECTION).doc(subdomain).set(tenantDoc, { merge: true })
        );
      } catch (firestoreError) {
        if (!isRetryableError(firestoreError)) throw firestoreError;
        console.warn(
          "create-college-admin: Firestore SDK failed, trying REST fallback…",
          firestoreError.message
        );
        const now = new Date();
        await writeDocumentViaRest("users", uid, {
          role: "collegeAdmin",
          collegeSubdomain: subdomain,
          collegeAdminPassword: password,
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          createdAt: now,
          createdBySuperAdminUid: authReq.user.uid,
        });
        await writeDocumentPathViaRest(detailsPath, {
          name,
          email,
          role: "collegeAdmin",
          collegeSubdomain: subdomain,
          collegeAdminPassword: password,
          subdomain,
          host,
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          collegeAdminUid: uid,
          createdAt: now,
          createdBySuperAdminUid: authReq.user.uid,
        });
        await writeDocumentViaRest(COLLEGE_HOSTS_COLLECTION, subdomain, {
          name,
          subdomain,
          host,
          collegeAdminUid: uid,
          collegeAdminEmail: email,
          collegeAdminPassword: password,
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          emptyLms: moduleLms,
          emptyCrt: moduleCrt,
          updatedAt: now,
        });
        await writeDocumentViaRest(COLLEGE_TENANTS_COLLECTION, subdomain, {
          name,
          subdomain,
          host,
          collegeAdminUid: uid,
          collegeAdminEmail: email,
          collegeAdminPassword: password,
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          emptyLms: moduleLms,
          emptyCrt: moduleCrt,
          createdAt: now,
          updatedAt: now,
        });
      }

      return NextResponse.json({
        ok: true,
        uid,
        host,
        defaultPasswordUsed: !passwordRaw,
        initialPassword: !passwordRaw ? password : undefined,
      });
    } catch (e) {
      console.error("create-college-admin", e);
      return NextResponse.json(
        { error: e?.message || "Failed to create college admin" },
        { status: 500 }
      );
    }
  });
}

export async function PATCH(req) {
  return withAdminAuth(req, async (authReq) => {
    try {
      const body = await authReq.json();
      const name = String(body.name || "").trim();
      const subdomain = normalizeSubdomain(body.subdomain);
      const email = String(body.email || "").trim().toLowerCase();
      const rootDomain = String(body.rootDomain || "skillwins.in").trim() || "skillwins.in";
      const host = subdomain ? `${subdomain}.${rootDomain}` : "";
      const passwordRaw = String(body.password || "").trim();
      const moduleLms = !!body.moduleLms;
      const moduleCrt = !!body.moduleCrt;
      const studentLimit = parseOptionalLimit(body.studentLimit);
      const crtStudentLimit = parseOptionalLimit(body.crtStudentLimit);

      if (!name || !subdomain || !host) {
        return NextResponse.json(
          { error: "name, subdomain, and a valid host are required" },
          { status: 400 }
        );
      }
      if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
      }
      if (!moduleLms && !moduleCrt) {
        return NextResponse.json(
          { error: "Select at least one module: LMS and/or CRT" },
          { status: 400 }
        );
      }

      const collegeRef = adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain);
      const collegeSnap = await withRetry(() => collegeRef.get());
      if (!collegeSnap.exists) {
        return NextResponse.json({ error: "College not found for this subdomain." }, { status: 404 });
      }
      const collegeData = collegeSnap.data() || {};
      const uid = String(collegeData.collegeAdminUid || "").trim();
      if (!uid) {
        return NextResponse.json({ error: "College admin UID missing for this college." }, { status: 400 });
      }

      const authUpdate = { email, displayName: name };
      if (passwordRaw) authUpdate.password = passwordRaw;
      try {
        await admin.auth().updateUser(uid, authUpdate);
      } catch (e) {
        if (e?.code === "auth/email-already-exists") {
          return NextResponse.json(
            { error: "This email already has another account. Use a different email." },
            { status: 409 }
          );
        }
        throw e;
      }

      const ts = admin.firestore.FieldValue.serverTimestamp();
      const now = new Date();
      const detailsPath = `users/${uid}/${USER_DETAILS_SUBCOLLECTION}/${USER_DETAILS_DOC_ID}`;

      const userRootDoc = {
        role: "collegeAdmin",
        collegeSubdomain: subdomain,
        ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
        moduleLms,
        moduleCrt,
        studentLimit,
        crtStudentLimit,
        platformEmpty: true,
        status: "active",
        locked: false,
        updatedAt: ts,
        updatedBySuperAdminUid: authReq.user.uid,
      };

      const userDetailsDoc = {
        name,
        email,
        role: "collegeAdmin",
        collegeSubdomain: subdomain,
        ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
        subdomain,
        host,
        moduleLms,
        moduleCrt,
        studentLimit,
        crtStudentLimit,
        platformEmpty: true,
        status: "active",
        locked: false,
        collegeAdminUid: uid,
        updatedAt: ts,
        updatedBySuperAdminUid: authReq.user.uid,
      };

      const collegeDoc = {
        name,
        subdomain,
        host,
        collegeAdminUid: uid,
        collegeAdminEmail: email,
        ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
        moduleLms,
        moduleCrt,
        studentLimit,
        crtStudentLimit,
        platformEmpty: true,
        status: "active",
        locked: false,
        emptyLms: moduleLms,
        emptyCrt: moduleCrt,
        updatedAt: ts,
      };

      const tenantDoc = { ...collegeDoc };

      try {
        await withRetry(() => adminDb.collection("users").doc(uid).set(userRootDoc, { merge: true }));
        await withRetry(() =>
          adminDb
            .collection("users")
            .doc(uid)
            .collection(USER_DETAILS_SUBCOLLECTION)
            .doc(USER_DETAILS_DOC_ID)
            .set(userDetailsDoc, { merge: true })
        );
        await withRetry(() => adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain).set(collegeDoc, { merge: true }));
        await withRetry(() =>
          adminDb.collection(COLLEGE_TENANTS_COLLECTION).doc(subdomain).set(tenantDoc, { merge: true })
        );
      } catch (firestoreError) {
        if (!isRetryableError(firestoreError)) throw firestoreError;
        console.warn(
          "update-college-admin: Firestore SDK failed, trying REST fallback…",
          firestoreError.message
        );

        await writeDocumentViaRest("users", uid, {
          role: "collegeAdmin",
          collegeSubdomain: subdomain,
          ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          updatedAt: now,
          updatedBySuperAdminUid: authReq.user.uid,
        });
        await writeDocumentPathViaRest(detailsPath, {
          name,
          email,
          role: "collegeAdmin",
          collegeSubdomain: subdomain,
          ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
          subdomain,
          host,
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          collegeAdminUid: uid,
          updatedAt: now,
          updatedBySuperAdminUid: authReq.user.uid,
        });
        await writeDocumentViaRest(COLLEGE_HOSTS_COLLECTION, subdomain, {
          name,
          subdomain,
          host,
          collegeAdminUid: uid,
          collegeAdminEmail: email,
          ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          emptyLms: moduleLms,
          emptyCrt: moduleCrt,
          updatedAt: now,
        });
        await writeDocumentViaRest(COLLEGE_TENANTS_COLLECTION, subdomain, {
          name,
          subdomain,
          host,
          collegeAdminUid: uid,
          collegeAdminEmail: email,
          ...(passwordRaw ? { collegeAdminPassword: passwordRaw } : {}),
          moduleLms,
          moduleCrt,
          studentLimit,
          crtStudentLimit,
          platformEmpty: true,
          status: "active",
          locked: false,
          emptyLms: moduleLms,
          emptyCrt: moduleCrt,
          updatedAt: now,
        });
      }

      return NextResponse.json({
        ok: true,
        uid,
        host,
        passwordUpdated: !!passwordRaw,
      });
    } catch (e) {
      console.error("update-college-admin", e);
      return NextResponse.json(
        { error: e?.message || "Failed to update college admin" },
        { status: 500 }
      );
    }
  });
}

export async function PUT(req) {
  return withAdminAuth(req, async (authReq) => {
    try {
      const body = await authReq.json();
      const subdomain = normalizeSubdomain(body.subdomain);
      const locked = !!body.locked;

      if (!subdomain) {
        return NextResponse.json({ error: "subdomain is required" }, { status: 400 });
      }

      const collegeRef = adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain);
      const collegeSnap = await withRetry(() => collegeRef.get());
      if (!collegeSnap.exists) {
        return NextResponse.json({ error: "College not found." }, { status: 404 });
      }
      const collegeData = collegeSnap.data() || {};
      const uid = String(collegeData.collegeAdminUid || "").trim();
      if (!uid) {
        return NextResponse.json({ error: "College admin UID missing." }, { status: 400 });
      }

      await admin.auth().updateUser(uid, { disabled: locked });
      const ts = admin.firestore.FieldValue.serverTimestamp();
      const now = new Date();
      const status = locked ? "locked" : "active";
      const detailsPath = `users/${uid}/${USER_DETAILS_SUBCOLLECTION}/${USER_DETAILS_DOC_ID}`;
      const statusDoc = {
        status,
        locked: locked,
        updatedAt: ts,
        updatedBySuperAdminUid: authReq.user.uid,
      };

      try {
        await withRetry(() =>
          adminDb.collection(USER_COLLECTION).doc(uid).set(statusDoc, { merge: true })
        );
        await withRetry(() =>
          adminDb
            .collection(USER_COLLECTION)
            .doc(uid)
            .collection(USER_DETAILS_SUBCOLLECTION)
            .doc(USER_DETAILS_DOC_ID)
            .set(statusDoc, { merge: true })
        );
        await withRetry(() =>
          adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain).set(statusDoc, { merge: true })
        );
        await withRetry(() =>
          adminDb.collection(COLLEGE_TENANTS_COLLECTION).doc(subdomain).set(statusDoc, { merge: true })
        );
      } catch (firestoreError) {
        if (!isRetryableError(firestoreError)) throw firestoreError;
        await writeDocumentViaRest(USER_COLLECTION, uid, {
          ...statusDoc,
          updatedAt: now,
        });
        await writeDocumentPathViaRest(detailsPath, {
          ...statusDoc,
          updatedAt: now,
        });
        await writeDocumentViaRest(COLLEGE_HOSTS_COLLECTION, subdomain, {
          ...statusDoc,
          updatedAt: now,
        });
        await writeDocumentViaRest(COLLEGE_TENANTS_COLLECTION, subdomain, {
          ...statusDoc,
          updatedAt: now,
        });
      }

      return NextResponse.json({
        ok: true,
        status,
      });
    } catch (e) {
      console.error("lock-college-admin", e);
      return NextResponse.json(
        { error: e?.message || "Failed to update lock state." },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(req) {
  return withAdminAuth(req, async (authReq) => {
    try {
      const body = await authReq.json();
      const subdomain = normalizeSubdomain(body.subdomain);
      if (!subdomain) {
        return NextResponse.json({ error: "subdomain is required" }, { status: 400 });
      }

      const collegeRef = adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain);
      const collegeSnap = await withRetry(() => collegeRef.get());
      if (!collegeSnap.exists) {
        return NextResponse.json({ error: "College not found." }, { status: 404 });
      }
      const collegeData = collegeSnap.data() || {};
      const uid = String(collegeData.collegeAdminUid || "").trim();
      if (!uid) {
        return NextResponse.json({ error: "College admin UID missing." }, { status: 400 });
      }

      try {
        await admin.auth().deleteUser(uid);
      } catch (e) {
        if (e?.code !== "auth/user-not-found") {
          throw e;
        }
      }

      const detailsPath = `users/${uid}/${USER_DETAILS_SUBCOLLECTION}/${USER_DETAILS_DOC_ID}`;
      const deleteNow = new Date();
      try {
        await withRetry(() =>
          adminDb
            .collection(USER_COLLECTION)
            .doc(uid)
            .collection(USER_DETAILS_SUBCOLLECTION)
            .doc(USER_DETAILS_DOC_ID)
            .delete()
        );
      } catch (e) {
        if (isRetryableError(e)) {
          await writeDocumentPathViaRest(detailsPath, {
            deletedAt: deleteNow,
            status: "deleted",
            deletedBySuperAdminUid: authReq.user.uid,
          });
        } else {
          throw e;
        }
      }

      await withRetry(() => adminDb.collection(USER_COLLECTION).doc(uid).delete());
      await withRetry(() => adminDb.collection(COLLEGE_HOSTS_COLLECTION).doc(subdomain).delete());
      await withRetry(() => adminDb.collection(COLLEGE_TENANTS_COLLECTION).doc(subdomain).delete());

      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("delete-college-admin", e);
      return NextResponse.json(
        { error: e?.message || "Failed to delete college." },
        { status: 500 }
      );
    }
  });
}
