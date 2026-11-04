import {
  normalizeMockSectionScores,
  normalizeMockSubSectionScores,
} from "@/lib/mockTests";

export const MOCK_RESULT_WA_TEMPLATE = "mock_test_marks_students";

function formatWhatsAppDate(value) {
  const d = value ? new Date(value) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function formatMarksPiece(label, earned, max, percent) {
  const e = Math.round(Number(earned) || 0);
  const m = Math.round(Number(max) || 0);
  const pct =
    percent != null && percent !== ""
      ? Math.round(Number(percent) || 0)
      : m > 0
        ? Math.round((e / m) * 100)
        : 0;
  return `${label}: ${e}/${m} (${pct}%)`;
}

function sectionScoresForRow(row) {
  return normalizeMockSectionScores(row?.sectionScores, row?.questionBreakdown);
}

function subSectionScoresForRow(row) {
  return normalizeMockSubSectionScores(row?.subSectionScores, row?.questionBreakdown);
}

function buildSubjectWiseMarksText(row) {
  const sections = Object.values(sectionScoresForRow(row))
    .filter((s) => Number(s.max) > 0)
    .sort((a, b) => String(a.section).localeCompare(String(b.section)));

  const subSections = Object.values(subSectionScoresForRow(row))
    .filter((s) => Number(s.max) > 0)
    .sort((a, b) => {
      const sec = String(a.section).localeCompare(String(b.section));
      if (sec !== 0) return sec;
      return String(a.subSection).localeCompare(String(b.subSection));
    });

  const meaningfulSubs = subSections.filter((s) => {
    const sub = String(s.subSection || "").trim();
    return sub && sub.toLowerCase() !== "general" && sub !== s.section;
  });

  if (meaningfulSubs.length > 0) {
    if (sections.length > 0) {
      return sections
        .map((sec) => {
          const sectionName = String(sec.section || "General").trim() || "General";
          const main = formatMarksPiece(sectionName, sec.earned, sec.max, sec.percent);
          const kids = meaningfulSubs.filter(
            (s) => String(s.section || "").trim() === sectionName
          );
          if (!kids.length) return main;
          const detail = kids
            .map((s) =>
              formatMarksPiece(
                String(s.subSection || "General").trim() || "General",
                s.earned,
                s.max,
                s.percent
              )
            )
            .join(", ");
          return `${main} [${detail}]`;
        })
        .join(" | ");
    }

    return meaningfulSubs
      .map((s) =>
        formatMarksPiece(
          s.label || `${s.section} › ${s.subSection}`,
          s.earned,
          s.max,
          s.percent
        )
      )
      .join(" | ");
  }

  if (sections.length > 0) {
    return sections
      .map((s) => formatMarksPiece(s.section || "General", s.earned, s.max, s.percent))
      .join(" | ");
  }

  if (subSections.length > 0) {
    return subSections
      .map((s) =>
        formatMarksPiece(s.label || s.section || s.subSection || "General", s.earned, s.max, s.percent)
      )
      .join(" | ");
  }

  const parts = [];
  if (Number(row.mcqTotal) > 0) {
    parts.push(
      formatMarksPiece(
        "MCQ",
        row.mcqCorrect ?? 0,
        row.mcqTotal,
        Math.round(((row.mcqCorrect || 0) / row.mcqTotal) * 100)
      )
    );
  }
  if (Number(row.codingMax) > 0) {
    parts.push(
      formatMarksPiece(
        "Coding",
        Math.round(row.codingScore || 0),
        row.codingMax,
        Math.round(((row.codingScore || 0) / row.codingMax) * 100)
      )
    );
  }
  return parts.join(" | ") || "No section scores available";
}

function buildOverallMarks(row) {
  const bySection = Object.values(sectionScoresForRow(row));
  let earned = bySection.reduce((sum, s) => sum + (Number(s.earned) || 0), 0);
  let max = bySection.reduce((sum, s) => sum + (Number(s.max) || 0), 0);
  if (max <= 0) {
    earned = (Number(row.mcqCorrect) || 0) + (Number(row.codingScore) || 0);
    max = (Number(row.mcqTotal) || 0) + (Number(row.codingMax) || 0);
  }
  return {
    earned: Math.round(earned * 10) / 10,
    max: Math.round(max * 10) / 10,
    percent:
      row.percent != null
        ? Math.round((Number(row.percent) || 0) * 10) / 10
        : max > 0
          ? Math.round((earned / max) * 1000) / 10
          : 0,
  };
}

/** Template mock_test_marks_students (English): {{1}} name, {{2}} test, {{3}} date, {{4}} subjects, {{5}} total, {{6}} % */
export function buildMockResultWhatsAppParams(row) {
  const overall = buildOverallMarks(row);
  return [
    String(row.name || "Student").trim() || "Student",
    String(row.testTitle || row.testId || "Mock Test").trim() || "Mock Test",
    formatWhatsAppDate(row.submittedAt),
    buildSubjectWiseMarksText(row),
    `${overall.earned}/${overall.max}`,
    String(overall.percent),
  ];
}

export function pickStudentPhone(data) {
  return String(data?.phone1 || data?.phone || data?.phone2 || data?.mobile || "").trim();
}
