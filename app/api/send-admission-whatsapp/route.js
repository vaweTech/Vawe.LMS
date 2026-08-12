import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/apiAuth";
import { sendAdmissionWhatsApp } from "@/lib/admissionWelcomeWhatsApp";

async function handler(request) {
  try {
    const body = await request.json();
    const { phone, name, email, password } = body || {};

    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    const result = await sendAdmissionWhatsApp({ phone, name, email, password });

    if (result.skipped) {
      return NextResponse.json(
        { ok: false, skipped: true, reason: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.warn("send-admission-whatsapp failed:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to send admission WhatsApp messages" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return withAdminAuth(request, handler);
}
