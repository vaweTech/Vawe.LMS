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

async function withRetry(fn, maxAttempts = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableError(e)) {
        const delayMs = [800, 1500, 3000, 5000][attempt - 1] || 6000;
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
    const {
      empId,
      name,
      email,
      phone,
      departmentName,
      departmentId,
      isClassRoomMonitor,
    } = await req.json();

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Name, email and mobile number are required" },
        { status: 400 }
      );
    }

    const role = isClassRoomMonitor ? "class room monitor" : "assignment incharge";
    const defaultPassword = "VaweIncharge@2025";

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password: defaultPassword,
        displayName: name,
      });
    } catch (err) {
      // If email already exists, reuse that account instead of failing
      if (err?.code === "auth/email-already-exists") {
        userRecord = await admin.auth().getUserByEmail(email);
      } else {
        throw err;
      }
    }

    const userData = {
      name,
      email,
      phone,
      empId: empId || "",
      departmentName: departmentName || "",
      departmentId: departmentId || "",
      role,
      isIncharge: true,
      inchargePassword: defaultPassword,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const userRef = adminDb.collection("users").doc(userRecord.uid);
    const subRef = userRef.collection("incharges").doc("primary");

    try {
      // First try via Firestore SDK with retries (both main doc and subcollection)
      await withRetry(() =>
        Promise.all([
          userRef.set(userData, { merge: true }),
          subRef.set(userData, { merge: true }),
        ])
      );
      return NextResponse.json({ ok: true, uid: userRecord.uid });
    } catch (firestoreError) {
      // If it's not a retryable network-type error, bubble it up
      if (!isRetryableError(firestoreError)) {
        throw firestoreError;
      }

      console.warn(
        "create-incharge: Firestore SDK failed, trying REST fallback…",
        firestoreError.message
      );

      try {
        // REST fallback write for main doc and subcollection doc
        await writeDocumentViaRest("users", userRecord.uid, userData);
        await writeDocumentViaRest(
          `users/${userRecord.uid}/incharges`,
          "primary",
          userData
        );
        return NextResponse.json({ ok: true, uid: userRecord.uid });
      } catch (restError) {
        console.warn("create-incharge: REST fallback failed", restError.message);
        // Auth user exists, but profile write failed; signal caller that a manual sync may be needed
        return NextResponse.json(
          {
            ok: true,
            uid: userRecord.uid,
            needsSync: true,
            inchargeData: {
              empId: userData.empId,
              name: userData.name,
              email: userData.email,
              phone: userData.phone,
              departmentName: userData.departmentName,
              departmentId: userData.departmentId,
              role: userData.role,
            },
          },
          { status: 200 }
        );
      }
    }
  } catch (e) {
    console.error("create-incharge error", e);
    return NextResponse.json(
      { error: e.message || "Failed to create incharge" },
      { status: 500 }
    );
  }
}

