import { NextResponse } from "next/server";
import {
  getWhatsAppConfigStatus,
  isWhatsAppConfigured,
  verifyWabaSender,
} from "@/lib/whatsappTemplateSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isWhatsAppConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "WhatsApp API not configured on this server",
          config: getWhatsAppConfigStatus(),
        },
        { status: 500 }
      );
    }

    const sender = await verifyWabaSender();
    return NextResponse.json(sender, { status: sender.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
