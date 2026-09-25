import { NextResponse } from "next/server";
import { scoreFromErrorCount, scoreOneAnswer } from "@/lib/descriptiveGrammarScore";

const COUNTED_CATEGORIES = new Set([
  "GRAMMAR",
  "TYPOS",
  "PUNCTUATION",
  "TYPOGRAPHY",
  "CONFUSED_WORDS",
  "CASING",
  "SEMANTICS",
]);

async function languageToolErrors(text) {
  const body = new URLSearchParams({
    text: String(text || "").slice(0, 4000),
    language: "en-US",
  });
  const res = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("LanguageTool unavailable");
  const data = await res.json();
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  const errors = [];
  for (const match of matches) {
    const category = String(match?.rule?.category?.id || "");
    if (!COUNTED_CATEGORIES.has(category)) continue;
    const message = String(match?.shortMessage || match?.message || "Writing error").trim();
    if (!message) continue;
    const type = category === "TYPOS" ? "spelling" : category === "GRAMMAR" ? "grammar" : "error";
    if (errors.some((e) => e.message === message)) continue;
    errors.push({ type, message });
    if (errors.length >= 12) break;
  }
  return errors;
}

export async function POST(req) {
  try {
    const payload = await req.json();
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, 30) : [];
    const questions = [];
    let score = 0;
    let maxScore = 0;
    let errorCount = 0;

    for (const item of items) {
      const text = String(item?.text || "");
      const max = Number.isFinite(Number(item?.maxScore)) && Number(item.maxScore) > 0 ? Number(item.maxScore) : 10;
      let row = scoreOneAnswer(text, max);
      const words = text.trim().match(/[A-Za-z']+/g) || [];
      if (words.length > 0) {
        try {
          const ltErrors = await languageToolErrors(text);
          row = {
            ...row,
            errors: ltErrors,
            errorCount: ltErrors.length,
            score: scoreFromErrorCount(max, words.length, ltErrors.length),
          };
        } catch {
          // Keep the local grammar and spelling check.
        }
      }
      score += row.score;
      maxScore += row.maxScore;
      errorCount += row.errorCount;
      questions.push({
        questionIndex: Number(item?.questionIndex) || questions.length,
        questionNumber: questions.length + 1,
        score: row.score,
        maxScore: row.maxScore,
        errorCount: row.errorCount,
        wordCount: row.wordCount,
        errors: row.errors,
      });
    }

    return NextResponse.json({
      score: Math.round(score * 10) / 10,
      maxScore,
      errorCount,
      questions,
    });
  } catch {
    return NextResponse.json({ error: "Could not score descriptive answers." }, { status: 400 });
  }
}
