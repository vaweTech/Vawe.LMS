import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Input validation schema
const deleteStudentSchema = z
  .object({
    id: z.string().optional(),
    uid: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.id || data.uid || data.email, {
    message: "At least one identifier (id, uid, or email) is required",
  });

let cachedServiceAccount = null;

function loadServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  let serviceAccountJson = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      serviceAccountJson = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64"
      ).toString("utf8");
    } catch (error) {
      console.warn(
        "Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:",
        error?.message || error
      );
    }
  }

  if (!serviceAccountJson && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }

  if (!serviceAccountJson) {
    const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");
    try {
      serviceAccountJson = fs.readFileSync(serviceAccountPath, "utf8");
    } catch (error) {
      const safeMsg = String(error?.message || "").replace(/[\x00-\x1F\x7F]/g, "").substring(0, 200);
      throw new Error(
        `Service account credentials are required. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 or serviceAccountKey.json. ${safeMsg ? `(${safeMsg})` : ""}`
      );
    }
  }

  try {
    cachedServiceAccount = JSON.parse(serviceAccountJson);
  } catch (parseErr) {
    const safeMsg = String(parseErr?.message || "").replace(/[\x00-\x1F\x7F]/g, "").substring(0, 200);
    throw new Error(`Failed to parse service account JSON: ${safeMsg}`);
  }
  if (
    cachedServiceAccount.private_key &&
    cachedServiceAccount.private_key.includes("\\n")
  ) {
    cachedServiceAccount.private_key = cachedServiceAccount.private_key.replace(
      /\\n/g,
      "\n"
    );
  }
  return cachedServiceAccount;
}

function encodeBase64Url(value) {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+/g, "");
}

function resolveProjectId(serviceAccount) {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount.project_id
  );
}

async function getGoogleAccessToken(scopes = ["https://www.googleapis.com/auth/datastore"]) {
  const serviceAccount = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const scopeString = Array.isArray(scopes) ? scopes.join(" ") : scopes;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    scope: scopeString,
  };

  const unsigned = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign
    .sign(serviceAccount.private_key, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+/g, "");
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });

  if (!tokenRes.ok) {
    let errText = "Failed to fetch Google OAuth token";
    try {
      const contentType = tokenRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const errData = await tokenRes.json().catch(() => null);
        errText = errData?.error?.message || errData?.error_description || errText;
      } else {
        const text = await tokenRes.text().catch(() => "");
        errText = text.substring(0, 200) || errText;
      }
    } catch {
      // Fallback to default error
    }
    // Sanitize error message for JSON
    errText = String(errText || "").replace(/[\x00-\x1F\x7F]/g, "").substring(0, 500);
    throw new Error(errText);
  }

  let tokenData;
  try {
    tokenData = await tokenRes.json();
  } catch (jsonErr) {
    // If JSON parsing fails, try text
    const text = await tokenRes.text().catch(() => "");
    const safeText = String(text || "").replace(/[\x00-\x1F\x7F]/g, "").substring(0, 200);
    throw new Error(`Invalid OAuth token response: ${safeText}`);
  }
  
  const { access_token } = tokenData || {};
  if (!access_token) {
    throw new Error("OAuth token response missing access_token");
  }

  return { accessToken: access_token, serviceAccount };
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
  const { accessToken, serviceAccount } = await getGoogleAccessToken(
    "https://www.googleapis.com/auth/datastore"
  );
  return {
    accessToken,
    projectId: resolveProjectId(serviceAccount),
  };
}

async function getIdentityToolkitClient() {
  const { accessToken, serviceAccount } = await getGoogleAccessToken(
    "https://www.googleapis.com/auth/identitytoolkit"
  );
  return {
    accessToken,
    projectId: resolveProjectId(serviceAccount),
  };
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
  const auth = client || (await getFirestoreRestClient());
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/students/${docId}`;
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

async function deleteStudentHandler(request) {
  try {
    const { id, uid: uidFromClient, email: emailFromClient } = request.validatedBody;
    const studentsCol = adminDb.collection("students");

    let docId = id || null;
    let docRef = docId ? studentsCol.doc(docId) : null;
    let studentData = null;
    let preferRest = false;

    // Firestore client cache per request
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

    const tryLoadByDocRef = async () => {
      if (!docRef) return;
      try {
        const snap = await docRef.get();
        if (snap.exists) {
          studentData = snap.data();
        }
      } catch (err) {
        if (!isDecoderError(err) && !isNetworkError(err)) throw err;
        preferRest = true;
        const restDoc = await fetchStudentDocViaRest(docRef.id, await ensureFirestoreClient());
        if (restDoc) {
          studentData = restDoc.data;
          docId = restDoc.docId;
          docRef = null;
        }
      }
    };

    await tryLoadByDocRef();

    const tryLoadByField = async (field, value) => {
      if (!value || studentData) return;
      try {
        const snap = await studentsCol.where(field, "==", value).limit(1).get();
        if (!snap.empty) {
          docRef = snap.docs[0].ref;
          docId = docRef.id;
          studentData = snap.docs[0].data();
        }
      } catch (err) {
        if (!isDecoderError(err) && !isNetworkError(err)) throw err;
        preferRest = true;
        const restDoc = await queryStudentDocViaRest(field, value, await ensureFirestoreClient());
        if (restDoc) {
          docId = restDoc.docId;
          studentData = restDoc.data;
          docRef = null;
        }
      }
    };

    if (!studentData && uidFromClient) {
      await tryLoadByField("uid", uidFromClient);
    }

    if (!studentData && emailFromClient) {
      const normalized = normalizeEmail(emailFromClient);
      await tryLoadByField("emailNormalized", normalized);
    }

    if (!studentData) {
      return new Response(
        JSON.stringify({ error: "Student not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const uid = studentData?.uid || uidFromClient || null;

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