import { jsPDF } from "jspdf";
import {
  loadVaweLogoBase64,
  buildScorecardFileName,
} from "@/lib/interviewScorecardPdf";
import {
  normalizeMockSectionScores,
  normalizeMockSubSectionScores,
} from "@/lib/mockTests";

let cachedServerLogoBase64 = null;

function getServerLogoBase64() {
  if (cachedServerLogoBase64) return cachedServerLogoBase64;
  if (typeof window !== "undefined") return null;
  try {
    // Lazy require so this module stays safe to import from client components.
    const { readFileSync } = require("fs");
    const { join } = require("path");
    const candidates = ["vawe-emblem.png", "vawe-emblem-nav.png", "vawe-logo.png", "logo1.png"];
    for (const name of candidates) {
      try {
        const logoPath = join(process.cwd(), "public", name);
        cachedServerLogoBase64 = readFileSync(logoPath).toString("base64");
        return cachedServerLogoBase64;
      } catch {
        /* try next */
      }
    }
  } catch {
    return null;
  }
  return null;
}

const COLORS = {
  pageBg: [241, 245, 249],
  white: [255, 255, 255],
  gray200: [229, 231, 235],
  gray300: [209, 213, 219],
  gray500: [100, 116, 139],
  gray600: [71, 85, 105],
  gray800: [30, 41, 59],
  brand: [0, 68, 138],
  brandSoft: [232, 242, 252],
  cyan: [8, 145, 178],
  emerald: [5, 150, 105],
  emeraldDark: [4, 120, 87],
  blue: [37, 99, 235],
  blueDark: [29, 78, 216],
};

function formatDateTime(date = new Date()) {
  try {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date || "");
  }
}

function performanceLabel(percent) {
  const p = Number(percent) || 0;
  if (p >= 80) return "Excellent";
  if (p >= 60) return "Good";
  if (p >= 40) return "Average";
  return "Needs Improvement";
}

function drawWatermark(doc, pageW, pageH, logoBase64) {
  if (logoBase64) {
    try {
      if (typeof doc.GState === "function") {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.06 }));
      }
      const size = Math.min(pageW, pageH) * 0.5;
      doc.addImage(logoBase64, "PNG", (pageW - size) / 2, (pageH - size) / 2, size, size);
      if (typeof doc.restoreGraphicsState === "function") {
        doc.restoreGraphicsState();
      }
      return;
    } catch {
      /* fall through */
    }
  }
  doc.setTextColor(220, 228, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(64);
  doc.text("VAWE", pageW / 2, pageH / 2, { align: "center", angle: 32 });
}

function applyWatermarks(doc, logoBase64) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    drawWatermark(doc, pageW, pageH, logoBase64);
  }
}

function drawSectionTitle(doc, x, y, title) {
  doc.setFillColor(...COLORS.brand);
  doc.rect(x, y, 3, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.gray800);
  doc.text(title, x + 6, y + 5);
  return y + 11;
}

function drawKvTable(doc, x, y, w, rows) {
  const rowH = 8;
  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.brandSoft);
      doc.rect(x, y, w, rowH, "F");
    }
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, rowH, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray500);
    doc.text(String(row.label || ""), x + 3, y + 5.2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.gray800);
    const valueLines = doc.splitTextToSize(String(row.value ?? "—"), w * 0.58);
    doc.text(valueLines[0] || "—", x + w * 0.38, y + 5.2);
    y += rowH;
  });
  return y;
}

function drawSimpleTable(doc, x, y, w, headers, rows, headerRgb = COLORS.brand) {
  const colW = w / headers.length;
  const headerH = 8;
  doc.setFillColor(...headerRgb);
  doc.rect(x, y, w, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.white);
  headers.forEach((h, i) => {
    doc.text(String(h), x + i * colW + 2.5, y + 5.3);
  });
  y += headerH;

  rows.forEach((row, rowIndex) => {
    const rowH = 8;
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(x, y, w, rowH, "F");
    }
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, rowH, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.gray800);
    row.forEach((cell, i) => {
      const text = String(cell ?? "—");
      const clipped = doc.splitTextToSize(text, colW - 4)[0] || "—";
      doc.text(clipped, x + i * colW + 2.5, y + 5.3);
    });
    y += rowH;
  });
  return y + 2;
}

function sectionRowsFromSubmission(row) {
  const map = normalizeMockSectionScores(row?.sectionScores, row?.questionBreakdown);
  return Object.values(map).map((s) => [
    s.section || "General",
    String(Math.round(Number(s.earned) || 0)),
    String(Math.round(Number(s.max) || 0)),
    `${Math.round(Number(s.percent) || 0)}%`,
  ]);
}

function subSectionRowsFromSubmission(row) {
  const map = normalizeMockSubSectionScores(row?.subSectionScores, row?.questionBreakdown);
  return Object.values(map)
    .sort((a, b) => {
      const sec = String(a.section || "").localeCompare(String(b.section || ""));
      if (sec !== 0) return sec;
      return String(a.subSection || "").localeCompare(String(b.subSection || ""));
    })
    .map((s) => [
      s.section || "General",
      s.subSection || "General",
      String(Math.round(Number(s.earned) || 0)),
      String(Math.round(Number(s.max) || 0)),
      `${Math.round(Number(s.percent) || 0)}%`,
    ]);
}

const IMPROVE_THRESHOLD = 60;

function buildImprovementAreas(row) {
  const areas = [];
  const sections = Object.values(
    normalizeMockSectionScores(row?.sectionScores, row?.questionBreakdown)
  );
  const subs = Object.values(
    normalizeMockSubSectionScores(row?.subSectionScores, row?.questionBreakdown)
  );

  const weakSubs = [...subs]
    .filter((s) => Number(s.max) > 0)
    .sort((a, b) => (Number(a.percent) || 0) - (Number(b.percent) || 0))
    .filter((s) => (Number(s.percent) || 0) < IMPROVE_THRESHOLD);

  if (weakSubs.length) {
    weakSubs.slice(0, 6).forEach((s) => {
      const pct = Math.round(Number(s.percent) || 0);
      const label = `${s.section || "General"} › ${s.subSection || "General"}`;
      areas.push([
        label,
        `${pct}%`,
        pct < 40
          ? "Needs focused practice — revise basics and attempt more drills"
          : "Practice more questions in this topic to strengthen accuracy",
      ]);
    });
  } else {
    const weakSecs = [...sections]
      .filter((s) => Number(s.max) > 0)
      .sort((a, b) => (Number(a.percent) || 0) - (Number(b.percent) || 0))
      .filter((s) => (Number(s.percent) || 0) < IMPROVE_THRESHOLD);
    weakSecs.slice(0, 4).forEach((s) => {
      const pct = Math.round(Number(s.percent) || 0);
      areas.push([
        s.section || "General",
        `${pct}%`,
        pct < 40
          ? "Needs focused practice — revise this section thoroughly"
          : "Improve accuracy with timed practice in this section",
      ]);
    });
  }

  const codingMax = Number(row.codingMax) || 0;
  const codingScore = Number(row.codingScore) || 0;
  if (codingMax > 0) {
    const codingPct = Math.round((codingScore / codingMax) * 100);
    if (codingPct < IMPROVE_THRESHOLD) {
      areas.push([
        "Coding",
        `${codingPct}%`,
        "Practice coding problems and debug with more test cases",
      ]);
    }
  }

  if (!areas.length) {
    const overall = Math.round(Number(row.percent) || 0);
    if (overall < IMPROVE_THRESHOLD) {
      areas.push([
        "Overall performance",
        `${overall}%`,
        "Revise all sections and take another timed mock soon",
      ]);
    } else {
      areas.push([
        "Keep improving",
        `${overall}%`,
        "Strong attempt — polish weaker questions and maintain consistency",
      ]);
    }
  }

  return areas;
}

/**
 * Build a VAWE-branded mock-test scorecard PDF for one candidate attempt.
 */
export function buildMockTestScorecardPdf(row = {}, meta = {}) {
  const {
    companyLabel = "Mock Test",
    logoBase64 = null,
    generatedAt = row.submittedAt || new Date(),
  } = meta;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      doc.setFillColor(...COLORS.pageBg);
      doc.rect(0, 0, pageW, pageH, "F");
      y = margin;
    }
  };

  doc.setFillColor(...COLORS.pageBg);
  doc.rect(0, 0, pageW, pageH, "F");

  const rawLabel = String(companyLabel || "").trim();
  const mainTitle = !rawLabel
    ? "Mock Test"
    : /mock\s*test/i.test(rawLabel)
      ? rawLabel
      : `${rawLabel} MOCK TEST`;

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.gray300);
  doc.setLineWidth(0.35);
  const headerH = 48;
  doc.roundedRect(margin, y, contentW, headerH, 3, 3, "FD");

  const pad = 10;
  const leftX = margin + pad;
  const rightX = margin + contentW - pad;
  const logoSize = 16;
  const brandRowY = y + 7;
  const logoY = brandRowY;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", leftX, logoY, logoSize, logoSize);
    } catch {
      /* ignore */
    }
  }

  const brandX = logoBase64 ? leftX + logoSize + 4 : leftX;
  // Vertically center VAWE + subtitle next to the logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.brand);
  doc.text("VAWE", brandX, logoY + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray500);
  doc.text("Mock Test Scorecard", brandX, logoY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(`Generated: ${formatDateTime(new Date())}`, rightX, logoY + 9, {
    align: "right",
  });

  // Divider between brand row and title
  const dividerY = logoY + logoSize + 4;
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(leftX, dividerY, rightX, dividerY);

  // Centered main test name (company mock test only — no paper number)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.brand);
  const titleLines = doc.splitTextToSize(mainTitle, contentW - pad * 2).slice(0, 2);
  const titleBlockH = titleLines.length * 5.5;
  const titleY = dividerY + (headerH - (dividerY - y) - titleBlockH) / 2 + 4;
  doc.text(titleLines, margin + contentW / 2, titleY, { align: "center" });

  y += headerH + 6;

  ensureSpace(40);
  y = drawSectionTitle(doc, margin, y, "Candidate Details");
  const detailRows = [
    { label: "Name", value: row.name || "—" },
    { label: "Email", value: row.email || "—" },
    { label: "Phone", value: row.phone || "—" },
    { label: "College", value: row.college || "—" },
    { label: "Branch", value: row.branch || "—" },
    { label: "Submitted", value: formatDateTime(generatedAt) },
  ].filter((r) => r.value && r.value !== "—");
  if (!detailRows.some((r) => r.label === "Name")) {
    detailRows.unshift({ label: "Name", value: row.name || "—" });
  }
  y = drawKvTable(doc, margin, y, contentW, detailRows);
  y += 5;

  const percent = Math.round(Number(row.percent) || 0);
  const mcqCorrect = Number(row.mcqCorrect) || 0;
  const mcqTotal = Number(row.mcqTotal) || 0;
  const codingScore = Number(row.codingScore) || 0;
  const codingMax = Number(row.codingMax) || 0;

  ensureSpace(40);
  y = drawSectionTitle(doc, margin, y, "Overall Score Summary");
  y = drawSimpleTable(
    doc,
    margin,
    y,
    contentW,
    ["Metric", "Score", "Details"],
    [
      [
        "Total",
        `${percent}%`,
        performanceLabel(percent),
      ],
      [
        "MCQ",
        `${mcqCorrect} / ${mcqTotal}`,
        mcqTotal ? `${Math.round((mcqCorrect / mcqTotal) * 100)}% correct` : "—",
      ],
      [
        "Coding",
        codingMax ? `${Math.round(codingScore)} / ${codingMax}` : "—",
        codingMax ? `${Math.round((codingScore / codingMax) * 100)}%` : "No coding",
      ],
    ],
    COLORS.blueDark
  );
  y += 3;

  const sectionRows = sectionRowsFromSubmission(row);
  if (sectionRows.length) {
    ensureSpace(24 + sectionRows.length * 8);
    y = drawSectionTitle(doc, margin, y, "Section-wise Scores");
    y = drawSimpleTable(
      doc,
      margin,
      y,
      contentW,
      ["Section", "Score", "Total", "%"],
      sectionRows,
      COLORS.emeraldDark
    );
    y += 2;
  }

  const subRows = subSectionRowsFromSubmission(row);
  if (subRows.length) {
    ensureSpace(24 + subRows.length * 8);
    y = drawSectionTitle(doc, margin, y, "Sub-section-wise Scores");
    y = drawSimpleTable(
      doc,
      margin,
      y,
      contentW,
      ["Section", "Sub-section", "Score", "Total", "%"],
      subRows,
      COLORS.cyan
    );
    y += 2;
  }

  const improvementRows = buildImprovementAreas(row);
  if (improvementRows.length) {
    ensureSpace(24 + improvementRows.length * 8);
    y = drawSectionTitle(doc, margin, y, "Where you need to improve");
    y = drawSimpleTable(
      doc,
      margin,
      y,
      contentW,
      ["Area", "Score", "Suggestion"],
      improvementRows,
      [180, 83, 9]
    );
    y += 2;
  }

  ensureSpace(16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(
    "This is a system-generated scorecard from VAWE. For queries, contact the administrator.",
    margin,
    y + 4
  );

  applyWatermarks(doc, logoBase64);
  return doc;
}

export function getMockTestScorecardFileName(row = {}) {
  return buildScorecardFileName(
    row?.name || "student",
    row?.submittedAt || new Date()
  ).replace(/^scorecard-/, "mock-scorecard-");
}

/** Server/client PDF bytes for WhatsApp document header. */
export function buildMockTestScorecardPdfBuffer(row = {}, meta = {}) {
  const logoBase64 = meta.logoBase64 ?? getServerLogoBase64();
  const doc = buildMockTestScorecardPdf(row, {
    ...meta,
    logoBase64,
  });
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export async function downloadMockTestScorecardPdf(row, meta = {}) {
  const logoBase64 = meta.logoBase64 ?? (await loadVaweLogoBase64());
  const doc = buildMockTestScorecardPdf(row, {
    ...meta,
    logoBase64,
  });
  const fileName = getMockTestScorecardFileName(row);
  doc.save(fileName);
  return fileName;
}
