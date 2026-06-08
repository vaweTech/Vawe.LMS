import { NextResponse } from "next/server";
import { toE164 } from "@/lib/otpStore";

// Intentionally do not store sent messages in DB – send-only to WhatsApp Cloud API.
const WABA_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;

// Sanitize template parameter for WhatsApp (avoid error 132018)
const MAX_PARAM_LENGTH = 1024;
function sanitizeTemplateParam(value, maxLen = MAX_PARAM_LENGTH) {
  if (value == null) return "";
  let s = String(value);
  // BOM and other problematic chars
  s = s.replace(/\uFEFF/g, "");
  // Remove null bytes and control chars
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  // WhatsApp template body params often reject newlines – replace with space so "text\nlink" works
  s = s.replace(/\r\n|\r|\n/g, " ");
  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
const WABA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export async function POST(req) {
  try {
    if (!WABA_TOKEN || !WABA_PHONE_NUMBER_ID) {
      return NextResponse.json(
        {
          error: "Server not configured for WhatsApp API",
          details:
            "Please set WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { phone, template, language = "en", bodyParams = [], buttonParams = [] } = body || {};

    if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
    if (!template) return NextResponse.json({ error: "template is required" }, { status: 400 });

    const phoneE164 = toE164(phone);
    // Reject invalid E.164 (e.g. +0... or too short) so we don't report "sent" when number is bad
    if (!/^\+[1-9]\d{10,14}$/.test(phoneE164)) {
      return NextResponse.json(
        { error: "Invalid phone number. Use digits with country code (e.g. 91 for India, no leading 0).", phoneE164 },
        { status: 400 }
      );
    }

    const templateComponents = [];
    if (Array.isArray(bodyParams) && bodyParams.length > 0) {
      const sanitized = bodyParams.map((p) => sanitizeTemplateParam(p));
      templateComponents.push({
        type: "body",
        parameters: sanitized.map((text) => ({ type: "text", text })),
      });
    }
    if (Array.isArray(buttonParams) && buttonParams.length > 0) {
      templateComponents.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: buttonParams.map((p) => ({ type: "text", text: String(p) })),
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      to: phoneE164.replace("+", ""),
      type: "template",
      template: {
        name: template,
        language: { code: language },
        ...(templateComponents.length > 0 ? { components: templateComponents } : {}),
      },
    };

    const url = `https://graph.facebook.com/v23.0/${WABA_PHONE_NUMBER_ID}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      let errorMessage = "Failed to send WhatsApp message";
      if (data.error?.message) errorMessage = data.error.message;

      // Handle specific error codes
      if (data.error?.code === 200 || data.error?.type === 'OAuthException') {
        // API access blocked - usually token/permission issues
        if (data.error?.message?.includes('blocked') || data.error?.message?.includes('block')) {
          errorMessage = "WhatsApp API access is blocked. This usually means:\n" +
            "1. Access token expired or invalid\n" +
            "2. App permissions not granted\n" +
            "3. WhatsApp Business Account suspended\n" +
            "4. Token doesn't have access to this phone number ID\n\n" +
            "Please check your WhatsApp Business Manager and regenerate tokens.";
        } else {
          errorMessage = data.error.message || "OAuth authentication failed. Check your access token.";
        }
      } else if (data.error?.code === 100) {
        errorMessage = "Invalid template or template not approved. Please check your WhatsApp Business template.";
      } else if (data.error?.code === 131031) {
        errorMessage = "Template does not exist or has not been approved yet.";
      } else if (data.error?.code === 131047) {
        errorMessage = "Invalid template parameters. Check template placeholders.";
      } else if (data.error?.code === 132018) {
        errorMessage = "Template parameter value is invalid. Ensure name and message contain only normal text (no special/control characters) and try language en_US if you use en.";
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: data,
          errorCode: data.error?.code,
          errorType: data.error?.type,
          hint: data.error?.code === 200 
            ? "Regenerate your WhatsApp Cloud API token in Facebook Business Manager"
            : "Check WhatsApp Business Manager settings"
        },
        { status: 500 }
      );
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) {
      return NextResponse.json(
        { error: "No messageId returned from WhatsApp API", details: data, debug: process.env.NODE_ENV !== "production" ? { phoneE164, payload } : undefined },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, messageId, debug: process.env.NODE_ENV !== "production" ? { phoneE164, payload } : undefined });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}


