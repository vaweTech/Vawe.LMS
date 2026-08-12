/**
 * Browser-safe helpers for WhatsApp OTP API routes (no secrets).
 * Reuse from admin pages that need phone verification.
 */

export async function requestWhatsAppOtp(phone) {
  const res = await fetch("/api/send-whatsapp-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, ...data };
}

export async function verifyWhatsAppOtp(phone, otp) {
  const res = await fetch("/api/verify-whatsapp-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp: String(otp).trim() }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, ...data };
}
