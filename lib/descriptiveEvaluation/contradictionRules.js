import { NEGATION_TOKENS } from "./constants.js";
import { indexOfPhrase, normalizeForMatch, padded, tokenize } from "./textNormalize.js";
import { cleanPhraseList } from "./phraseRules.js";

function windowHasNegation(haystackNorm, phraseIndex) {
  if (phraseIndex < 0) return false;
  const start = Math.max(0, phraseIndex - 48);
  const window = padded(haystackNorm).slice(start, phraseIndex + 1);
  const tokens = tokenize(window);
  return tokens.some((t) => NEGATION_TOKENS.includes(t));
}

/**
 * Matches configured misconceptions. If the candidate explicitly negates the
 * claim, no penalty is applied. Ambiguous mixed cases set reviewRequired.
 */
export function matchContradictions(haystackNorm, rules) {
  const hits = [];
  const ambiguous = [];
  (Array.isArray(rules) ? rules : []).forEach((rule) => {
    if (!rule) return;
    const phrases = cleanPhraseList(rule.phrases);
    const allowNegation = rule.allowNegation !== false;
    phrases.forEach((phrase) => {
      const idx = indexOfPhrase(haystackNorm, phrase);
      if (idx < 0) return;
      const negated = allowNegation && windowHasNegation(haystackNorm, idx);
      const entry = {
        ruleId: String(rule.id || phrase),
        phrase,
        criterionId: rule.criterionId || null,
        penalty: Number.isFinite(Number(rule.penalty)) ? Number(rule.penalty) : null,
        negated,
      };
      if (negated) {
        ambiguous.push(entry);
      } else {
        hits.push(entry);
      }
    });
  });
  const uniqueHits = [];
  const seen = new Set();
  hits.forEach((h) => {
    const key = `${h.ruleId}:${h.phrase}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueHits.push(h);
  });
  return { hits: uniqueHits, negatedMentions: ambiguous };
}
