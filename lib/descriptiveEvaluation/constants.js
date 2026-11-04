/** Deterministic descriptive content evaluation. No AI / remote content APIs. */

export const DESCRIPTIVE_EVALUATION_VERSION = "rule-content-v1";

export const SCORING_MODE_WRITING = "writing";
export const SCORING_MODE_COMBINED = "combined";

/** New combined assessments only. Existing exams default to writing-only. */
export const DEFAULT_CONTENT_WEIGHT = 0.8;
export const DEFAULT_WRITING_WEIGHT = 0.2;

export const MAX_ANSWER_CHARS = 8000;
export const MAX_PHRASE_LENGTH = 240;
export const MAX_CRITERIA = 20;
export const MAX_ALIASES_PER_TERM = 20;
export const MAX_ERRORS_RETAINED = 12;

export const NEGATION_TOKENS = [
  "not",
  "never",
  "no",
  "cannot",
  "cant",
  "can't",
  "doesnt",
  "doesn't",
  "dont",
  "don't",
  "isnt",
  "isn't",
  "wasnt",
  "wasn't",
  "without",
  "false",
  "incorrect",
  "wrong",
  "unlike",
  "instead",
  "rather",
];

export const FIELD_MEANING = {
  descriptionScore:
    "Legacy exam-total field. Writing-only on historical and writing-mode exams. Combined final (content+writing) on new combined-mode exams. Never add this together with descriptionContentScore in ranking.",
  descriptionWritingScore: "Writing quality only (grammar/spelling/punctuation). Same scale as question max marks.",
  descriptionContentScore: "Content correctness only. Absent on historical records that were never content-evaluated.",
  descriptionMaxScore: "Sum of descriptive question maxima.",
  descriptionEvaluationStatus:
    "ok | no_rubric | invalid_rubric | error | manual | review_required. Historical records omit this.",
  descriptionEvaluationVersion: "Evaluator code version, e.g. rule-content-v1.",
  descriptionRubricVersion: "Integer rubric version copied from the question at submit time.",
  descriptionReviewRequired: "True when rules are ambiguous or a rubric is missing in combined mode.",
};

export function round1(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

export function clampScore(n, max) {
  const cap = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 0;
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  if (cap <= 0) return 0;
  return round1(Math.min(cap, Math.max(0, v)));
}

export function resolveScoringMode(exam) {
  const raw = String(exam?.descriptiveScoringMode || exam?.descriptiveScoringPolicy || "").trim().toLowerCase();
  if (raw === SCORING_MODE_COMBINED || raw === "content-and-writing" || raw === "content") {
    return SCORING_MODE_COMBINED;
  }
  return SCORING_MODE_WRITING;
}

export function resolveWeights(exam, rubric) {
  const cw = Number(rubric?.contentWeight ?? exam?.descriptiveContentWeight ?? DEFAULT_CONTENT_WEIGHT);
  const ww = Number(rubric?.writingWeight ?? exam?.descriptiveWritingWeight ?? DEFAULT_WRITING_WEIGHT);
  const content = Number.isFinite(cw) && cw >= 0 && cw <= 1 ? cw : DEFAULT_CONTENT_WEIGHT;
  const writing = Number.isFinite(ww) && ww >= 0 && ww <= 1 ? ww : DEFAULT_WRITING_WEIGHT;
  const sum = content + writing;
  if (sum <= 0) return { contentWeight: DEFAULT_CONTENT_WEIGHT, writingWeight: DEFAULT_WRITING_WEIGHT };
  return { contentWeight: content / sum, writingWeight: writing / sum };
}
