import { scoreDescriptiveExam } from "../descriptiveGrammarScore.js";
import { scoreDescriptiveContentExam } from "../descriptiveContentScore.js";
import {
  DESCRIPTIVE_EVALUATION_VERSION,
  SCORING_MODE_COMBINED,
  resolveScoringMode,
  resolveWeights,
  round1,
} from "./constants.js";
import { combineQuestionScores } from "./scoreAggregator.js";
import { validateRubric } from "./validation.js";

function writingByIndex(writing) {
  const map = new Map();
  (writing.questions || []).forEach((row) => {
    map.set(row.questionIndex, row);
  });
  return map;
}

function contentByIndex(content) {
  const map = new Map();
  (content.questions || []).forEach((row) => {
    map.set(row.questionIndex, row);
  });
  return map;
}

/**
 * Combines writing-quality (existing grammar scorer) with content evaluation.
 *
 * Ranking field `descriptionScore.score`:
 * - writing mode (default, all existing exams): writing-only, same meaning as before.
 * - combined mode (explicit exam setting): content*0.8 + writing*0.2 per question.
 *
 * Never add descriptionContentScore on top of descriptionScore in exam totals.
 */
export function evaluateDescriptiveExam({ questions, answers, writingResult, exam }) {
  const writing = writingResult || scoreDescriptiveExam(questions, answers);
  const content = scoreDescriptiveContentExam(questions, answers);
  const mode = resolveScoringMode(exam);
  const wMap = writingByIndex(writing);
  const cMap = contentByIndex(content);

  const rows = [];
  (Array.isArray(questions) ? questions : []).forEach((q, i) => {
    if (!q || q.type !== "descriptive") return;
    const w = wMap.get(i) || { score: 0, maxScore: 10, errorCount: 1, wordCount: 0, errors: [], question: "", answer: "" };
    const c = cMap.get(i) || { score: 0, maxScore: w.maxScore, status: "error", reviewRequired: true };
    const maxScore = Number(c.maxScore) || Number(w.maxScore) || 10;
    const hasRubric = validateRubric(q.contentRubric || q.rubric, maxScore).ok;
    const useCombined = mode === SCORING_MODE_COMBINED && hasRubric;
    const weights = resolveWeights(exam, q.contentRubric || q.rubric);
    const combined = combineQuestionScores({
      contentScore: c.score,
      writingScore: w.score,
      maxScore,
      contentWeight: weights.contentWeight,
      writingWeight: weights.writingWeight,
    });
    const finalScore = useCombined ? combined.finalScore : w.score;
    rows.push({
      questionIndex: i,
      questionNumber: rows.length + 1,
      question: String(c.question || q.question || w.question || ""),
      answer: answers?.[i] != null ? String(answers[i]) : answers?.[String(i)] != null ? String(answers[String(i)]) : String(w.answer || ""),
      score: finalScore,
      maxScore,
      errorCount: w.errorCount || 0,
      wordCount: w.wordCount || 0,
      errors: Array.isArray(w.errors) ? w.errors : [],
      writingScore: combined.writingScore,
      contentScore: hasRubric ? combined.contentScore : null,
      contentStatus: c.status,
      contentWeight: useCombined ? combined.contentWeight : null,
      writingWeight: useCombined ? combined.writingWeight : null,
      scoringMode: useCombined ? SCORING_MODE_COMBINED : "writing",
      matched: c.matched || [],
      missing: c.missing || [],
      incorrect: c.incorrect || [],
      modelAnswer: hasRubric ? c.modelAnswer || "" : "",
      reviewRequired: Boolean(c.reviewRequired) && useCombined,
      evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
      rubricVersion: c.rubricVersion ?? null,
      evaluationStatus: useCombined ? c.status : "writing_only",
    });
  });

  const score = round1(rows.reduce((s, r) => s + (Number(r.score) || 0), 0));
  const maxScore = round1(rows.reduce((s, r) => s + (Number(r.maxScore) || 0), 0));
  const writingTotal = round1(rows.reduce((s, r) => s + (Number(r.writingScore) || 0), 0));
  const contentTotal = round1(rows.reduce((s, r) => s + (Number(r.contentScore) || 0), 0));
  const reviewRequired = rows.some((r) => r.reviewRequired);
  const errorCount = rows.reduce((s, r) => s + (Number(r.errorCount) || 0), 0);

  return {
    scoringMode: mode,
    evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
    descriptionScore: {
      score,
      maxScore,
      errorCount,
      questions: rows,
      scoringMode: mode,
      evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
    },
    descriptionWritingScore: {
      score: writingTotal,
      maxScore,
      errorCount,
      questions: writing.questions || [],
    },
    descriptionContentScore: {
      score: contentTotal,
      maxScore,
      reviewRequired,
      evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
      questions: content.questions || [],
    },
    descriptionMaxScore: maxScore,
    descriptionEvaluationStatus: reviewRequired ? "review_required" : mode === SCORING_MODE_COMBINED ? "ok" : "writing_only",
    descriptionEvaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
    descriptionReviewRequired: reviewRequired,
  };
}
