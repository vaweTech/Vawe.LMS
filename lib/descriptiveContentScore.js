import { DESCRIPTIVE_EVALUATION_VERSION, clampScore, round1 } from "./descriptiveEvaluation/constants.js";
import { matchRubric } from "./descriptiveEvaluation/rubricMatcher.js";
import { validateRubric } from "./descriptiveEvaluation/validation.js";

/**
 * Content-correctness only. Independent of writing-quality scoring.
 */
export function scoreOneContentAnswer(text, question) {
  const maxScore =
    Number.isFinite(Number(question?.maxScore)) && Number(question.maxScore) > 0
      ? Number(question.maxScore)
      : 0;
  if (maxScore <= 0) {
    return {
      score: 0,
      maxScore: 0,
      status: "invalid_rubric",
      reviewRequired: true,
      rubricVersion: null,
      evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
      errors: ["Question maximum marks are missing or invalid."],
      matched: [],
      missing: [],
      incorrect: [],
      modelAnswer: "",
    };
  }

  const checked = validateRubric(question?.contentRubric || question?.rubric, maxScore);
  if (!checked.ok) {
    return {
      score: 0,
      maxScore,
      status: checked.errors[0] === "No content rubric configured." ? "no_rubric" : "invalid_rubric",
      reviewRequired: true,
      rubricVersion: checked.rubric?.version ?? null,
      evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
      errors: checked.errors,
      matched: [],
      missing: [],
      incorrect: [],
      modelAnswer: String(checked.rubric?.modelAnswer || ""),
    };
  }

  const matched = matchRubric({ text, rubric: checked.rubric, maxScore });
  return {
    score: clampScore(matched.score, maxScore),
    maxScore,
    status: matched.reviewRequired ? "review_required" : "ok",
    reviewRequired: Boolean(matched.reviewRequired),
    rubricVersion: checked.rubric.version,
    evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
    errors: [],
    matched: matched.matched,
    missing: matched.missing,
    incorrect: matched.incorrect,
    modelAnswer: checked.rubric.modelAnswer,
  };
}

export function scoreDescriptiveContentExam(questions, answers) {
  const details = [];
  let score = 0;
  let maxScore = 0;
  let reviewRequired = false;
  (Array.isArray(questions) ? questions : []).forEach((q, i) => {
    if (!q || q.type !== "descriptive") return;
    const text = answers && answers[i] != null ? String(answers[i]) : answers?.[String(i)] != null ? String(answers[String(i)]) : "";
    const row = scoreOneContentAnswer(text, q);
    score += row.score;
    maxScore += row.maxScore;
    if (row.reviewRequired) reviewRequired = true;
    details.push({
      questionIndex: i,
      questionNumber: details.length + 1,
      question: String(q.question || ""),
      answer: String(text || ""),
      ...row,
    });
  });
  return {
    score: round1(score),
    maxScore: round1(maxScore),
    reviewRequired,
    evaluationVersion: DESCRIPTIVE_EVALUATION_VERSION,
    questions: details,
  };
}
