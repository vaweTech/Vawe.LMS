import { NextResponse } from "next/server";
import admin, { adminDb, writeDocumentViaRest } from "@/lib/firebaseAdmin";

const isRetryableError = (e) => {
  const msg = e?.message || "";
  return (
    /socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED/i.test(msg) ||
    e?.code === "ECONNRESET" ||
    e?.code === "ETIMEDOUT" ||
    e?.code === "UNAVAILABLE"
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
  try {
    const { uid, name, email, empId, role, phone, trainerPassword: pwdFromBody } =
      await req.json();
    if (!uid || !name || !email) {
      return NextResponse.json(
        { error: "uid, name and email required" },
        { status: 400 }
      );
    }
    const allowedRole = role === "crtTrainer" ? "crtTrainer" : "trainer";
    const defaultPassword = "VaweTrainer@2025";
    const trainerPassword =
      pwdFromBody != null && String(pwdFromBody).trim() !== ""
        ? String(pwdFromBody).trim()
        : defaultPassword;
    const userData = {
      name,
      email,
      role: allowedRole,
      trainerPassword,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (empId != null && String(empId).trim() !== "") {
      userData.empId = String(empId).trim();
    }
    if (phone != null && String(phone).trim() !== "") {
      userData.phone = String(phone).trim();
    }

    const userRef = adminDb.collection("users").doc(uid);
    try {
      await withRetry(() => userRef.set(userData, { merge: true }));
      return NextResponse.json({ ok: true });
    } catch (sdkError) {
      if (!isRetryableError(sdkError)) throw sdkError;
      const restData = {
        name,
        email,
        role: allowedRole,
        trainerPassword,
        createdAt: new Date(),
      };
      if (empId != null && String(empId).trim() !== "") restData.empId = String(empId).trim();
      if (phone != null && String(phone).trim() !== "") restData.phone = String(phone).trim();
      await writeDocumentViaRest("users", uid, restData);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error("sync-trainer-doc error", e);
    return NextResponse.json(
      { error: e.message || "Failed to save trainer profile" },
      { status: 500 }
    );
  }
}
