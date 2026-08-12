import { toE164 } from "@/lib/otpStore";
import { buildFeeReceiptPdfBuffer } from "@/lib/feeReceiptPdf";
import { File } from "node:buffer";

const WABA_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WABA_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const FEE_RECEIPT_TEMPLATE =
  process.env.WHATSAPP_FEE_RECEIPT_TEMPLATE_NAME || "testing";
const TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_FEE_RECEIPT_TEMPLATE_LANGUAGE || "en";
const RECEIPT_PDF_FILENAME =
  process.env.WHATSAPP_FEE_RECEIPT_PDF_FILENAME || "Fee_Receipt.pdf";
const MANAGER_PAYMENT_TEMPLATE =
  process.env.WHATSAPP_MANAGER_PAYMENT_TEMPLATE_NAME || "manager_payment_notification";
const MANAGER_PAYMENT_LANGUAGE =
  process.env.WHATSAPP_MANAGER_PAYMENT_TEMPLATE_LANGUAGE || "en";
const DIRECTOR_PHONE =
  process.env.WHATSAPP_DIRECTOR_PHONE || "8123455566";

const MAX_PARAM_LENGTH = 1024;

function graphUrl(path) {
  return `https://graph.facebook.com/${WABA_API_VERSION}/${WABA_PHONE_NUMBER_ID}${path}`;
}

function sanitizeTemplateParam(value, maxLen = MAX_PARAM_LENGTH) {
  if (value == null) return "";
  let s = String(value);
  s = s.replace(/\uFEFF/g, "");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  s = s.replace(/\r\n|\r|\n/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** DD-MM-YYYY for WhatsApp template {{4}} */
export function formatFeeReceiptTemplateDate(iso) {
  try {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) throw new Error("invalid date");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${d.getFullYear()}`;
  }
}

function formatPaymentMethodLabel(method) {
  const m = String(method || "").toLowerCase();
  if (m === "cash") return "Cash";
  if (m === "online") return "Online";
  if (m === "cheque") return "Cheque";
  if (m === "upi") return "UPI";
  return sanitizeTemplateParam(method || "Payment");
}

export function isFeeReceiptWhatsAppConfigured() {
  return Boolean(WABA_TOKEN && WABA_PHONE_NUMBER_ID);
}

function formatFetchError(err) {
  const cause = err?.cause;
  const parts = [err?.message, cause?.code, cause?.message].filter(Boolean);
  return parts.length ? parts.join(" — ") : "fetch failed";
}

async function graphFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    throw new Error(formatFetchError(err));
  }
}

/** Step 2: POST /media — upload PDF, return media id */
async function uploadWhatsAppPdf(pdfBuffer, filename) {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", "application/pdf");
  formData.append(
    "file",
    new File([pdfBuffer], filename, { type: "application/pdf" })
  );

  const res = await graphFetch(graphUrl("/media"), {
    method: "POST",
    headers: { Authorization: `Bearer ${WABA_TOKEN}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to upload receipt PDF to WhatsApp");
  }
  const mediaId = String(data?.id || "").trim();
  if (!mediaId) {
    throw new Error("WhatsApp media upload returned no media id");
  }
  return mediaId;
}

function buildBodyParams({ studentName, receiptNo, amount, paymentDate, paymentMethod }) {
  const amountNum = Number(amount);
  const amountText = sanitizeTemplateParam(
    Number.isFinite(amountNum) ? String(amountNum) : "0"
  );
  return [
    { type: "text", text: studentName },
    { type: "text", text: receiptNo },
    { type: "text", text: amountText },
    { type: "text", text: sanitizeTemplateParam(formatFeeReceiptTemplateDate(paymentDate)) },
    { type: "text", text: formatPaymentMethodLabel(paymentMethod) },
  ];
}

/** Step 4: POST /messages — send template with document header + body params */
async function sendWhatsAppTemplateMessage(phoneE164, mediaId, bodyParams) {
  const payload = {
    messaging_product: "whatsapp",
    to: phoneE164.replace("+", ""),
    type: "template",
    template: {
      name: FEE_RECEIPT_TEMPLATE,
      language: { code: TEMPLATE_LANGUAGE },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "document",
              document: {
                id: mediaId,
                filename: RECEIPT_PDF_FILENAME,
              },
            },
          ],
        },
        {
          type: "body",
          parameters: bodyParams,
        },
      ],
    },
  };

  const res = await graphFetch(graphUrl("/messages"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WABA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return { res, data };
}

async function sendWhatsAppBodyTemplate(phoneE164, templateName, language, bodyParams) {
  const payload = {
    messaging_product: "whatsapp",
    to: phoneE164.replace("+", ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: bodyParams,
        },
      ],
    },
  };

  const res = await graphFetch(graphUrl("/messages"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WABA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return { res, data };
}

function formatAmountParam(amount) {
  const n = Number(amount);
  return sanitizeTemplateParam(Number.isFinite(n) ? String(n) : "0");
}

function buildManagerBodyParams({
  studentName,
  course,
  totalFee,
  paidAmount,
  dueAmount,
  receiptNo,
  paymentMethod,
  paymentDate,
}) {
  return [
    { type: "text", text: sanitizeTemplateParam(studentName || "Student") },
    { type: "text", text: sanitizeTemplateParam(course || "-") },
    { type: "text", text: formatAmountParam(totalFee) },
    { type: "text", text: formatAmountParam(paidAmount) },
    { type: "text", text: formatAmountParam(dueAmount) },
    { type: "text", text: sanitizeTemplateParam(receiptNo || "N/A", 64) },
    { type: "text", text: formatPaymentMethodLabel(paymentMethod) },
    { type: "text", text: sanitizeTemplateParam(formatFeeReceiptTemplateDate(paymentDate)) },
  ];
}

/**
 * Notify director/manager when a fee payment is received.
 * Template manager_payment_notification (en): 8 body text params.
 */
export async function sendManagerPaymentNotification({
  name,
  course,
  totalFee,
  paidAmount,
  dueAmount,
  receiptNo,
  paymentMethod,
  paymentDate,
  directorPhone = DIRECTOR_PHONE,
}) {
  if (!isFeeReceiptWhatsAppConfigured()) {
    console.warn("Manager payment WhatsApp skipped: API not configured");
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  if (!directorPhone) {
    return { ok: false, skipped: true, reason: "no_director_phone" };
  }

  const phoneE164 = toE164(directorPhone);
  if (!/^\+[1-9]\d{10,14}$/.test(phoneE164)) {
    return { ok: false, skipped: true, reason: "invalid_director_phone", phoneE164 };
  }

  const bodyParams = buildManagerBodyParams({
    studentName: name,
    course,
    totalFee,
    paidAmount,
    dueAmount,
    receiptNo,
    paymentMethod,
    paymentDate,
  });

  const { res, data } = await sendWhatsAppBodyTemplate(
    phoneE164,
    MANAGER_PAYMENT_TEMPLATE,
    MANAGER_PAYMENT_LANGUAGE,
    bodyParams
  );

  if (!res.ok) {
    const details = data?.error?.error_data?.details || data?.error?.error_user_msg || "";
    throw new Error(
      [data?.error?.message || "Failed to send manager payment WhatsApp", details]
        .filter(Boolean)
        .join(" — ")
    );
  }

  const messageId = data?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp API returned no message id for manager notification");
  }

  return { ok: true, messageId };
}

export function sendManagerPaymentNotificationInBackground(params) {
  runPaymentWhatsAppNotifications({ manager: params }).catch((err) => {
    console.warn("Background manager payment WhatsApp failed:", err?.message || err);
  });
}

/**
 * Run student receipt + manager notifications (awaited).
 * Use inside Next.js after() on Vercel so the function stays alive until complete.
 */
export async function runPaymentWhatsAppNotifications({ feeReceipt, manager }) {
  const tasks = [];

  if (feeReceipt) {
    tasks.push(
      sendFeeReceiptWhatsApp(feeReceipt).then((result) => {
        if (result?.skipped) {
          console.warn("Fee receipt WhatsApp skipped:", result.reason);
          return result;
        }
        if (result?.ok) {
          console.log("✅ Fee receipt WhatsApp sent:", {
            messageId: result.messageId,
            phone: feeReceipt.phone,
            receiptNo: result.receiptNo,
          });
        }
        return result;
      })
    );
  }

  if (manager) {
    tasks.push(
      sendManagerPaymentNotification(manager).then((result) => {
        if (result?.skipped) {
          console.warn("Manager payment WhatsApp skipped:", result.reason);
          return result;
        }
        if (result?.ok) {
          console.log("✅ Manager payment WhatsApp sent:", {
            messageId: result.messageId,
            directorPhone: manager.directorPhone || DIRECTOR_PHONE,
            student: manager.name,
            receiptNo: manager.receiptNo,
          });
        }
        return result;
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("Payment WhatsApp notification failed:", result.reason?.message || result.reason);
    }
  }
  return results;
}

/**
 * Generate PDF → POST /media → POST /messages
 * Template "testing" (en): {{1}} name, {{2}} receipt no, {{3}} amount, {{4}} date, {{5}} payment method
 */
export async function sendFeeReceiptWhatsApp({
  phone,
  name,
  receiptNo,
  amount,
  paymentDate,
  receiptDetails = {},
}) {
  if (!isFeeReceiptWhatsAppConfigured()) {
    console.warn("Fee receipt WhatsApp skipped: API not configured");
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  if (!phone) {
    return { ok: false, skipped: true, reason: "no_phone" };
  }

  const phoneE164 = toE164(phone);
  if (!/^\+[1-9]\d{10,14}$/.test(phoneE164)) {
    return { ok: false, skipped: true, reason: "invalid_phone", phoneE164 };
  }

  const safeReceiptNo = sanitizeTemplateParam(receiptNo || "N/A", 64);
  const studentName = sanitizeTemplateParam(name || "Student");
  const paymentMethod = receiptDetails.paymentMethod || "Payment";

  // Step 1: Generate PDF
  const pdfBuffer = buildFeeReceiptPdfBuffer({
    name: receiptDetails.name || name,
    email: receiptDetails.email,
    phone: receiptDetails.phone || phone,
    studentId: receiptDetails.studentId,
    course: receiptDetails.course,
    paymentDate,
    paymentMethod,
    paymentType: receiptDetails.paymentType || "fee_payment",
    paymentId: receiptDetails.paymentId,
    totalFee: receiptDetails.totalFee,
    previousPaid: receiptDetails.previousPaid,
    amountPaid: amount,
  });

  // Step 2–3: Upload PDF, receive media id
  const mediaId = await uploadWhatsAppPdf(pdfBuffer, RECEIPT_PDF_FILENAME);

  // Step 4: Send template message
  const bodyParams = buildBodyParams({
    studentName,
    receiptNo: safeReceiptNo,
    amount,
    paymentDate,
    paymentMethod,
  });

  const { res, data } = await sendWhatsAppTemplateMessage(phoneE164, mediaId, bodyParams);

  if (!res.ok) {
    const details = data?.error?.error_data?.details || data?.error?.error_user_msg || "";
    throw new Error(
      [data?.error?.message || "Failed to send fee receipt WhatsApp message", details]
        .filter(Boolean)
        .join(" — ")
    );
  }

  const messageId = data?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp API returned no message id for fee receipt");
  }

  return { ok: true, messageId, mediaId, receiptNo: safeReceiptNo };
}

/** Fire-and-forget wrapper — prefer runPaymentWhatsAppNotifications inside after() on Vercel. */
export function sendFeeReceiptWhatsAppInBackground(params) {
  runPaymentWhatsAppNotifications({ feeReceipt: params }).catch((err) => {
    console.warn("Background fee receipt WhatsApp failed:", err?.message || err);
  });
}
