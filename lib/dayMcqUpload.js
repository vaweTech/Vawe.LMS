import Papa from "papaparse";

function getRowField(row, names) {
  if (!row || typeof row !== "object") return "";
  for (const name of names) {
    const target = String(name).toLowerCase().trim();
    for (const [key, value] of Object.entries(row)) {
      if (String(key || "").toLowerCase().trim() === target) {
        return value == null ? "" : String(value).trim();
      }
    }
  }
  return "";
}

function mapAnswerToIndices(answerCell, options) {
  if (answerCell == null) return [];
  const opts = (options || []).map((option) => String(option ?? "").trim());
  const indices = [];

  for (const token of String(answerCell)
    .split(/[,;|]+/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    const upper = token.toUpperCase();
    const letterIndex = "ABCDEF".indexOf(upper);
    if (letterIndex >= 0) {
      indices.push(letterIndex);
    } else if (/^\d+$/.test(token)) {
      const number = Number(token);
      if (number >= 1 && number <= opts.length) indices.push(number - 1);
      else if (number >= 0 && number < opts.length) indices.push(number);
    } else {
      const textIndex = opts.findIndex(
        (option) => option.toLowerCase() === token.toLowerCase()
      );
      if (textIndex >= 0) indices.push(textIndex);
    }
  }

  return [...new Set(indices.filter((index) => index >= 0 && index < opts.length))];
}

export function parseDayMcqRows(rows) {
  const questions = [];
  const errors = [];
  const optionColumns = [
    ["option1", "opt1", "option a", "a", "option_a"],
    ["option2", "opt2", "option b", "b", "option_b"],
    ["option3", "opt3", "option c", "c", "option_c"],
    ["option4", "opt4", "option d", "d", "option_d"],
    ["option5", "opt5", "option e", "e", "option_e"],
    ["option6", "opt6", "option f", "f", "option_f"],
  ];

  rows.forEach((row, index) => {
    const question = getRowField(row, ["question", "questions", "title", "q"]);
    if (!question) return;

    const options = optionColumns
      .map((names) => getRowField(row, names))
      .filter(Boolean);
    if (options.length < 2) {
      errors.push(`Row ${index + 2}: "${question.slice(0, 40)}" needs at least 2 options.`);
      return;
    }
    while (options.length < 4) options.push("");

    const answer = getRowField(row, [
      "answer",
      "answers",
      "correct",
      "correct answer",
      "correct answers",
      "right answer",
    ]);
    const correctAnswers = mapAnswerToIndices(answer, options);
    if (correctAnswers.length === 0) {
      errors.push(`Row ${index + 2}: "${question.slice(0, 40)}" has no matching answer.`);
    }

    questions.push({
      type: "mcq",
      question,
      description: getRowField(row, ["description", "desc", "explanation"]),
      options,
      correctAnswers,
      isMultiple: correctAnswers.length > 1,
      _uploadWarning:
        correctAnswers.length === 0
          ? "No matching correct answer — select it manually before saving."
          : "",
    });
  });

  return { questions, errors };
}

function triggerCsvDownload(rows, filename) {
  const csv = Papa.unparse(rows);
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDayMcqSampleCsv() {
  triggerCsvDownload(
    [
      {
        question: "What is the capital of France?",
        description: "Geography",
        option1: "Paris",
        option2: "London",
        option3: "Berlin",
        option4: "Madrid",
        answer: "Paris",
      },
      {
        question: "Which are programming languages?",
        description: "Multiple answers",
        option1: "Python",
        option2: "HTML",
        option3: "JavaScript",
        option4: "CSS",
        answer: "Python,JavaScript",
      },
    ],
    "day-mcq-sample.csv"
  );
}

/** Export day-wise / progress-test MCQs to CSV (upload-compatible columns). */
export function downloadDayMcqs(questions, filename = "day-mcqs.csv") {
  const mcqs = (Array.isArray(questions) ? questions : []).filter(
    (q) => (q?.type || "mcq") === "mcq" && String(q?.question || "").trim()
  );

  if (mcqs.length === 0) {
    alert("No MCQ questions to download.");
    return false;
  }

  const rows = mcqs.map((q) => {
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? "")) : [];
    while (options.length < 4) options.push("");
    const correct = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
    const answer = correct
      .map((idx) => options[idx])
      .filter((text) => String(text || "").trim())
      .join(",");

    return {
      question: String(q.question || "").trim(),
      description: String(q.description || q.explanation || "").trim(),
      option1: options[0] || "",
      option2: options[1] || "",
      option3: options[2] || "",
      option4: options[3] || "",
      ...(options[4] ? { option5: options[4] } : {}),
      ...(options[5] ? { option6: options[5] } : {}),
      answer,
    };
  });

  const safeName = String(filename || "day-mcqs.csv")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
  triggerCsvDownload(rows, safeName.endsWith(".csv") ? safeName : `${safeName}.csv`);
  return true;
}
