import { NextResponse } from "next/server";
import { sendWhatsAppVerificationOtp } from "@/lib/whatsappVerificationOtp";

export async function POST(req) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`📤 Sending WhatsApp OTP for phone input: ${String(phone).slice(0, 4)}…`);
    }

    const result = await sendWhatsAppVerificationOtp(phone);

    if (!result.ok) {
      if (result.error === "Server not configured for WhatsApp API") {
        console.error("❌ WhatsApp API not configured");
        return NextResponse.json(
          {
            error: result.error,
            details:
              "Please set WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables",
            hasToken: result.details?.hasToken,
            hasPhoneNumberId: result.details?.hasPhoneNumberId,
          },
          { status: 500 }
        );
      }

      console.error("❌ WhatsApp API Error:", {
        error: result.error,
        details: result.details,
      });

      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
          errorCode: result.errorCode,
          errorType: result.errorType,
          hint: result.hint,
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`🔐 Generated OTP (dev only): ${result.otp}`);
    }
    console.log(`✅ WhatsApp message sent successfully`);

    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json({
      ok: true,
      debugOtp: isProd ? undefined : result.otp,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("❌ Unexpected error in send-whatsapp-otp:", err);
    return NextResponse.json(
      {
        error: err.message || "Unexpected error",
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
