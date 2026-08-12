import { readFileSync } from "fs";
import { join } from "path";
import { jsPDF } from "jspdf";

const COLORS = {
  gray50: [249, 250, 251],
  gray200: [229, 231, 235],
  gray300: [209, 213, 219],
  gray500: [107, 114, 128],
  gray600: [75, 85, 99],
  gray700: [55, 65, 81],
  gray800: [31, 41, 55],
  gray900: [17, 24, 39],
  blue50: [239, 246, 255],
  blue200: [191, 219, 254],
  blue700: [29, 78, 216],
  green50: [240, 253, 244],
  green200: [187, 247, 208],
  green700: [21, 128, 61],
  amber50: [255, 251, 235],
  amber200: [253, 230, 138],
  amber700: [180, 83, 9],
  white: [255, 255, 255],
};

let cachedLogoBase64 = null;

function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const logoPath = join(process.cwd(), "public", "vawe-logo.png");
    cachedLogoBase64 = readFileSync(logoPath).toString("base64");
    return cachedLogoBase64;
  } catch {
    return null;
  }
}

function formatCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

/** jsPDF Helvetica cannot render ₹ — it shows as superscript 1. Use Rs. instead. */
function formatRupee(amount) {
  return `Rs. ${formatCurrency(amount)}`;
}

function formatDisplayDate(iso) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso || new Date().toISOString());
  }
}

function capitalizeLabel(value) {
  const s = String(value || "").trim();
  if (!s) return "-";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function drawField(doc, x, y, label, value, colW) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(label, x, y);

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray900);
  const lines = doc.splitTextToSize(String(value || "-"), colW - 2);
  doc.text(lines, x, y + 4.5);
  return y + 4.5 + lines.length * 4.5;
}

function drawTableRow(doc, x, y, w, label, value, opts = {}) {
  const {
    bg = null,
    borderTop = null,
    borderTopWidth = 0.4,
    labelColor = COLORS.gray600,
    valueColor = COLORS.gray900,
    bold = false,
    rowH = 9,
  } = opts;

  const labelW = w * 0.62;
  const rowTop = y;

  if (bg) {
    doc.setFillColor(...bg);
    doc.rect(x, rowTop, w, rowH, "F");
  }

  if (borderTop) {
    doc.setDrawColor(...borderTop);
    doc.setLineWidth(borderTopWidth);
    doc.line(x, rowTop, x + w, rowTop);
  }

  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(9);
  doc.setTextColor(...labelColor);
  doc.text(label, x + 3, rowTop + 6);
  doc.setTextColor(...valueColor);
  doc.text(String(value), x + labelW, rowTop + 6);

  return rowTop + rowH;
}

/**
 * Build a styled fee payment receipt PDF (matches /receipt page) as a Node Buffer.
 */
export function buildFeeReceiptPdfBuffer(data) {
  const {
    name = "",
    email = "",
    phone = "",
    studentId = "",
    course = "",
    paymentDate = new Date().toISOString(),
    paymentMethod = "",
    paymentType = "fee_payment",
    paymentId = "",
    totalFee = 0,
    previousPaid = 0,
    amountPaid = 0,
  } = data;

  const nextPaid = Number(previousPaid) + Number(amountPaid);
  const remainingDue = Math.max(Number(totalFee) - nextPaid, 0);
  const displayDate = formatDisplayDate(paymentDate);
  const printedAt = formatDisplayDate(new Date().toISOString());
  const logo = getLogoBase64();
  const showPaymentId = paymentId && String(paymentMethod).toLowerCase() !== "cash";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const cardW = pageW - margin * 2;
  const cardX = margin;
  const cardY = margin;
  const innerPad = 8;
  const contentX = cardX + innerPad;
  const contentW = cardW - innerPad * 2;
  const colW = (contentW - 6) / 2;

  doc.setFillColor(243, 244, 246);
  doc.rect(0, 0, pageW, pageH, "F");

  const cardH = showPaymentId ? 238 : 230;
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.gray300);
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, "FD");

  let y = cardY + innerPad;

  if (logo) {
    doc.addImage(logo, "PNG", contentX, y, 10, 10);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.gray900);
  doc.text("VAWE", contentX + (logo ? 13 : 0), y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text("Payment Receipt", contentX + (logo ? 13 : 0), y + 10);
  doc.setFontSize(7.5);
  doc.text(`Printed on ${printedAt}`, contentX + contentW, y + 4, { align: "right" });
  doc.text(`Receipt Date: ${displayDate}`, contentX + contentW, y + 9, { align: "right" });

  y += 14;
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(contentX, y, contentX + contentW, y);
  y += 8;

  let leftY = y;
  let rightY = y;
  leftY = drawField(doc, contentX, leftY, "Payer Name", name, colW);
  rightY = drawField(doc, contentX + colW + 6, rightY, "Email", email, colW);
  leftY = Math.max(leftY, rightY) + 3;
  rightY = leftY;
  leftY = drawField(doc, contentX, leftY, "Phone Number", phone, colW);
  rightY = drawField(doc, contentX + colW + 6, rightY, "Student ID", studentId, colW);
  leftY = Math.max(leftY, rightY) + 3;
  leftY = drawField(doc, contentX, leftY, "Course Name", course, contentW);
  y = leftY + 6;

  const tableX = contentX;
  const tableW = contentW;
  const tableTop = y;
  const tableH = showPaymentId ? 81 : 72;

  doc.setDrawColor(...COLORS.gray300);
  doc.setLineWidth(0.3);
  doc.roundedRect(tableX, tableTop, tableW, tableH, 2, 2, "S");

  let rowY = tableTop;
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Total Course Fee", formatRupee(totalFee), {
    bg: COLORS.gray50,
    bold: true,
  });
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Previously Paid", formatRupee(previousPaid));
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Amount Paid Now", formatRupee(amountPaid), {
    bg: COLORS.blue50,
    borderTop: COLORS.blue200,
    borderTopWidth: 0.6,
    labelColor: COLORS.gray800,
    valueColor: COLORS.blue700,
    bold: true,
  });
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Total Paid After This Payment", formatRupee(nextPaid), {
    bg: COLORS.green50,
    borderTop: COLORS.green200,
    labelColor: COLORS.gray800,
    valueColor: COLORS.green700,
    bold: true,
  });
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Remaining Due", formatRupee(remainingDue), {
    bg: COLORS.amber50,
    borderTop: COLORS.amber200,
    labelColor: COLORS.gray800,
    valueColor: COLORS.amber700,
    bold: true,
  });
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Payment Method", capitalizeLabel(paymentMethod));
  rowY = drawTableRow(doc, tableX, rowY, tableW, "Payment Type", capitalizeLabel(paymentType), {
    bg: COLORS.gray50,
  });
  if (showPaymentId) {
    drawTableRow(doc, tableX, rowY, tableW, "Payment ID", paymentId, { rowH: 11 });
  }

  y = tableTop + tableH + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.gray500);
  const note =
    "Note: This is a system-generated receipt for your records. For any corrections, please contact support.";
  doc.text(doc.splitTextToSize(note, contentW), contentX, y);
  y += 12;

  doc.setFontSize(8);
  doc.text("Thank you for choosing VAWE.", contentX, y + 8);

  if (logo) {
    const stampSize = 18;
    const stampX = contentX + contentW - stampSize;
    doc.addImage(logo, "PNG", stampX, y, stampSize, stampSize);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray700);
    doc.text("Authorized Signatory", stampX + stampSize / 2, y + stampSize + 4, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function formatFeeReceiptPaymentDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return new Date().toLocaleDateString("en-IN");
  }
}

export function buildCashReceiptNo(studentId) {
  const suffix = String(studentId || "").slice(-6).toUpperCase() || "STUDENT";
  return `RCP-${suffix}-${Date.now().toString().slice(-8)}`;
}
