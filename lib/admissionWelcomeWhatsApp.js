import { toE164 } from "@/lib/otpStore";

const WABA_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WABA_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const WELCOME_TEMPLATE =
  process.env.WHATSAPP_WELCOME_TEMPLATE_NAME || "welcome_account_created";
const LOGIN_TEMPLATE_NAMES = (
  process.env.WHATSAPP_LOGIN_PASSWORD_TEMPLATE_NAME || "login_passwrod"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const WELCOME_LANGUAGES = (
  process.env.WHATSAPP_WELCOME_TEMPLATE_LANGUAGE || "en,en_US"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// login_passwrod is approved as English (US) → en_US in Meta
const LOGIN_LANGUAGES = (
  process.env.WHATSAPP_LOGIN_PASSWORD_TEMPLATE_LANGUAGE || "en_US,en"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SUPPORT_PHONE =
  process.env.VAWE_CONTACT_PHONE || process.env.WHATSAPP_SUPPORT_PHONE || "8142112333";
const LOGIN_BUTTON_TEXT = process.env.WHATSAPP_LOGIN_BUTTON_TEXT || "login";
const DEFAULT_PASSWORD = "Vawe@2026";

const MAX_PARAM_LENGTH = 1024;

function graphUrl(path) {
  return `https://graph.facebook.com/${WABA_API_VERSION}/${WABA_PHONE_NUMBER_ID}${path}`;
}

function sanitizeTemplateParam(value, maxLen = MAX_PARAM_LENGTH) {
  if (value == null) return "";
  let s = String(value);
  s = s.replace(/\uFEFF/g, "");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  s = s.replace(/\r\n|\r|\n/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

async function postTemplate(phoneE164, templateName, language, components) {
  const payload = {
    messaging_product: "whatsapp",
    to: phoneE164.replace("+", ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const res = await fetch(graphUrl("/messages"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WABA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return { res, data, payload };
}

function formatContactPhoneForTemplate(phone) {
  const digits = String(phone || SUPPORT_PHONE).replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2)}`;
  return sanitizeTemplateParam(phone || SUPPORT_PHONE);
}

/** login_passwrod (en_US): 2 body vars + URL button with text "login" */
function buildLoginPasswordComponents(password, contactPhone) {
  const pwd = sanitizeTemplateParam(password || DEFAULT_PASSWORD);
  const phone = formatContactPhoneForTemplate(contactPhone);

  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: pwd },
        { type: "text", text: phone },
      ],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: LOGIN_BUTTON_TEXT }],
    },
  ];
}

async function sendLoginPasswordTemplate(phoneE164, password) {
  const templateNames = [...new Set([...LOGIN_TEMPLATE_NAMES, "login_passwrod"])];
  const languages = LOGIN_LANGUAGES.length ? LOGIN_LANGUAGES : ["en_US"];

  let lastError = "Login password WhatsApp template failed";

  for (const templateName of templateNames) {
    for (const language of languages) {
      const components = buildLoginPasswordComponents(password, SUPPORT_PHONE);
      const { res, data } = await postTemplate(
        phoneE164,
        templateName,
        language,
        components
      );
      if (res.ok && data?.messages?.[0]?.id) {
        return {
          ok: true,
          messageId: data.messages[0].id,
          template: templateName,
          language,
        };
      }
      lastError = data?.error?.message || lastError;
    }
  }

  console.warn("Login password WhatsApp failed:", lastError);
  throw new Error(lastError);
}

/**
 * Send welcome + login password WhatsApp templates after registration approval.
 */
export async function sendAdmissionWhatsApp({ phone, name, email, password }) {
  if (!WABA_TOKEN || !WABA_PHONE_NUMBER_ID) {
    return { ok: false, skipped: true, reason: "whatsapp_not_configured" };
  }

  if (!phone) {
    return { ok: false, skipped: true, reason: "no_phone" };
  }

  const phoneE164 = toE164(phone);
  if (!/^\+[1-9]\d{10,14}$/.test(phoneE164)) {
    return { ok: false, skipped: true, reason: "invalid_phone", phoneE164 };
  }

  const result = { welcome: null, password: null, errors: [] };

  const welcomeLangs = WELCOME_LANGUAGES.length ? WELCOME_LANGUAGES : ["en"];

  for (const lang of welcomeLangs) {
    const { res, data } = await postTemplate(phoneE164, WELCOME_TEMPLATE, lang, [
      {
        type: "body",
        parameters: [
          { type: "text", text: sanitizeTemplateParam(name || "Student") },
          { type: "text", text: sanitizeTemplateParam(email || "") },
        ],
      },
    ]);
    if (res.ok && data?.messages?.[0]?.id) {
      result.welcome = { messageId: data.messages[0].id, language: lang };
      break;
    }
    result.errors.push(data?.error?.message || "Welcome template failed");
  }

  if (!result.welcome) {
    throw new Error(result.errors[0] || "Welcome WhatsApp message failed");
  }

  try {
    result.password = await sendLoginPasswordTemplate(phoneE164, password);
  } catch (err) {
    result.errors.push(err?.message || "Login password template failed");
  }

  return {
    ok: true,
    welcomeMessageId: result.welcome.messageId,
    passwordMessageId: result.password?.messageId || null,
    passwordTemplate: result.password?.template || null,
    partial: !result.password,
    passwordError: result.password ? null : result.errors[result.errors.length - 1] || null,
    triedLoginTemplates: LOGIN_TEMPLATE_NAMES,
    errors: result.errors.filter(Boolean),
  };
}
