import { scoreDescriptiveExam, scoreFromErrorCount, scoreOneAnswer } from "../descriptiveGrammarScore.js";
import { evaluateDescriptiveExam } from "./evaluateDescriptiveExam.js";
import { clampScore, round1 } from "./constants.js";

function normalizeTopicsFromUnknown(raw) {
  if (raw == null) return [];
  const out = [];
  const seen = new Set();
  const push = (t) => {
    const x = String(t || "").trim();
    if (!x) return;
    const k = x.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(x);
  };
  if (Array.isArray(raw)) {
    raw.forEach(push);
    return out;
  }
  String(raw)
    .split(/[,;|\n/]+/)
    .forEach(push);
  return out;
}

export function computeMcqFromExam(exam, answers) {
  let mcqCorrect = 0;
  let mcqTotal = 0;
  const mcqSectionScores = {};
  const mcqTopicScores = {};
  const mcqCompanyScores = {};

  (exam?.questions || []).forEach((q, i) => {
    if (!q || q.type !== "mcq") return;
    mcqTotal += 1;
    const sectionName = String(q?.section || "").trim() || "Unassigned";
    const ans = answers?.[i] ?? answers?.[String(i)];
    const corrArr = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
    let isCorrect = false;
    if (corrArr.length > 1) {
      const aSet = new Set(Array.isArray(ans) ? ans : []);
      const cSet = new Set(corrArr);
      if (aSet.size === cSet.size && [...aSet].every((x) => cSet.has(x))) isCorrect = true;
    } else if (corrArr.length === 1) {
      if (ans === corrArr[0]) isCorrect = true;
    } else if (typeof q.correctAnswer === "number") {
      if (ans === q.correctAnswer) isCorrect = true;
    }
    if (isCorrect) mcqCorrect += 1;
    if (!mcqSectionScores[sectionName]) mcqSectionScores[sectionName] = { correct: 0, total: 0, score: 0 };
    mcqSectionScores[sectionName].total += 1;
    if (isCorrect) {
      mcqSectionScores[sectionName].correct += 1;
      mcqSectionScores[sectionName].score += 1;
    }
    normalizeTopicsFromUnknown(q?.topics ?? q?.topic).forEach((tag) => {
      if (!mcqTopicScores[tag]) mcqTopicScores[tag] = { correct: 0, total: 0, score: 0 };
      mcqTopicScores[tag].total += 1;
      if (isCorrect) {
        mcqTopicScores[tag].correct += 1;
        mcqTopicScores[tag].score += 1;
      }
    });
    normalizeTopicsFromUnknown(q?.companyNames ?? q?.companyName).forEach((company) => {
      if (!mcqCompanyScores[company]) mcqCompanyScores[company] = { correct: 0, total: 0, score: 0 };
      mcqCompanyScores[company].total += 1;
      if (isCorrect) {
        mcqCompanyScores[company].correct += 1;
        mcqCompanyScores[company].score += 1;
      }
    });
  });

  return {
    correct: mcqCorrect,
    total: mcqTotal,
    score: mcqCorrect,
    sectionScores: mcqSectionScores,
    topicScores: mcqTopicScores,
    companyScores: mcqCompanyScores,
  };
}

export function computeCodingFromExam(exam, lastRunSummary) {
  let codingScore = 0;
  const codingQuestionDetails = [];
  (exam?.questions || []).forEach((q, i) => {
    if (!q || q.type !== "coding") return;
    const maxScore = Number.isFinite(Number(q.maxScore)) ? Number(q.maxScore) : 10;
    const summary = lastRunSummary?.[i] || lastRunSummary?.[String(i)] || {};
    const passCount = Number(summary.passCount) || 0;
    const total = Number(summary.total) || 0;
    const questionScore = total > 0 ? maxScore * (passCount / total) : 0;
    codingScore += questionScore;
    codingQuestionDetails.push({
      questionIndex: i,
      questionNumber: codingQuestionDetails.length + 1,
      passCount,
      totalTests: total,
      score: questionScore,
      maxScore,
    });
  });
  return { codingScore, codingQuestionDetails };
}

export function mergeLanguageToolWriting(questions, answers, ltByIndex) {
  const local = scoreDescriptiveExam(questions, answers);
  if (!ltByIndex) return local;
  const next = { ...local, questions: (local.questions || []).map((row) => ({ ...row })) };
  let score = 0;
  let errorCount = 0;
  next.questions.forEach((row) => {
    const lt = ltByIndex.get(row.questionIndex);
    if (!lt) {
      score += row.score;
      errorCount += row.errorCount;
      return;
    }
    const text = answers?.[row.questionIndex] != null ? String(answers[row.questionIndex]) : "";
    const words = text.trim().match(/[A-Za-z']+/g) || [];
    const errors = lt.errors;
    const writingScore = scoreFromErrorCount(row.maxScore, words.length, errors.length);
    row.errors = errors;
    row.errorCount = words.length === 0 ? 1 : errors.length;
    row.score = writingScore;
    row.wordCount = words.length;
    score += row.score;
    errorCount += row.errorCount;
  });
  next.score = round1(score);
  next.errorCount = errorCount;
  return next;
}

/**
 * Server-side scores. Client-provided descriptionScore / mcqScore are ignored.
 */
export function buildTrustedInterviewScores({ exam, answers, lastRunSummary, writingResult }) {
  const mcqScore = computeMcqFromExam(exam, answers);
  const { codingScore, codingQuestionDetails } = computeCodingFromExam(exam, lastRunSummary);
  const writing = writingResult || scoreDescriptiveExam(exam?.questions || [], answers);
  const evaluated = evaluateDescriptiveExam({
    questions: exam?.questions || [],
    answers,
    writingResult: writing,
    exam,
  });
  const descriptionPoints = Number(evaluated.descriptionScore?.score) || 0;
  const maxDescriptionScore = Number(evaluated.descriptionScore?.maxScore) || 0;
  const maxMcqScore = mcqScore.total;
  const maxCodingScore = (exam?.questions || [])
    .filter((q) => q?.type === "coding")
    .reduce((sum, q) => sum + (Number.isFinite(Number(q.maxScore)) ? Number(q.maxScore) : 10), 0);
  const totalScore = mcqScore.score + codingScore + descriptionPoints;
  const maxTotalScore = maxMcqScore + maxCodingScore + maxDescriptionScore;
  const percentage = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;
  return {
    mcqScore,
    codingScore,
    codingQuestionDetails,
    ...evaluated,
    totalScore: round1(totalScore),
    maxMcqScore,
    maxCodingScore,
    maxDescriptionScore,
    maxTotalScore,
    percentage,
  };
}

export function examTotalFromComponents(mcqScore, codingScore, descriptionScore) {
  const descMax = Number(descriptionScore?.maxScore) || 0;
  const desc = descMax > 0 ? Number(descriptionScore?.score) || 0 : 0;
  return (Number(mcqScore?.score) || 0) + (Number(codingScore) || 0) + desc;
}

export { scoreOneAnswer, clampScore };
