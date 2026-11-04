import { clampScore, round1 } from "./constants.js";
import { matchContradictions } from "./contradictionRules.js";
import { fuzzyPhraseMatch } from "./fuzzyMatcher.js";
import { evaluatePhraseRules } from "./phraseRules.js";
import { buildAliasMap, collectSearchTerms, matchAnyTerm } from "./synonymMatcher.js";
import { clipAnswer, normalizeForMatch, tokenize } from "./textNormalize.js";
import { MAX_ANSWER_CHARS } from "./constants.js";

function evidenceSnippet(text, phrase) {
  const raw = String(text || "");
  const idx = raw.toLowerCase().indexOf(String(phrase || "").toLowerCase().slice(0, 40));
  if (idx < 0) return String(phrase || "").slice(0, 120);
  const start = Math.max(0, idx - 24);
  return raw.slice(start, start + 120).trim();
}

/**
 * Score one answer against a validated rubric. Deterministic.
 */
export function matchRubric({ text, rubric, maxScore }) {
  const original = clipAnswer(text, MAX_ANSWER_CHARS);
  const haystack = normalizeForMatch(original);
  const tokens = tokenize(original);
  const blank = !haystack;

  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  const aliasMap = buildAliasMap(rubric?.synonyms, []);
  const globalHits = matchContradictions(haystack, rubric?.contradictions || []);

  const matched = [];
  const missing = [];
  const incorrect = [];
  let reviewRequired = false;
  let awarded = 0;

  if (blank) {
    criteria.forEach((c) => {
      missing.push({ id: c.id, label: c.label, marks: c.marks, reason: "No answer submitted" });
    });
    return {
      score: 0,
      maxScore: Number(maxScore) || 0,
      status: "ok",
      reviewRequired: false,
      matched,
      missing,
      incorrect,
      evidence: [],
    };
  }

  criteria.forEach((criterion) => {
    const terms = collectSearchTerms(criterion.keywords, criterion.synonyms, aliasMap);
    const exactHits = matchAnyTerm(haystack, terms);
    let fuzzyHits = [];
    if (exactHits.length === 0) {
      terms.forEach((term) => {
        const fz = fuzzyPhraseMatch(term, haystack);
        if (fz && fz.method === "fuzzy") fuzzyHits.push({ term, ...fz });
      });
    }

    const phrases = evaluatePhraseRules(haystack, criterion);
    const localMis = matchContradictions(haystack, criterion.misconceptions);
    const relatedGlobal = globalHits.hits.filter((h) => !h.criterionId || h.criterionId === criterion.id);
    const contradictions = [...localMis.hits, ...relatedGlobal];
    if (localMis.negatedMentions.length || globalHits.negatedMentions.some((n) => !n.criterionId || n.criterionId === criterion.id)) {
      reviewRequired = true;
    }

    const mentioned = exactHits.length > 0 || phrases.alternatives.length > 0 || phrases.required.length > 0;
    const fuzzyOnly = !mentioned && fuzzyHits.length > 0;
    const needPhrases =
      (criterion.requiredPhrases || []).length > 0 ||
      (criterion.alternativePhrases || []).length > 0 ||
      (criterion.explanationPhrases || []).length > 0;
    const explained = phrases.hasExplanation && phrases.requiredOk;

    let level = "none";
    if (mentioned && phrases.requiredOk) {
      if (criterion.requireExplanation && needPhrases && !explained) {
        level = "mention";
      } else {
        level = "full";
      }
    } else if (mentioned) {
      level = "mention";
    } else if (fuzzyOnly) {
      level = "mention";
    }

    let score = 0;
    if (level === "full") score = criterion.marks;
    else if (level === "mention") score = Math.min(criterion.mentionMarks, criterion.marks);

    if (contradictions.length > 0) {
      const penalty = contradictions.reduce((s, h) => {
        const p = h.penalty == null ? criterion.marks : h.penalty;
        return s + Math.max(0, p);
      }, 0);
      const applied = Math.min(penalty, criterion.marks);
      score = Math.max(0, score - applied);
      if (criterion.critical) score = 0;
      contradictions.forEach((h) => {
        incorrect.push({
          criterionId: criterion.id,
          ruleId: h.ruleId,
          phrase: h.phrase,
          snippet: evidenceSnippet(original, h.phrase),
          penaltyApplied: round1(Math.min(h.penalty == null ? criterion.marks : h.penalty, criterion.marks)),
        });
      });
      if (score <= 0) level = "incorrect";
    }

    score = clampScore(score, criterion.marks);
    awarded += score;

    const evidence = [];
    exactHits.forEach((h) => evidence.push({ type: "term", value: h.term, method: h.method }));
    fuzzyHits.forEach((h) => evidence.push({ type: "term", value: h.term, method: "fuzzy", distance: h.distance }));
    [...phrases.required, ...phrases.alternatives, ...phrases.explanation].forEach((h) => {
      evidence.push({ type: "phrase", value: h.phrase, method: "phrase", snippet: evidenceSnippet(original, h.phrase) });
    });

    if (level === "none" || (level === "mention" && score === 0)) {
      missing.push({
        id: criterion.id,
        label: criterion.label,
        marks: criterion.marks,
        reason: level === "none" ? "Concept not identified" : "Concept mentioned but marks withheld",
      });
    } else {
      matched.push({
        id: criterion.id,
        label: criterion.label,
        level,
        score,
        max: criterion.marks,
        evidence: evidence.slice(0, 8),
      });
      if (level === "mention") {
        missing.push({
          id: criterion.id,
          label: criterion.label,
          marks: round1(criterion.marks - score),
          reason: fuzzyOnly
            ? "Only a close spelling of the term was found; full explanation was not identified"
            : "Mentioned without the required explanation",
        });
      }
    }
  });

  return {
    score: clampScore(awarded, maxScore),
    maxScore: Number(maxScore) || 0,
    status: reviewRequired ? "review_required" : "ok",
    reviewRequired,
    matched,
    missing,
    incorrect,
  };
}
