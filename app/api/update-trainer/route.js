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
    const { uid, name, email, phone } = await req.json();
    if (!uid) return NextResponse.json({ error: "Trainer uid required" }, { status: 400 });
    if (!name?.trim() && !email?.trim() && !phone?.trim())
      return NextResponse.json({ error: "Provide at least name, email or phone" }, { status: 400 });

    const updates = {};
    if (name?.trim()) updates.displayName = name.trim();
    if (email?.trim()) updates.email = email.trim();

    if (Object.keys(updates).length > 0) {
      await withRetry(() => admin.auth().updateUser(uid, updates));
    }

    const firestoreUpdates = {};
    if (name?.trim()) firestoreUpdates.name = name.trim();
    if (email?.trim()) firestoreUpdates.email = email.trim();
    if (phone?.trim()) firestoreUpdates.phone = phone.trim();
    if (Object.keys(firestoreUpdates).length > 0) {
      await withRetry(() =>
        adminDb.collection("users").doc(uid).set(firestoreUpdates, { merge: true })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("update-trainer error", e);
    return NextResponse.json(
      { error: e.message || "Failed to update trainer" },
      { status: 500 }
    );
  }
}
