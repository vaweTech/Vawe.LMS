/**
 * Consistent Unicode / whitespace / hyphen normalization for rule matching.
 * Keeps digits, %, +, =, and letter characters. Does not treat distinct
 * technical terms as equivalent.
 */

export function normalizeForMatch(raw, { keepPunctuation = false } = {}) {
  let s = String(raw || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/['’`]/g, "'")
    .toLowerCase();
  s = s.replace(/&/g, " and ");
  if (!keepPunctuation) {
    s = s.replace(/[^a-z0-9%+=.\s'-]/g, " ");
    s = s.replace(/['.-]+/g, " ");
  }
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function tokenize(raw) {
  const norm = normalizeForMatch(raw);
  if (!norm) return [];
  return norm.split(" ").filter(Boolean);
}

export function padded(norm) {
  return ` ${norm} `;
}

export function clipAnswer(text, maxChars) {
  const s = String(text || "");
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars);
}

export function phraseToSearch(phrase) {
  return padded(normalizeForMatch(phrase));
}

export function hasPhrase(haystackNorm, phrase) {
  const needle = phraseToSearch(phrase);
  if (needle.trim().length < 2) return false;
  return padded(haystackNorm).includes(needle);
}

export function indexOfPhrase(haystackNorm, phrase) {
  const needle = phraseToSearch(phrase).trim();
  if (needle.length < 2) return -1;
  return padded(haystackNorm).indexOf(` ${needle} `);
}
