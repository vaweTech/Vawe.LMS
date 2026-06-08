import { NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin";

const adminDb = admin.firestore();

const WABA_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const BLOCK_TEMPLATE_NAME = process.env.WHATSAPP_BLOCK_TEMPLATE_NAME || "temporarily_blocked";
const FEE_TEMPLATE_NAME = process.env.WHATSAPP_FEE_TEMPLATE_NAME || "fee_update_notification";
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
const CRON_SECRET = process.env.CRON_SECRET || "your-secret-key-here";

async function sendWhatsAppTemplate({ phone, template, bodyParams = [], language = TEMPLATE_LANGUAGE }) {
  if (!WABA_TOKEN || !WABA_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp API not configured");
  }
  if (!phone) throw new Error("Phone missing for WhatsApp message");

  // Normalize phone like OTP route expects: E.164 or raw 10 digits -> 91
  let normalized = String(phone).trim();
  const digits = normalized.replace(/\D/g, "");
  if (/^\+\d{7,15}$/.test(normalized)) {
    // already E.164
  } else if (digits.length === 10) {
    normalized = `+91${digits}`;
  } else if (digits.length >= 7 && digits.length <= 15) {
    normalized = `+${digits}`;
  }

  const payload = {
    messaging_product: "whatsapp",
    to: normalized.replace("+", ""),
    type: "template",
    template: {
      name: template,
      language: { code: language },
      ...(bodyParams.length
        ? { components: [{ type: "body", parameters: bodyParams.map((p) => ({ type: "text", text: String(p) })) }] }
        : {}),
    },
  };

  const url = `https://graph.facebook.com/v23.0/${WABA_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WABA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    let msg = data?.error?.message || "Failed to send WhatsApp message";
    
    // Handle API access blocked error
    if (data?.error?.code === 200 || data?.error?.type === 'OAuthException') {
      if (data?.error?.message?.includes('blocked') || data?.error?.message?.includes('block')) {
        msg = "WhatsApp API access is blocked. Token expired or invalid. Please regenerate tokens in WhatsApp Business Manager.";
      } else {
        msg = data?.error?.message || "OAuth authentication failed. Check your access token.";
      }
    }
    
    const err = new Error(msg);
    err.details = data;
    err.errorCode = data?.error?.code;
    err.errorType = data?.error?.type;
    throw err;
  }
  return data?.messages?.[0]?.id || null;
}

export async function GET(req) {
  try {
    // Protect route: allow either CRON_SECRET header or Vercel Cron header
    const authHeader = req.headers.get("authorization");
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query students who are not locked and have dues
    const snapshot = await adminDb.collection("students").get();

    let processed = 0;
    let sentFee = 0;
    let sentBlocked = 0;
    let locked = 0;

    const now = new Date();
    for (const doc of snapshot.docs) {
      const s = doc.data();
      const totalFee = Number(s.totalFee ?? 0);
      const paidFee = Number(s.PayedFee ?? s.payedFee ?? 0);
      const due = Math.max(totalFee - paidFee, 0);
      const isLocked = Boolean(s.locked);
      const reminderCount = Number(s.reminderCount ?? 0);
      const lastReminderAt = s.lastReminderAt?.toDate?.() || null;

      // Skip if no fee info or no due
      if (!totalFee || due <= 0) continue;

      // Only target if paid < 50% and not locked yet
      if (paidFee < totalFee / 2 && !isLocked) {
        const shouldSendFee = (() => {
          if (reminderCount >= 3) return false;
          if (!lastReminderAt) return true;
          const msSince = now.getTime() - lastReminderAt.getTime();
          const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
          return msSince >= threeDaysMs;
        })();

        if (shouldSendFee) {
          try {
            await sendWhatsAppTemplate({
              phone: s.phone1 || s.phone,
              template: FEE_TEMPLATE_NAME,
              bodyParams: [s.name || "Student", `₹${due}`],
              language: TEMPLATE_LANGUAGE,
            });
            await doc.ref.update({
              reminderCount: admin.firestore.FieldValue.increment(1),
              lastReminderAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            sentFee++;
          } catch (e) {
            console.error("Failed to send fee reminder for", doc.id, e?.message || e);
          }
        }

        // If already sent 3 reminders, send block notice and lock
        if (reminderCount >= 3) {
          try {
            await sendWhatsAppTemplate({
              phone: s.phone1 || s.phone,
              template: BLOCK_TEMPLATE_NAME,
              bodyParams: [s.name || "Student", `₹${due}`],
              language: TEMPLATE_LANGUAGE,
            });
            await doc.ref.update({
              locked: true,
              blockedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            sentBlocked++;
            locked++;
          } catch (e) {
            console.error("Failed to send block notice for", doc.id, e?.message || e);
          }
        }
        processed++;
      }
    }

    return NextResponse.json({ ok: true, processed, sentFee, sentBlocked, locked });
  } catch (e) {
    console.error("fee-reminders error:", e);
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}


