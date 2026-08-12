import { NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin";

// Create or reuse a Firebase Auth user for a college CRT officer.
// NOTE: This route no longer writes to Firestore; the client is responsible
// for creating/updating the corresponding `users` document using the UID.
export async function POST(req) {
  try {
    const { collegeName, email } = await req.json();

    if (!collegeName || !email) {
      return NextResponse.json(
        { error: "College name and email required" },
        { status: 400 }
      );
    }

    const trimmedName = String(collegeName).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const defaultPassword = "Vawe@Crt";

    let userRecord;

    try {
      // Try to create a new Auth user for the college CRT officer
      userRecord = await admin.auth().createUser({
        email: trimmedEmail,
        password: defaultPassword,
        displayName: trimmedName,
      });
    } catch (e) {
      // If the email already exists, reuse that user
      if (e?.code === "auth/email-already-exists") {
        userRecord = await admin.auth().getUserByEmail(trimmedEmail);
      } else {
        throw e;
      }
    }

    const uid = userRecord.uid;

    return NextResponse.json({
      ok: true,
      uid,
      defaultPassword,
    });
  } catch (e) {
    console.error("create-crt-officer error", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create CRT officer" },
      { status: 500 }
    );
  }
}

