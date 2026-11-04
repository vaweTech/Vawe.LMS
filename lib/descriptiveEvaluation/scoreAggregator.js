import {
  DEFAULT_CONTENT_WEIGHT,
  DEFAULT_WRITING_WEIGHT,
  clampScore,
  round1,
} from "./constants.js";

export function safeComponent(score, maxScore) {
  const max = Number.isFinite(Number(maxScore)) && Number(maxScore) > 0 ? Number(maxScore) : 0;
  if (max <= 0) return 0;
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) return 0;
  return clampScore(n, max);
}

/**
 * Both component scores are already on the question max-mark scale.
 * final = content * wC + writing * wW
 */
export function combineQuestionScores({
  contentScore,
  writingScore,
  maxScore,
  contentWeight = DEFAULT_CONTENT_WEIGHT,
  writingWeight = DEFAULT_WRITING_WEIGHT,
}) {
  const max = Number.isFinite(Number(maxScore)) && Number(maxScore) > 0 ? Number(maxScore) : 0;
  const content = safeComponent(contentScore, max);
  const writing = safeComponent(writingScore, max);
  const cw = Number.isFinite(Number(contentWeight)) ? Number(contentWeight) : DEFAULT_CONTENT_WEIGHT;
  const ww = Number.isFinite(Number(writingWeight)) ? Number(writingWeight) : DEFAULT_WRITING_WEIGHT;
  const sum = cw + ww;
  const wC = sum > 0 ? cw / sum : DEFAULT_CONTENT_WEIGHT;
  const wW = sum > 0 ? ww / sum : DEFAULT_WRITING_WEIGHT;
  const finalScore = clampScore(content * wC + writing * wW, max);
  return { contentScore: content, writingScore: writing, finalScore, maxScore: max, contentWeight: wC, writingWeight: wW };
}

export function sumQuestionRows(rows, scoreKey = "score") {
  let score = 0;
  let maxScore = 0;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    score += Number(row?.[scoreKey]) || 0;
    maxScore += Number(row?.maxScore) || 0;
  });
  return { score: round1(score), maxScore: round1(maxScore) };
}
