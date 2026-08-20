import { NextResponse } from "next/server";
import admin, {
  adminDb,
  shouldUseFirestoreSdkDirect,
  readDocumentViaRest,
  writeDocumentViaRest,
} from "@/lib/firebaseAdmin";

function isTrainerRole(role) {
  return role === "trainer" || role === "crtTrainer";
}

async function readUserDoc(uid) {
  if (shouldUseFirestoreSdkDirect() && adminDb) {
    try {
      const snap = await adminDb.collection("users").doc(uid).get();
      if (!snap.exists) return null;
      return snap.data();
    } catch (e) {
      console.warn("update-trainer-status SDK read failed, trying REST:", e?.message || e);
    }
  }
  return readDocumentViaRest("users", uid);
}

async function writeUserLock(uid, payload) {
  if (shouldUseFirestoreSdkDirect() && adminDb) {
    try {
      await adminDb.collection("users").doc(uid).set(payload, { merge: true });
      return;
    } catch (e) {
      console.warn("update-trainer-status SDK write failed, trying REST:", e?.message || e);
    }
  }
  await writeDocumentViaRest("users", uid, payload);
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

    let authUser;
    try {
      authUser = await admin.auth().getUser(uid);
    } catch (e) {
      if (e?.code === "auth/user-not-found") {
        return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
      }
      throw e;
    }

    let userData = null;
    try {
      userData = await readUserDoc(uid);
    } catch (e) {
      console.warn("update-trainer-status: user doc read failed:", e?.message || e);
    }

    if (userData && !isTrainerRole(userData.role)) {
      return NextResponse.json({ error: "User is not a trainer" }, { status: 400 });
    }

    // Complete lock: disable Firebase Auth so this account cannot log in.
    await admin.auth().updateUser(uid, {
      disabled: !active,
    });

    if (!active) {
      try {
        await admin.auth().revokeRefreshTokens(uid);
      } catch (e) {
        console.error("Failed to revoke trainer sessions:", e);
      }
    }

    const payload = {
      status: active ? "active" : "hold",
      locked: !active,
    };

    let firestoreUpdated = true;
    try {
      await writeUserLock(uid, payload);
    } catch (e) {
      firestoreUpdated = false;
      console.warn(
        "update-trainer-status Firestore write failed after Auth lock:",
        e?.message || e
      );
    }

    return NextResponse.json({
      ok: true,
      locked: !active,
      firestoreUpdated,
    });
  } catch (e) {
    console.error("update-trainer-status error", e);
    return NextResponse.json(
      { error: e.message || "Failed to update trainer status" },
      { status: 500 }
    );
  }
}
