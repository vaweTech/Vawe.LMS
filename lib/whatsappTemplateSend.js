import { isValidWhatsAppRecipientE164, toE164, toWhatsAppRecipientId } from "@/lib/phoneE164";
import {
  getWhatsAppTemplateLanguageCandidates,
  resolveWhatsAppTemplateLanguage,
  WHATSAPP_TEMPLATES_LANGUAGE_EN,
} from "@/lib/whatsappTemplateLanguage";

export {
  getWhatsAppTemplateLanguageCandidates,
  resolveWhatsAppTemplateLanguage,
  WHATSAPP_TEMPLATES_LANGUAGE_EN,
};

const MAX_PARAM_LENGTH = 1024;

function cleanEnv(value) {
  let s = String(value ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getWabaConfig() {
  return {
    token: cleanEnv(process.env.WHATSAPP_CLOUD_API_TOKEN),
    phoneNumberId: cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID),
    apiVersion: cleanEnv(process.env.WHATSAPP_API_VERSION) || "v25.0",
  };
}

export function sanitizeTemplateParam(value, maxLen = MAX_PARAM_LENGTH) {
  if (value == null) return "";
  let s = String(value);
  s = s.replace(/\uFEFF/g, "");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  s = s.replace(/\r\n|\r|\n/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function isWhatsAppConfigured() {
  const { token, phoneNumberId } = getWabaConfig();
  return Boolean(token && phoneNumberId);
}

export function getWhatsAppConfigStatus() {
  const { token, phoneNumberId, apiVersion } = getWabaConfig();
  return {
    configured: Boolean(token && phoneNumberId),
    hasToken: Boolean(token),
    hasPhoneNumberId: Boolean(phoneNumberId),
    apiVersion,
    vercelEnv: process.env.VERCEL_ENV || null,
    phoneNumberIdMasked: phoneNumberId
      ? `${phoneNumberId.slice(0, 4)}…${phoneNumberId.slice(-4)}`
      : null,
  };
}

/** Verify token + phone number ID against Meta Graph API (use on Vercel to confirm env). */
export async function verifyWabaSender() {
  const { token, phoneNumberId, apiVersion } = getWabaConfig();
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error: "Missing WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID",
      config: getWhatsAppConfigStatus(),
    };
  }

  const fields =
    "display_phone_number,verified_name,quality_rating,platform_type,code_verification_status";
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=${fields}`;

  try {
    const res = await graphFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      return {
        ok: false,
        error: data.error?.message || "WhatsApp credentials invalid on this server",
        errorCode: data.error?.code,
        config: getWhatsAppConfigStatus(),
        details: data.error || data,
      };
    }

    return {
      ok: true,
      displayPhoneNumber: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
      qualityRating: data.quality_rating || null,
      platformType: data.platform_type || null,
      codeVerificationStatus: data.code_verification_status || null,
      phoneNumberId,
      apiVersion,
      config: getWhatsAppConfigStatus(),
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "Failed to verify WhatsApp sender",
      config: getWhatsAppConfigStatus(),
    };
  }
}

function formatFetchError(err) {
  const cause = err?.cause;
  const parts = [err?.message, cause?.code, cause?.message].filter(Boolean);
  return parts.length ? parts.join(" — ") : "fetch failed";
}

async function graphFetch(url, options, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw new Error(formatFetchError(lastErr));
}

function formatWhatsAppError(data) {
  let errorMessage = "Failed to send WhatsApp message";
  if (data.error?.message) errorMessage = data.error.message;

  if (data.error?.code === 200 || data.error?.type === "OAuthException") {
    if (data.error?.message?.includes("blocked") || data.error?.message?.includes("block")) {
      errorMessage =
        "WhatsApp API access is blocked. Check token, permissions, and phone number ID.";
    } else {
      errorMessage = data.error.message || "OAuth authentication failed. Check your access token.";
    }
  } else if (data.error?.code === 100) {
    errorMessage = "Invalid template or template not approved.";
  } else if (data.error?.code === 131031) {
    errorMessage = "Template does not exist or has not been approved yet.";
  } else if (data.error?.code === 131047) {
    errorMessage = "Invalid template parameters. Check template placeholders.";
  } else if (data.error?.code === 132018) {
    errorMessage =
      "Template parameter value is invalid. Use plain text only and verify language code (e.g. en for custom_message).";
  }

  return {
    errorMessage,
    errorCode: data.error?.code,
    errorType: data.error?.type,
  };
}

function isLanguageOrTemplateError(errorCode) {
  return errorCode === 100 || errorCode === 131031 || errorCode === 132018;
}

function buildTemplatePayload({
  template,
  languageCode,
  recipientId,
  templateComponents,
}) {
  return {
    messaging_product: "whatsapp",
    to: recipientId,
    type: "template",
    template: {
      name: template,
      language: { code: languageCode },
      ...(templateComponents.length > 0 ? { components: templateComponents } : {}),
    },
  };
}

async function postWhatsAppTemplate({ token, phoneNumberId, apiVersion, payload }) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const res = await graphFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data?.error) {
    return { res: { ...res, ok: false, status: res.status || 400 }, data };
  }
  return { res, data };
}

export async function sendWhatsAppTemplate({
  phone,
  template,
  language = "en",
  bodyParams = [],
  namedBodyParams = [],
  buttonParams = [],
  copyCodeButton,
}) {
  const { token, phoneNumberId, apiVersion } = getWabaConfig();

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      status: 500,
      error: "Server not configured for WhatsApp API",
      config: getWhatsAppConfigStatus(),
    };
  }

  if (!phone) {
    return { ok: false, status: 400, error: "phone is required" };
  }
  if (!template) {
    return { ok: false, status: 400, error: "template is required" };
  }

  const phoneE164 = toE164(phone);
  const recipientId = toWhatsAppRecipientId(phone);
  if (!isValidWhatsAppRecipientE164(phoneE164)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid phone number. Use a valid 10-digit Indian mobile or full country code.",
      phoneE164,
      recipientId,
      rawPhone: String(phone),
    };
  }

  const templateComponents = [];
  if (Array.isArray(namedBodyParams) && namedBodyParams.length > 0) {
    templateComponents.push({
      type: "body",
      parameters: namedBodyParams.map(({ name, text }) => ({
        type: "text",
        parameter_name: String(name),
        text: sanitizeTemplateParam(text),
      })),
    });
  } else if (Array.isArray(bodyParams) && bodyParams.length > 0) {
    const sanitized = bodyParams.map((p) => sanitizeTemplateParam(p));
    templateComponents.push({
      type: "body",
      parameters: sanitized.map((text) => ({ type: "text", text })),
    });
  }

  if (copyCodeButton) {
    templateComponents.push({
      type: "button",
      sub_type: "copy_code",
      index: "0",
      parameters: [{ type: "coupon_code", coupon_code: String(copyCodeButton).slice(0, 15) }],
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

  const languageCandidates = getWhatsAppTemplateLanguageCandidates(
    template,
    resolveWhatsAppTemplateLanguage(template, language)
  );
  let lastFailure = null;

  for (const languageCode of languageCandidates) {
    try {
      const payload = buildTemplatePayload({
        template,
        languageCode,
        recipientId,
        templateComponents,
      });

      const { res, data } = await postWhatsAppTemplate({
        token,
        phoneNumberId,
        apiVersion,
        payload,
      });

      if (res.ok) {
        const messageId = data.messages?.[0]?.id;
        const messageStatus = data.messages?.[0]?.message_status || null;
        const waId = data.contacts?.[0]?.wa_id || null;
        const inputPhone = data.contacts?.[0]?.input || recipientId;

        if (!messageId) {
          return {
            ok: false,
            status: 502,
            error: "No messageId returned from WhatsApp API",
            details: data,
            languagesTried: languageCandidates,
            recipientId,
            phoneE164,
          };
        }

        if (!waId) {
          return {
            ok: true,
            messageId,
            phoneE164,
            recipientId,
            inputPhone,
            messageStatus,
            language: languageCode,
            deliveryWarning:
              "Meta accepted the message. If not received, verify the mobile number is on WhatsApp.",
            languagesTried: [languageCode],
          };
        }

        if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) {
          console.log("[WhatsApp] accepted", {
            template,
            language: languageCode,
            recipientId: waId,
            messageId,
            messageStatus,
            phoneNumberId: getWabaConfig().phoneNumberId,
          });
        }

        return {
          ok: true,
          messageId,
          phoneE164,
          recipientId: waId,
          inputPhone,
          messageStatus,
          language: languageCode,
          languagesTried: languageCandidates.slice(
            0,
            languageCandidates.indexOf(languageCode) + 1
          ),
        };
      }

      const formatted = formatWhatsAppError(data);
      lastFailure = {
        ok: false,
        status: 500,
        error: formatted.errorMessage,
        details: data,
        errorCode: formatted.errorCode,
        errorType: formatted.errorType,
        language: languageCode,
      };

      if (
        !isLanguageOrTemplateError(formatted.errorCode) ||
        languageCode === languageCandidates[languageCandidates.length - 1]
      ) {
        break;
      }
    } catch (err) {
      lastFailure = {
        ok: false,
        status: 500,
        error: err?.message || "WhatsApp API request failed",
        language: languageCode,
      };
      if (languageCode === languageCandidates[languageCandidates.length - 1]) {
        break;
      }
    }
  }

  return {
    ...lastFailure,
    languagesTried: languageCandidates,
  };
}

/** Run async tasks with a fixed concurrency limit. */
export async function runWithConcurrency(items, concurrency, worker) {
  if (!items.length) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}
