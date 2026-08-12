/**
 * WhatsApp Cloud API — verification OTP (template "verifiaction_code").
 * Uses WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID from env.
 * @module lib/whatsappVerificationOtp
 */

import { saveOtp, toE164 } from "@/lib/otpStore";

const WABA_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_API_VERSION = "v23.0";

export function isWhatsAppVerificationConfigured() {
  return !!(WABA_TOKEN && WABA_PHONE_NUMBER_ID);
}

export function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Body for POST /{phone-number-id}/messages — template must match Business Manager. Caller sets `to`. */
export function buildVerificationTemplatePayload(otp) {
  return {
    messaging_product: "whatsapp",
    type: "template",
    template: {
      name: "verifiaction_code",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: otp }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };
}

function mapGraphApiError(data) {
  let errorMessage = "Failed to send WhatsApp message";
  if (data?.error?.message) {
    errorMessage = data.error.message;
  }
  const code = data?.error?.code;
  if (code === 100) {
    errorMessage =
      "Invalid template or template not approved. Please check your WhatsApp Business template.";
  } else if (code === 131031) {
    errorMessage = "Template does not exist or has not been approved yet.";
  } else if (code === 131047) {
    errorMessage = "Invalid template parameters. Check OTP placeholder in template.";
  } else if (code === 200 || data?.error?.type === "OAuthException") {
    if (
      data?.error?.message?.includes("blocked") ||
      data?.error?.message?.includes("block")
    ) {
      errorMessage =
        "WhatsApp API access is blocked. This usually means:\n" +
        "1. Access token expired or invalid\n" +
        "2. App permissions not granted\n" +
        "3. WhatsApp Business Account suspended\n" +
        "4. Token doesn't have access to this phone number ID\n\n" +
        "Please check your WhatsApp Business Manager and regenerate tokens.";
    } else {
      errorMessage = data.error.message || "OAuth authentication failed. Check your access token.";
    }
  }
  return errorMessage;
}

/**
 * Generate OTP, persist it, send WhatsApp template message.
 * @param {string} phoneInput - Raw phone (10-digit IN or E.164)
 * @returns {Promise<{
 *   ok: boolean,
 *   phoneE164?: string,
 *   otp?: string,
 *   messageId?: string,
 *   error?: string,
 *   details?: object,
 *   errorCode?: number,
 *   errorType?: string,
 *   hint?: string,
 * }>}
 */
export async function sendWhatsAppVerificationOtp(phoneInput) {
  if (!isWhatsAppVerificationConfigured()) {
    return {
      ok: false,
      error: "Server not configured for WhatsApp API",
      details: {
        hasToken: !!WABA_TOKEN,
        hasPhoneNumberId: !!WABA_PHONE_NUMBER_ID,
      },
    };
  }

  const phoneE164 = toE164(phoneInput);
  const otp = generateSixDigitOtp();
  const tenMinutesMs = 10 * 60 * 1000;
  await saveOtp(phoneE164, otp, tenMinutesMs);

  const payload = buildVerificationTemplatePayload(otp);
  payload.to = phoneE164.replace("+", "");

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_PHONE_NUMBER_ID}/messages`;

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
    const errorMessage = mapGraphApiError(data);
    return {
      ok: false,
      error: errorMessage,
      details: data,
      errorCode: data?.error?.code,
      errorType: data?.error?.type,
      hint:
        data?.error?.code === 200
          ? "Regenerate your WhatsApp Cloud API token in Facebook Business Manager"
          : "Check WhatsApp Business Manager for template approval status",
    };
  }

  return {
    ok: true,
    phoneE164,
    otp,
    messageId: data.messages?.[0]?.id,
  };
}
