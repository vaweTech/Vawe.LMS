/** Templates approved in Meta with language code `en` (not en_US). */
export const WHATSAPP_TEMPLATES_LANGUAGE_EN = new Set([
  "custom_message",
  "fee_update_notification",
]);

/** Pick the WhatsApp template language Meta expects for this template name. */
export function resolveWhatsAppTemplateLanguage(templateName, requestedLanguage) {
  const template = String(templateName || "").trim();
  if (WHATSAPP_TEMPLATES_LANGUAGE_EN.has(template)) {
    return "en";
  }
  if (template === "temporarily_blocked") {
    return "en_US";
  }
  const req = String(requestedLanguage || "").trim();
  if (req && req !== "en") return req;
  return "en_US";
}

/** Ordered language codes to try when Meta rejects the first attempt. */
export function getWhatsAppTemplateLanguageCandidates(templateName, requestedLanguage) {
  const template = String(templateName || "").trim();
  const primary = resolveWhatsAppTemplateLanguage(template, requestedLanguage);

  // Use only the approved language — alternate codes can return "accepted" but not deliver.
  return [primary];
}
