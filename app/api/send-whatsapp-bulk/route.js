import { NextResponse } from "next/server";
import {
  getWhatsAppConfigStatus,
  getWhatsAppTemplateLanguageCandidates,
  isWhatsAppConfigured,
  resolveWhatsAppTemplateLanguage,
  runWithConcurrency,
  sendWhatsAppTemplate,
  verifyWabaSender,
} from "@/lib/whatsappTemplateSend";

const DEFAULT_CONCURRENCY = Number(process.env.WHATSAPP_BULK_CONCURRENCY || 10);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req) {
  try {
    if (!isWhatsAppConfigured()) {
      const config = getWhatsAppConfigStatus();
      return NextResponse.json(
        {
          error: "Server not configured for WhatsApp API",
          details: "Set WHATSAPP_CLOUD_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID on Vercel",
          config,
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { template, recipients = [], concurrency = DEFAULT_CONCURRENCY } = body || {};

    if (!template) {
      return NextResponse.json({ error: "template is required" }, { status: 400 });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "recipients array is required" }, { status: 400 });
    }

    const safeConcurrency = Math.max(1, Math.min(25, Number(concurrency) || DEFAULT_CONCURRENCY));
    const languageUsed = resolveWhatsAppTemplateLanguage(template);
    const languagesTried = getWhatsAppTemplateLanguageCandidates(template);

    const results = await runWithConcurrency(recipients, safeConcurrency, async (item) => {
      const {
        phone,
        bodyParams = [],
        namedBodyParams = [],
        buttonParams = [],
        copyCodeButton,
        id,
        name,
      } = item || {};

      const result = await sendWhatsAppTemplate({
        phone,
        template,
        language: languageUsed,
        bodyParams,
        namedBodyParams,
        buttonParams,
        copyCodeButton,
      });

      return {
        id: id ?? null,
        name: name ?? null,
        phone: phone ?? null,
        ok: result.ok,
        messageId: result.messageId ?? null,
        recipientId: result.recipientId ?? null,
        phoneE164: result.phoneE164 ?? null,
        messageStatus: result.messageStatus ?? null,
        deliveryWarning: result.deliveryWarning ?? null,
        language: result.language ?? languageUsed,
        languagesTried: result.languagesTried ?? null,
        error: result.error ?? null,
        errorCode: result.errorCode ?? null,
      };
    });

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    const sender = await verifyWabaSender().catch(() => ({ ok: false }));

    return NextResponse.json({
      ok: true,
      total: results.length,
      sent,
      failed: failed.length,
      languageUsed,
      languagesTried,
      sender: sender.ok
        ? {
            displayPhoneNumber: sender.displayPhoneNumber,
            verifiedName: sender.verifiedName,
            qualityRating: sender.qualityRating,
            phoneNumberId: sender.phoneNumberId,
            apiVersion: sender.apiVersion,
          }
        : null,
      results,
      errors: failed.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
