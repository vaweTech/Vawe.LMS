import { NextResponse } from "next/server";
import {
  getWhatsAppConfigStatus,
  isWhatsAppConfigured,
  resolveWhatsAppTemplateLanguage,
  sendWhatsAppTemplate,
} from "@/lib/whatsappTemplateSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!isWhatsAppConfigured()) {
      const config = getWhatsAppConfigStatus();
      return NextResponse.json(
        {
          error: "Server not configured for WhatsApp API",
          details:
            "Please set WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Vercel environment variables",
          config,
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      phone,
      template,
      language = "en",
      bodyParams = [],
      namedBodyParams = [],
      buttonParams = [],
      copyCodeButton,
    } = body || {};

    const languageUsed = resolveWhatsAppTemplateLanguage(template, language);

    const result = await sendWhatsAppTemplate({
      phone,
      template,
      language: languageUsed,
      bodyParams,
      namedBodyParams,
      buttonParams,
      copyCodeButton,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
          errorCode: result.errorCode,
          errorType: result.errorType,
          languagesTried: result.languagesTried,
          hint:
            result.errorCode === 200
              ? "Regenerate your WhatsApp Cloud API token in Facebook Business Manager"
              : "Check WhatsApp Business Manager settings",
        },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      languageUsed: result.language ?? resolveWhatsAppTemplateLanguage(template, language),
      debug:
        process.env.NODE_ENV !== "production"
          ? { phoneE164: result.phoneE164 }
          : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
