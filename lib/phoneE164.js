/** Strip Excel / Firestore float artifacts (e.g. 9703589296.0). */
function stripFloatArtifact(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return s;
  if (/e\+?/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.trunc(n));
  }
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, "");
  }
  return s;
}

function digitsOnly(value) {
  return String(value).replace(/\D/g, "");
}

/** Normalize a phone number to E.164 (default India +91 for 10-digit numbers). */
export function toE164(phone) {
  let raw = stripFloatArtifact(phone);
  let cleaned = raw.startsWith("+") ? raw.slice(1) : raw;
  cleaned = cleaned.replace(/^00+/, "");
  cleaned = digitsOnly(cleaned);

  if (cleaned.length === 11 && cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;

  const indianMobile = cleaned.match(/(?:^91)?([6-9]\d{9})$/);
  if (indianMobile) return `+91${indianMobile[1]}`;

  return `+${cleaned}`;
}

/** WhatsApp `to` field: E.164 without the leading + */
export function toWhatsAppRecipientId(phone) {
  return toE164(phone).replace("+", "");
}

export function isValidIndianMobileE164(phoneE164) {
  return /^\+91[6-9]\d{9}$/.test(phoneE164);
}

export function isValidWhatsAppRecipientE164(phoneE164) {
  return /^\+[1-9]\d{10,14}$/.test(phoneE164);
}
