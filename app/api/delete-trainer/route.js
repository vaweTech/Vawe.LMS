import { NextResponse } from "next/server";
import admin, { adminDb, deleteDocumentViaRest } from "@/lib/firebaseAdmin";

const isTransientNetworkError = (e) =>
  e?.code === "ECONNRESET" ||
  e?.code === "ETIMEDOUT" ||
  e?.errno === "ECONNRESET" ||
  (e?.message && /socket hang up|ECONNRESET|ETIMEDOUT/i.test(e.message));

async function withRetry(fn, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isTransientNetworkError(e)) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Trainer uid required" }, { status: 400 });

    const userRef = adminDb.collection("users").doc(uid);
    let isTrainer = true;

    try {
      const userSnap = await withRetry(() => userRef.get());
      if (!userSnap.exists) {
        return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
      }
      const data = userSnap.data();
      if (data?.role !== "trainer" && data?.role !== "crtTrainer") {
        return NextResponse.json({ error: "User is not a trainer" }, { status: 400 });
      }
    } catch (e) {
      if (!isTransientNetworkError(e)) {
        throw e;
      }
      // Network issue talking to Firestore; continue best-effort based on UI context.
      console.warn("delete-trainer: Firestore get failed, continuing with best-effort delete", e.message);
      isTrainer = true;
    }

    await withRetry(() => admin.auth().deleteUser(uid));

    try {
      await withRetry(() => userRef.delete());
    } catch (e) {
      if (!isTransientNetworkError(e)) {
        throw e;
      }
      console.warn("delete-trainer: Firestore SDK delete failed, trying REST delete", e.message);
      try {
        await deleteDocumentViaRest("users", uid);
      } catch (restErr) {
        console.warn("delete-trainer: REST delete failed (best-effort only)", restErr.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("delete-trainer error", e);
    return NextResponse.json(
      { error: e.message || "Failed to delete trainer" },
      { status: 500 }
    );
  }
}
