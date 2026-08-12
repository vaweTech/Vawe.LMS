/**
 * Razorpay keys: test keys in .env.local, live keys in Vercel env vars.
 * Supports legacy lowercase names (key_id / key_secret) for local .env files.
 */
export function getRazorpayKeys() {
  const key_id =
    process.env.RAZORPAY_KEY_ID ||
    process.env.key_id ||
    "";
  const key_secret =
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.key_secret ||
    "";
  return { key_id, key_secret };
}

export function getPublicRazorpayKeyId() {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || getRazorpayKeys().key_id;
}
