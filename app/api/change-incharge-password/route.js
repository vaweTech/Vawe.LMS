import { NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebaseAdmin";

async function updateInchargePasswordInFirestore(uid, newPassword) {
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const collegeSubdomain = String(userSnap.data()?.collegeSubdomain || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

  const updates = [];

  updates.push(
    adminDb.collection("users").doc(uid).set(
      {
        inchargePassword: newPassword,
        passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  );

  updates.push(
    adminDb
      .collection("users")
      .doc(uid)
      .collection("incharges")
      .doc("primary")
      .set(
        {
          inchargePassword: newPassword,
          passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
  );

  const [activeSnap, monitorSnap] = collegeSubdomain
    ? await Promise.all([
        adminDb
          .collection("collegeTenants")
          .doc(collegeSubdomain)
          .collection("activeIncharge")
          .where("userId", "==", uid)
          .get(),
        adminDb
          .collection("collegeTenants")
          .doc(collegeSubdomain)
          .collection("classroomMonitor")
          .where("userId", "==", uid)
          .get(),
      ])
    : await Promise.all([
        adminDb
          .collection("users")
          .doc("crtActiveIncharge")
          .collection("activeIncharge")
          .where("userId", "==", uid)
          .get(),
        adminDb
          .collection("users")
          .doc("crtActiveIncharge")
          .collection("classroomMonitor")
          .where("userId", "==", uid)
          .get(),
      ]);

  activeSnap.docs.forEach((d) => {
    updates.push(
      d.ref.set(
        {
          inchargePassword: newPassword,
          passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  });

  monitorSnap.docs.forEach((d) => {
    updates.push(
      d.ref.set(
        {
          inchargePassword: newPassword,
          passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    );
  });

  await Promise.all(updates);
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded?.uid;
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPassword } = await req.json();
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    await admin.auth().updateUser(uid, { password: newPassword });
    await updateInchargePasswordInFirestore(uid, newPassword);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("change-incharge-password error", e);
    return NextResponse.json(
      { error: e?.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
