import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * GET: Check SMTP config and optionally verify connection.
 * Query: ?verify=1 to run transporter.verify()
 */
export async function GET(req) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  const config = {
    SMTP_HOST: host ? `${host.substring(0, 8)}...` : null,
    SMTP_PORT: port,
    SMTP_USER: user ? `${user.substring(0, 3)}***@${user.split("@").pop()}` : null,
    SMTP_PASS: pass ? (pass.length > 0 ? "*** set ***" : "empty") : null,
    SMTP_SECURE: secure,
    configured: !!(host && user && pass),
  };

  const url = new URL(req.url);
  if (url.searchParams.get("verify") !== "1") {
    return NextResponse.json({ ok: true, config });
  }

  if (!config.configured) {
    return NextResponse.json(
      { ok: false, error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local", config },
      { status: 500 }
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: port === 587,
    auth: { user, pass },
    ...(process.env.SMTP_IGNORE_TLS === "true" && { tls: { rejectUnauthorized: false } }),
  });

  try {
    await transporter.verify();
    return NextResponse.json({ ok: true, config, verify: "Connection successful" });
  } catch (err) {
    const code = err?.code;
    const message = err?.message || String(err);
    console.error("test-email verify error:", { code, message });
    return NextResponse.json(
      {
        ok: false,
        config,
        verify: "Failed",
        error: message,
        code: code || undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Send a test email to the given address.
 * Body: { "to": "recipient@example.com" }
 */
export async function POST(req) {
  let to;
  try {
    const body = await req.json();
    to = body?.to && String(body.to).trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON. Send { \"to\": \"email@example.com\" }" }, { status: 400 });
  }

  if (!to) {
    return NextResponse.json({ error: "Missing \"to\" email address" }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local" },
      { status: 500 }
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: port === 587,
    auth: { user, pass },
    ...(process.env.SMTP_IGNORE_TLS === "true" && { tls: { rejectUnauthorized: false } }),
  });

  const subject = "VAWE LMS – Test Email";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;">
      <h2 style="color:#0ea5e9;">Test Email</h2>
      <p>This is a test email from your VAWE LMS Nodemailer setup.</p>
      <p>If you received this, SMTP is working correctly.</p>
      <p style="color:#64748b;font-size:12px;">Sent at ${new Date().toISOString()}</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `VAWE LMS <${user}>`,
      to,
      subject,
      text: "This is a test email from VAWE LMS. If you received this, SMTP is working.",
      html,
    });
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    const code = err?.code;
    const message = err?.message ? String(err.message) : String(err);
    console.error("test-email send error:", { code, message });

    let userMessage = "Failed to send email.";
    if (code === "EAUTH") userMessage = "SMTP authentication failed. Check SMTP_USER and SMTP_PASS (e.g. Gmail App Password).";
    else if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ECONNREFUSED") userMessage = "Could not connect to SMTP server. Check SMTP_HOST and SMTP_PORT.";
    else if (code === "ESOCKET") userMessage = "Network error while sending email.";
    else if (message) userMessage = message.replace(/auth|password|secret|smtp\.pass/gi, "[redacted]").slice(0, 300);

    return NextResponse.json({ error: userMessage, code: code || undefined }, { status: 500 });
  }
}
