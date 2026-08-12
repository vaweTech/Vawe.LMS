import { NextResponse } from "next/server";
import admin, {
  adminDb,
  getFirestoreProjectId,
  getFirestoreRestAccessToken,
} from "@/lib/firebaseAdmin";
import { withAdminAuth } from "@/lib/apiAuth";

const isTransientNetworkError = (e) =>
  e?.code === "ECONNRESET" ||
  e?.code === "ETIMEDOUT" ||
  e?.errno === "ECONNRESET" ||
  (e?.message && /socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED/i.test(e.message));

async function withRetry(fn, maxAttempts = 5) {
  const delays = [400, 800, 1500, 2500, 4000];
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isTransientNetworkError(e)) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1] || 2000));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** GET document via Firestore REST (fallback when Admin SDK drops connection). */
async function restGetDocument(relativePath) {
  const projectId = getFirestoreProjectId();
  const token = await getFirestoreRestAccessToken();
  if (!projectId || !token) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${relativePath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    console.warn("delete-po-user REST GET failed:", res.status, text?.slice(0, 200));
    return null;
  }
  return res.json();
}

function restStringField(fields, key) {
  return fields?.[key]?.stringValue ?? null;
}

/** DELETE document via Firestore REST (nested paths supported). */
async function restDeleteDocument(relativePath) {
  const projectId = getFirestoreProjectId();
  const token = await getFirestoreRestAccessToken();
  if (!projectId || !token) {
    console.warn("delete-po-user REST DELETE: missing project or token");
    return;
  }
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${relativePath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.warn("delete-po-user REST DELETE:", relativePath, res.status, text?.slice(0, 200));
  }
}

async function deletePoUserHandler(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const poId = typeof body.poId === "string" ? body.poId.trim() : "";
  if (!poId) {
    return NextResponse.json({ error: "poId is required" }, { status: 400 });
  }

  const collegeSubdomain = String(body.collegeSubdomain || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

  const centralPath = collegeSubdomain
    ? `collegeTenants/${encodeURIComponent(collegeSubdomain)}/crtPO/${encodeURIComponent(poId)}`
    : `users/crtPO/po/${encodeURIComponent(poId)}`;
  const centralRef = collegeSubdomain
    ? adminDb.collection("collegeTenants").doc(collegeSubdomain).collection("crtPO").doc(poId)
    : adminDb.collection("users").doc("crtPO").collection("po").doc(poId);

  let poData = {};
  let centralExists = false;

  try {
    const centralSnap = await withRetry(() => centralRef.get());
    centralExists = centralSnap.exists;
    if (centralExists) {
      poData = centralSnap.data() || {};
    }
  } catch (e) {
    console.warn("delete-po-user: SDK get central PO failed, trying REST:", e?.message);
    const restDoc = await restGetDocument(centralPath);
    if (restDoc?.fields) {
      centralExists = true;
      poData = {
        userId: restStringField(restDoc.fields, "userId"),
      };
    }
  }

  if (!centralExists) {
    return NextResponse.json(
      { error: "PO record not found (or Firestore unreachable — try again)." },
      { status: 404 }
    );
  }

  const uid =
    (typeof body.uid === "string" && body.uid.trim()) ||
    poData.userId ||
    null;

  if (!uid) {
    return NextResponse.json(
      { error: "Cannot resolve Firebase user for this PO (missing userId on record)." },
      { status: 400 }
    );
  }

  const userRef = adminDb.collection("users").doc(uid);

  try {
    const userSnap = await withRetry(() => userRef.get());
    if (userSnap.exists) {
      const role = userSnap.data()?.role;
      if (role && role !== "crtPoUser") {
        return NextResponse.json(
          { error: "Refusing to delete: linked user is not a CRT PO account." },
          { status: 400 }
        );
      }
    }
  } catch (e) {
    console.warn("delete-po-user: SDK get user failed, trying REST:", e?.message);
    const restUser = await restGetDocument(`users/${encodeURIComponent(uid)}`);
    const role = restStringField(restUser?.fields, "role");
    if (role && role !== "crtPoUser") {
      return NextResponse.json(
        { error: "Refusing to delete: linked user is not a CRT PO account." },
        { status: 400 }
      );
    }
  }

  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    if (e?.code !== "auth/user-not-found") {
      console.error("delete-po-user: auth deleteUser", e);
      return NextResponse.json(
        { error: e?.message || "Failed to delete Firebase Auth user." },
        { status: 502 }
      );
    }
  }

  try {
    await withRetry(() => centralRef.delete());
  } catch (e) {
    console.warn("delete-po-user: SDK delete central, using REST:", e?.message);
    await restDeleteDocument(centralPath);
  }

  try {
    await withRetry(() => userRef.collection("po").doc(poId).delete());
  } catch (e) {
    console.warn("delete-po-user: SDK delete sub po doc, using REST:", e?.message);
    await restDeleteDocument(
      `users/${encodeURIComponent(uid)}/po/${encodeURIComponent(poId)}`
    );
  }

  try {
    await withRetry(() => userRef.delete());
  } catch (e) {
    console.warn("delete-po-user: SDK delete user doc, using REST:", e?.message);
    await restDeleteDocument(`users/${encodeURIComponent(uid)}`);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  return withAdminAuth(request, async (req) => {
    try {
      return await deletePoUserHandler(req);
    } catch (e) {
      console.error("delete-po-user handler:", e);
      const msg = isTransientNetworkError(e)
        ? "Firestore connection dropped. Wait a few seconds and try again."
        : e?.message || "Failed to delete PO";
      return NextResponse.json({ error: msg }, { status: 503 });
    }
  });
}
