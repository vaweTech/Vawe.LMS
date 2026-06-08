import { NextResponse } from "next/server";
import admin, { adminDb, writeDocumentViaRest } from "@/lib/firebaseAdmin";

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

function buildUserData(name, email, role, defaultPassword, empId, phone) {
  const userData = {
    name,
    email,
    role,
    trainerPassword: defaultPassword,
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (empId != null && String(empId).trim() !== "") {
    userData.empId = String(empId).trim();
  }
  if (phone != null && String(phone).trim() !== "") {
    userData.phone = String(phone).trim();
  }
  return userData;
}

export async function POST(req) {
  try {
    const { name, email, empId, crtTrainer, phone } = await req.json();
    if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

    const defaultPassword = "VaweTrainer@2025";
    const userRecord = await admin.auth().createUser({
      email,
      password: defaultPassword,
      displayName: name,
    });

    const role = crtTrainer ? "crtTrainer" : "trainer";
    const userData = buildUserData(name, email, role, defaultPassword, empId, phone);

    try {
      const userRef = adminDb.collection("users").doc(userRecord.uid);
      await withRetry(() => userRef.set(userData, { merge: true }));
      return NextResponse.json({ ok: true, uid: userRecord.uid });
    } catch (firestoreError) {
      if (!isRetryableError(firestoreError)) throw firestoreError;
      console.warn("create-trainer: Firestore SDK failed, trying REST fallback…", firestoreError.message);
      try {
        const restData = {
          name,
          email,
          role,
          trainerPassword: defaultPassword,
          status: "active",
          createdAt: new Date(),
        };
        if (empId != null && String(empId).trim() !== "") restData.empId = String(empId).trim();
        if (phone != null && String(phone).trim() !== "") restData.phone = String(phone).trim();
        await writeDocumentViaRest("users", userRecord.uid, restData);
        return NextResponse.json({ ok: true, uid: userRecord.uid });
      } catch (restError) {
        console.warn("create-trainer: REST fallback failed", restError.message);
        return NextResponse.json({
          ok: true,
          uid: userRecord.uid,
          needsSync: true,
          trainerData: {
            name,
            email,
            empId: empId != null ? String(empId).trim() : "",
            phone: phone != null ? String(phone).trim() : "",
            role,
            trainerPassword: defaultPassword,
          },
        });
      }
    }
  } catch (e) {
    console.error("create-trainer error", e);
    return NextResponse.json({ error: e.message || "Failed to create trainer" }, { status: 500 });
  }
}


