import { jsPDF } from "jspdf";

const COLORS = {
  pageBg: [241, 245, 249],
  white: [255, 255, 255],
  gray100: [243, 244, 246],
  gray200: [229, 231, 235],
  gray300: [209, 213, 219],
  gray500: [100, 116, 139],
  gray600: [71, 85, 105],
  gray800: [30, 41, 59],
  gray900: [17, 24, 39],
  cyan700: [12, 74, 110],
  cyan600: [8, 145, 178],
  emerald50: [236, 253, 245],
  emerald600: [5, 150, 105],
  emerald700: [4, 120, 87],
  blue50: [239, 246, 255],
  blue600: [37, 99, 235],
  blue700: [29, 78, 216],
  amber50: [255, 251, 235],
  amber700: [180, 83, 9],
  green600: [22, 163, 74],
  yellow600: [202, 138, 4],
  orange600: [234, 88, 12],
  red600: [220, 38, 38],
};

function topicTagAccuracyPercent(correct, total) {
  const c = Number(correct);
  const t = Number(total);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.round((c / t) * 100);
}

function performanceLabel(percentage) {
  const p = Number(percentage) || 0;
  if (p >= 80) return "Excellent";
  if (p >= 60) return "Good";
  if (p >= 40) return "Average";
  return "Needs Improvement";
}

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
    return String(date);
  }
}

function drawWatermark(doc, pageW, pageH, logoBase64) {
  if (logoBase64) {
    try {
      if (typeof doc.GState === "function") {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.06 }));
      }
      const size = Math.min(pageW, pageH) * 0.55;
      doc.addImage(
        logoBase64,
        "PNG",
        (pageW - size) / 2,
        (pageH - size) / 2,
        size,
        size
      );
      if (typeof doc.restoreGraphicsState === "function") {
        doc.restoreGraphicsState();
      }
      return;
    } catch {
      // Fall through to text watermark.
    }
  }
  doc.setTextColor(220, 228, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(72);
  doc.text("VAWE", pageW / 2, pageH / 2, { align: "center", angle: 35 });
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

function drawSectionTitle(doc, x, y, title, accentRgb) {
  doc.setFillColor(...accentRgb);
  doc.rect(x, y, 3, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.gray800);
  doc.text(title, x + 6, y + 5);
  return y + 10;
}

function normalizeColWidths(columns, totalWidth) {
  const raw = columns.map((c) => Number(c.widthPct) || 1 / columns.length);
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  let used = 0;
  return raw.map((pct, index) => {
    if (index === raw.length - 1) return totalWidth - used;
    const w = (pct / sum) * totalWidth;
    used += w;
    return w;
  });
}

function textAnchorX(colX, colW, align, padding = 3) {
  if (align === "center") return colX + colW / 2;
  if (align === "right") return colX + colW - padding;
  return colX + padding;
}

function drawCellText(doc, text, colX, colW, y, rowH, align, fontSize) {
  const padding = 3;
  const maxW = colW - padding * 2;
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(String(text ?? "—"), maxW);
  const lineH = 4;
  const blockH = Math.max(rowH, lines.length * lineH + 2);
  const startY = y + (blockH - lines.length * lineH) / 2 + 3.5;
  lines.forEach((line, i) => {
    doc.text(line, textAnchorX(colX, colW, align, padding), startY + i * lineH, {
      align: align || "left",
    });
  });
  return blockH;
}

function drawKeyValueTable(doc, x, y, width, rows) {
  const rowH = 8;
  const labelW = width * 0.34;
  let rowY = y;

  rows.forEach((row, index) => {
    const bg = index % 2 === 0 ? COLORS.gray100 : COLORS.white;
    doc.setFillColor(...bg);
    doc.rect(x, rowY, width, rowH, "F");
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.2);
    doc.rect(x, rowY, width, rowH, "S");
    doc.line(x + labelW, rowY, x + labelW, rowY + rowH);

    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray600);
    doc.text(String(row.label), x + 3, rowY + 5.5);

    doc.setTextColor(...(row.valueColor || COLORS.gray900));
    const valueLines = doc.splitTextToSize(String(row.value ?? "—"), width - labelW - 6);
    doc.text(valueLines[0] || "—", x + labelW + 3, rowY + 5.5);

    rowY += rowH;
  });

  return rowY;
}

function drawDataTable(doc, x, y, width, columns, rows, options = {}) {
  const {
    headerBg = COLORS.cyan700,
    headerColor = COLORS.white,
    baseRowH = 8,
    fontSize = 8.5,
    margin = 14,
  } = options;

  const colWidths = normalizeColWidths(columns, width);
  let cursorY = y;

  const ensureSpace = (needed) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (cursorY + needed > pageH - margin) {
      doc.addPage();
      doc.setFillColor(...COLORS.pageBg);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), pageH, "F");
      cursorY = margin;
    }
  };

  const drawRow = (cells, isHeader, rowIndex = 0) => {
    let rowH = baseRowH;
    const measured = cells.map((cell, i) => {
      const lines = doc.splitTextToSize(String(cell ?? "—"), colWidths[i] - 6);
      return Math.max(baseRowH, lines.length * 4 + 3);
    });
    rowH = Math.max(...measured);

    ensureSpace(rowH + 2);
    let colX = x;
    cells.forEach((cell, i) => {
      const bg = isHeader
        ? headerBg
        : rowIndex % 2 === 0
          ? COLORS.white
          : COLORS.gray100;
      doc.setFillColor(...bg);
      doc.rect(colX, cursorY, colWidths[i], rowH, "F");
      doc.setDrawColor(...COLORS.gray300);
      doc.setLineWidth(0.2);
      doc.rect(colX, cursorY, colWidths[i], rowH, "S");

      doc.setFont("helvetica", isHeader ? "bold" : "normal");
      doc.setTextColor(...(isHeader ? headerColor : COLORS.gray800));
      drawCellText(
        doc,
        cell,
        colX,
        colWidths[i],
        cursorY,
        rowH,
        columns[i].align || "left",
        fontSize
      );
      colX += colWidths[i];
    });
    cursorY += rowH;
  };

  drawRow(
    columns.map((c) => c.header),
    true
  );
  rows.forEach((row, rowIndex) => drawRow(row, false, rowIndex));

  return cursorY + 4;
}

/**
 * Build a styled Assignment Scorecard PDF with tables and VAWE watermark.
 */
export function buildInterviewScorecardPdf(examResults, meta = {}) {
  const {
    examTitle = "Interview Exam",
    assignedSetLine = "",
    fullName = "N/A",
    phone = "N/A",
    logoBase64 = null,
    generatedAt = new Date(),
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

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.gray300);
  doc.setLineWidth(0.35);
  const headerBoxH = assignedSetLine ? 48 : 42;
  doc.roundedRect(margin, y, contentW, headerBoxH, 3, 3, "FD");

  const headerPad = 8;
  const headerLeftX = margin + headerPad;
  const headerTopY = y + 8;
  const headerRightX = margin + contentW - headerPad;
  const logoSize = 18;
  const logoGap = 4;

  if (logoBase64) {
    try {
      doc.addImage(
        logoBase64,
        "PNG",
        headerLeftX,
        headerTopY,
        logoSize,
        logoSize
      );
    } catch {
      // Ignore broken logo.
    }
  }
  const brandX = logoBase64 ? headerLeftX + logoSize + logoGap : headerLeftX;
  const brandTextY = headerTopY + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.cyan700);
  doc.text("VAWE", brandX, brandTextY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray500);
  doc.text("Assignment Scorecard", brandX, brandTextY + 5.5);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(`Generated: ${formatDateTime(generatedAt)}`, headerRightX, brandTextY, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.gray800);
  const titleLines = doc.splitTextToSize(String(examTitle), contentW - headerPad * 2);
  doc.text(titleLines.slice(0, 2), headerLeftX, headerTopY + 22);
  if (assignedSetLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.gray600);
    const assignedLines = doc.splitTextToSize(
      String(assignedSetLine),
      contentW - headerPad * 2
    );
    doc.text(assignedLines.slice(0, 2), headerLeftX, headerTopY + 30);
  }
  y += headerBoxH + 6;

  ensureSpace(30);
  y = drawSectionTitle(doc, margin, y, "Candidate Details", COLORS.cyan600);
  y = drawKeyValueTable(doc, margin, y, contentW, [
    { label: "Name", value: fullName || "N/A" },
    { label: "Phone", value: phone || "N/A" },
    { label: "Date", value: formatDateTime(generatedAt) },
  ]);
  y += 4;

  ensureSpace(36);
  y = drawSectionTitle(doc, margin, y, "Overall Score Summary", COLORS.blue600);
  y = drawDataTable(
    doc,
    margin,
    y,
    contentW,
    [
      { header: "Section", widthPct: 0.34 },
      { header: "Score", widthPct: 0.22, align: "center" },
      { header: "Details", widthPct: 0.44 },
    ],
    [
      [
        "Total Score",
        `${examResults.totalScore.toFixed(1)} / ${examResults.maxTotalScore}`,
        `${examResults.percentage}% · ${performanceLabel(examResults.percentage)}`,
      ],
      [
        "MCQ Section",
        `${examResults.mcqScore.score} / ${examResults.mcqScore.total}`,
        `${examResults.mcqScore.correct} correct of ${examResults.mcqScore.total} questions`,
      ],
      [
        "Coding Section",
        `${examResults.codingScore.toFixed(1)} / ${examResults.maxCodingScore}`,
        "Based on test case results",
      ],
    ],
    { margin, headerBg: COLORS.blue700 }
  );

  if (
    examResults.mcqSectionScores &&
    Object.keys(examResults.mcqSectionScores).length > 0
  ) {
    ensureSpace(20);
    y = drawSectionTitle(doc, margin, y, "MCQ Section-wise Analytics", COLORS.emerald600);
    const sectionRows = Object.entries(examResults.mcqSectionScores).map(
      ([sectionName, sectionData]) => [
        sectionName,
        `${sectionData.score} / ${sectionData.total}`,
        `${sectionData.correct}/${sectionData.total} correct`,
        `${topicTagAccuracyPercent(sectionData.correct, sectionData.total)}%`,
      ]
    );
    y = drawDataTable(
      doc,
      margin,
      y,
      contentW,
      [
        { header: "Section", widthPct: 0.36 },
        { header: "Score", widthPct: 0.18, align: "center" },
        { header: "Correct", widthPct: 0.22, align: "center" },
        { header: "Accuracy", widthPct: 0.24, align: "center" },
      ],
      sectionRows,
      { margin, headerBg: COLORS.emerald700 }
    );
  }

  if (
    examResults.mcqTopicScores &&
    Object.keys(examResults.mcqTopicScores).length > 0
  ) {
    ensureSpace(20);
    y = drawSectionTitle(doc, margin, y, "Topic-wise Analytics", COLORS.emerald600);
    const topicRows = Object.entries(examResults.mcqTopicScores)
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([topic, d]) => [
        topic,
        `${d.correct}/${d.total}`,
        `${topicTagAccuracyPercent(d.correct, d.total)}%`,
      ]);
    y = drawDataTable(
      doc,
      margin,
      y,
      contentW,
      [
        { header: "Topic", widthPct: 0.5 },
        { header: "Correct", widthPct: 0.25, align: "center" },
        { header: "Accuracy", widthPct: 0.25, align: "center" },
      ],
      topicRows,
      { margin, headerBg: COLORS.emerald700 }
    );
  }

  if (
    examResults.mcqCompanyScores &&
    Object.keys(examResults.mcqCompanyScores).length > 0
  ) {
    ensureSpace(20);
    y = drawSectionTitle(doc, margin, y, "Company-wise Analytics", COLORS.amber700);
    const companyRows = Object.entries(examResults.mcqCompanyScores)
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([company, d]) => [
        company,
        `${d.correct}/${d.total}`,
        `${topicTagAccuracyPercent(d.correct, d.total)}%`,
      ]);
    y = drawDataTable(
      doc,
      margin,
      y,
      contentW,
      [
        { header: "Company", widthPct: 0.5 },
        { header: "Correct", widthPct: 0.25, align: "center" },
        { header: "Accuracy", widthPct: 0.25, align: "center" },
      ],
      companyRows,
      { margin, headerBg: COLORS.amber700 }
    );
  }

  if (
    examResults.codingQuestionDetails &&
    examResults.codingQuestionDetails.length > 0
  ) {
    ensureSpace(20);
    y = drawSectionTitle(doc, margin, y, "Coding Test Case Analytics", COLORS.blue600);
    const codingRows = examResults.codingQuestionDetails.map((qDetail) => {
      const status =
        qDetail.totalTests > 0 && qDetail.passCount === qDetail.totalTests
          ? "All passed"
          : qDetail.totalTests > 0 && qDetail.passCount > 0
            ? "Partial"
            : "Failed";
      return [
        `Question ${qDetail.questionNumber}`,
        `${qDetail.score.toFixed(1)} / ${qDetail.maxScore}`,
        `${qDetail.passCount}/${qDetail.totalTests} passed`,
        status,
      ];
    });
    y = drawDataTable(
      doc,
      margin,
      y,
      contentW,
      [
        { header: "Question", widthPct: 0.28 },
        { header: "Score", widthPct: 0.22, align: "center" },
        { header: "Test Cases", widthPct: 0.28, align: "center" },
        { header: "Status", widthPct: 0.22, align: "center" },
      ],
      codingRows,
      { margin, headerBg: COLORS.blue700 }
    );
  }

  ensureSpace(16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(
    "This is a system-generated scorecard from VAWE. For queries, contact Administrator.",
    margin,
    y
  );

  applyWatermarks(doc, logoBase64);
  return doc;
}

export async function loadVaweLogoBase64() {
  if (typeof window === "undefined") return null;
  const sources = ["/vawe-logo.png", "/logo1.png"];
  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (typeof dataUrl === "string" && dataUrl.includes(",")) {
        return dataUrl.split(",")[1];
      }
    } catch {
      // Try next source.
    }
  }
  return null;
}

export function buildScorecardFileName(fullName, generatedAt = new Date()) {
  const slug =
    String(fullName || "student")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "student";
  const date = new Date(generatedAt).toISOString().slice(0, 10);
  return `scorecard-${slug}-${date}.pdf`;
}

export function downloadInterviewScorecardPdf(examResults, meta = {}) {
  const doc = buildInterviewScorecardPdf(examResults, meta);
  doc.save(buildScorecardFileName(meta.fullName, meta.generatedAt));
}
