import { NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebaseAdmin";

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

export async function PATCH(req) {
  try {
    const { uid, active } = await req.json();
    if (!uid || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "uid and boolean active are required" },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await withRetry(() => userRef.get());
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
    }

    const data = userSnap.data();
    if (data?.role !== "trainer" && data?.role !== "crtTrainer") {
      return NextResponse.json(
        { error: "User is not a trainer" },
        { status: 400 }
      );
    }

    // 1) Disable/enable authentication
    await withRetry(() =>
      admin.auth().updateUser(uid, {
        disabled: !active,
      })
    );

    // 2) Update Firestore status field
    await withRetry(() =>
      userRef.set(
        {
          status: active ? "active" : "hold",
        },
        { merge: true }
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("update-trainer-status error", e);
    return NextResponse.json(
      { error: e.message || "Failed to update trainer status" },
      { status: 500 }
    );
  }
}

