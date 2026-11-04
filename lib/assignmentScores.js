export const ASSIGNMENT_PASS_PERCENT = 40;

/** Percent score for a course/internship assignment submission, or null when it has no auto score. */
export function assignmentPercent(sub) {
  if (!sub) return null;
  if (typeof sub.autoScore === "number" && !Number.isNaN(sub.autoScore)) return sub.autoScore;
  const ts = sub.testSummary;
  if (ts?.maxScore > 0 && ts.partialScore != null) return (ts.partialScore / ts.maxScore) * 100;
  if (ts?.totalCount > 0) return ((ts.passCount || 0) / ts.totalCount) * 100;
  return null;
}

export function normalizeMcqSelection(answer) {
  if (Array.isArray(answer)) return answer.map(Number);
  if (answer === undefined || answer === null || answer === "") return [];
  return [Number(answer)];
}

export function correctOptionIndexes(question) {
  if (Array.isArray(question?.correctAnswers)) return question.correctAnswers.map(Number);
  if (question?.correctAnswer !== undefined && question?.correctAnswer !== null) {
    return [Number(question.correctAnswer)];
  }
  return [];
}

/** Same partial-credit rule the student submit page uses: (correct − wrong) / correct options, floored at 0. */
export function mcqQuestionCredit(question, answer) {
  const correct = correctOptionIndexes(question);
  if (correct.length === 0) return null;
  const picked = normalizeMcqSelection(answer);
  if (picked.length === 0) return 0;
  if (!Array.isArray(question.correctAnswers)) return picked.includes(correct[0]) ? 1 : 0;
  let right = 0;
  let wrong = 0;
  for (const p of picked) (correct.includes(p) ? right++ : wrong++);
  return Math.max(0, (right - wrong) / correct.length);
}

export function resultLabel(sub) {
  const pct = assignmentPercent(sub);
  if (sub?.resultStatus === "success" || pct === 100) return "success";
  if (pct == null) return sub?.resultStatus || "submitted";
  if (pct >= ASSIGNMENT_PASS_PERCENT) return "pass";
  return "fail";
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.-]+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}
