import { MAX_PHRASE_LENGTH } from "./constants.js";
import { hasPhrase, normalizeForMatch } from "./textNormalize.js";

export function cleanPhraseList(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((p) => {
    const n = normalizeForMatch(p);
    if (!n || n.length < 3 || n.length > MAX_PHRASE_LENGTH) return;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

export function matchPhrases(haystackNorm, phrases) {
  const hits = [];
  cleanPhraseList(phrases).forEach((p) => {
    if (hasPhrase(haystackNorm, p)) hits.push({ phrase: p, method: "phrase" });
  });
  return hits;
}

/**
 * Alternative phrases are OR: any one is enough.
 * Required phrases are AND: all must match.
 */
export function evaluatePhraseRules(haystackNorm, criterion) {
  const required = matchPhrases(haystackNorm, criterion.requiredPhrases);
  const alternatives = matchPhrases(haystackNorm, criterion.alternativePhrases);
  const optional = matchPhrases(haystackNorm, criterion.optionalPhrases);
  const explanation = matchPhrases(haystackNorm, criterion.explanationPhrases);
  const requiredList = cleanPhraseList(criterion.requiredPhrases);
  const altList = cleanPhraseList(criterion.alternativePhrases);
  const requiredOk = requiredList.length === 0 || required.length === requiredList.length;
  const alternativeOk = altList.length === 0 || alternatives.length > 0;
  return {
    required,
    alternatives,
    optional,
    explanation,
    requiredOk,
    alternativeOk,
    hasExplanation: explanation.length > 0 || alternatives.length > 0,
  };
}
