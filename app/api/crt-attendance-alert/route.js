import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import admin, { adminDb } from "@/lib/firebaseAdmin";
import {
  isWhatsAppConfigured,
  runWithConcurrency,
  sanitizeTemplateParam,
  sendWhatsAppTemplate,
} from "@/lib/whatsappTemplateSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_RECIPIENTS = 500;
const ALLOWED_ROLES = new Set([
  "admin",
  "superadmin",
  "collegeadmin",
  "dataentry",
  "crttrainer",
  "trainer",
  "crtincharge",
  "incharge",
  "class room monitor",
  "assignment incharge",
]);

/** WhatsApp template with two body params: {{1}} student name, {{2}} message text. */
const WHATSAPP_TEMPLATE = (process.env.CRT_ATTENDANCE_WHATSAPP_TEMPLATE || "").trim();

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function smtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    from: `VAWE LMS <${user}>`,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      requireTLS: port === 587,
      auth: { user, pass },
      ...(process.env.SMTP_IGNORE_TLS === "true" && { tls: { rejectUnauthorized: false } }),
    }),
  };
}

function buildMessage(kind, ctx, item) {
  if (kind === "absence") {
    return {
      subject: `Absent from CRT class on ${ctx.date}`,
      text: `You were marked absent for ${ctx.courseLabel} on ${ctx.date} (${ctx.programName} · ${ctx.batchName}). Please attend regularly; contact your trainer if this is a mistake.`,
    };
  }
  return {
    subject: `Your CRT attendance is ${item.percent}%`,
    text: `Your attendance in ${ctx.programName} · ${ctx.batchName} is ${item.percent}% (${item.present} of ${item.total} classes), below the required ${ctx.threshold}%. Please attend the upcoming classes regularly.`,
  };
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await admin.auth().verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const role = String(userData.role || "").trim().toLowerCase();
    if (!ALLOWED_ROLES.has(role) && userData.isIncharge !== true) {
      return NextResponse.json({ error: "You are not allowed to send attendance alerts." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { kind, programId, batchId, items, date, courseLabel, threshold } = body || {};
    if (!["absence", "low"].includes(kind)) {
      return NextResponse.json({ error: "kind must be 'absence' or 'low'." }, { status: 400 });
    }
    if (!programId || !batchId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "programId, batchId and items are required." }, { status: 400 });
    }
    if (items.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `At most ${MAX_RECIPIENTS} students per request.` }, { status: 400 });
    }

    const programRef = adminDb.collection("crt").doc(String(programId));
    const batchRef = programRef.collection("batches").doc(String(batchId));
    const [programSnap, batchSnap, rosterSnap] = await Promise.all([
      programRef.get(),
      batchRef.get(),
      batchRef.collection("students").get(),
    ]);
    if (!batchSnap.exists) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

    const roster = new Map();
    rosterSnap.docs.forEach((d) => {
      const x = d.data() || {};
      roster.set(String(x.studentId || x.uid || d.id), {
        name: x.name || x.studentName || "Student",
        email: String(x.email || "").trim(),
        phone: String(x.phone || x.phone1 || "").trim(),
      });
    });

    const ctx = {
      programName: programSnap.data()?.name || "CRT",
      batchName: batchSnap.data()?.name || "batch",
      date: String(date || ""),
      courseLabel: String(courseLabel || "class"),
      threshold: Number(threshold) || 75,
    };

    const mail = smtpTransport();
    const useWhatsApp = !!WHATSAPP_TEMPLATE && isWhatsAppConfigured();
    let emailSent = 0;
    let whatsappSent = 0;
    const skipped = [];
    const failures = [];

    await runWithConcurrency(items, 5, async (raw) => {
      const item = typeof raw === "string" ? { presentId: raw } : raw || {};
      const student = roster.get(String(item.presentId || ""));
      if (!student) {
        skipped.push({ presentId: item.presentId, reason: "Not in this batch" });
        return;
      }
      const stats = {
        percent: Math.max(0, Math.min(100, Math.round(Number(item.percent) || 0))),
        present: Math.max(0, Math.round(Number(item.present) || 0)),
        total: Math.max(0, Math.round(Number(item.total) || 0)),
      };
      const msg = buildMessage(kind, ctx, stats);
      let reached = false;

      if (mail && student.email) {
        try {
          await mail.transporter.sendMail({
            from: mail.from,
            to: student.email,
            subject: msg.subject,
            text: `Hello ${student.name},\n\n${msg.text}\n\nThank you,\nVAWE LMS`,
            html: `<p>Hello <strong>${escapeHtml(student.name)}</strong>,</p><p>${escapeHtml(msg.text)}</p><p>Thank you,<br/>VAWE LMS</p>`,
          });
          emailSent += 1;
          reached = true;
        } catch (e) {
          failures.push({ name: student.name, channel: "email", error: e?.message || "Email failed" });
        }
      }

      if (useWhatsApp && student.phone) {
        const result = await sendWhatsAppTemplate({
          phone: student.phone,
          template: WHATSAPP_TEMPLATE,
          bodyParams: [sanitizeTemplateParam(student.name), sanitizeTemplateParam(msg.text)],
        });
        if (result.ok) {
          whatsappSent += 1;
          reached = true;
        } else {
          failures.push({ name: student.name, channel: "whatsapp", error: result.error || "WhatsApp failed" });
        }
      }

      if (!reached && !failures.some((f) => f.name === student.name)) {
        skipped.push({ name: student.name, reason: "No email or phone on record" });
      }
    });

    try {
      await adminDb.collection("attendanceAlerts").add({
        kind,
        programId: String(programId),
        batchId: String(batchId),
        date: ctx.date || null,
        courseLabel: kind === "absence" ? ctx.courseLabel : null,
        requested: items.length,
        emailSent,
        whatsappSent,
        sentBy: decoded.uid,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      console.warn("crt-attendance-alert: could not write log", logErr?.message || logErr);
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      whatsappSent,
      emailConfigured: !!mail,
      whatsappConfigured: useWhatsApp,
      skipped: skipped.length,
      failed: failures.length,
      failures: failures.slice(0, 20),
    });
  } catch (e) {
    console.error("crt-attendance-alert error", e);
    const status = e?.code?.startsWith?.("auth/") ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Could not send alerts." }, { status });
  }
}
