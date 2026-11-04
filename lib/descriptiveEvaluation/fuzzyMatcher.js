/**
 * Conservative Levenshtein fuzzy match for known terms only.
 * Short technical tokens require an exact match.
 */

export const DEFAULT_FUZZY = {
  minLength: 5,
  distance1At: 5,
  distance2At: 10,
  maxDistance: 2,
};

export function levenshtein(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  const n = s.length;
  const m = t.length;
  if (!n) return m;
  if (!m) return n;
  if (Math.abs(n - m) > DEFAULT_FUZZY.maxDistance) return Math.abs(n - m);
  const row = new Array(m + 1);
  for (let j = 0; j <= m; j++) row[j] = j;
  for (let i = 1; i <= n; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= m; j++) {
      const tmp = row[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[m];
}

export function allowedDistance(termLen, config = DEFAULT_FUZZY) {
  const len = Number(termLen) || 0;
  if (len < config.minLength) return 0;
  if (len >= config.distance2At) return Math.min(2, config.maxDistance);
  if (len >= config.distance1At) return 1;
  return 0;
}

/**
 * Returns the first answer token that fuzzy-matches `term`, or null.
 * Does not award explanation-level evidence by itself.
 */
export function fuzzyTokenMatch(term, answerTokens, config = DEFAULT_FUZZY) {
  const want = String(term || "").trim().toLowerCase();
  if (!want) return null;
  const maxDist = allowedDistance(want.length, config);
  if (maxDist <= 0) {
    return answerTokens.includes(want) ? { token: want, distance: 0, method: "exact" } : null;
  }
  let best = null;
  for (const token of answerTokens) {
    if (token === want) return { token, distance: 0, method: "exact" };
    const d = levenshtein(want, token);
    if (d <= maxDist && token.length >= config.minLength - 1) {
      if (!best || d < best.distance) best = { token, distance: d, method: "fuzzy" };
    }
  }
  return best;
}

export function fuzzyPhraseMatch(phrase, haystackNorm, config = DEFAULT_FUZZY) {
  const words = String(phrase || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) {
    return fuzzyTokenMatch(words[0], haystackNorm.split(" ").filter(Boolean), config);
  }
  const answerTokens = haystackNorm.split(" ").filter(Boolean);
  const hits = words.map((w) => fuzzyTokenMatch(w, answerTokens, config));
  if (hits.every(Boolean)) {
    const dist = hits.reduce((s, h) => s + h.distance, 0);
    return { token: words.join(" "), distance: dist, method: dist === 0 ? "exact" : "fuzzy" };
  }
  return null;
}
