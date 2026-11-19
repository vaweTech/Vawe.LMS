import crypto from "crypto";

/**
 * At-rest protection for face descriptors (AES-256-GCM).
 * Set FRS_BIOMETRIC_KEY to a long random secret in production.
 * Legacy plaintext `{ v: number[] }` samples remain readable (backward compatible).
 */

const ALGO = "aes-256-gcm";
const DESCRIPTOR_LENGTH = 128;

function keyMaterial() {
  const explicit = String(process.env.FRS_BIOMETRIC_KEY || "").trim();
  if (explicit) return explicit;
  const fromSa = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (fromSa) return `frs:${fromSa.slice(0, 80)}`;
  return "skillwins-frs-dev-only-change-me";
}

function getKey() {
  return crypto.createHash("sha256").update(keyMaterial()).digest();
}

/** Encrypt a 128-D descriptor → `{ e: base64 }` (iv|tag|ciphertext). */
export function encryptDescriptor(vector) {
  if (!Array.isArray(vector) || vector.length !== DESCRIPTOR_LENGTH) {
    throw new Error("Invalid face descriptor.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const plain = Buffer.from(Float32Array.from(vector).buffer);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { e: Buffer.concat([iv, tag, enc]).toString("base64") };
}

/** Decrypt `{ e }` or return legacy `{ v }` as a number[]. */
export function decryptSample(sample) {
  if (!sample || typeof sample !== "object") return null;
  if (Array.isArray(sample.v)) {
    const out = sample.v.map(Number);
    return out.length === DESCRIPTOR_LENGTH && out.every((n) => Number.isFinite(n)) ? out : null;
  }
  if (!sample.e || typeof sample.e !== "string") return null;
  try {
    const buf = Buffer.from(sample.e, "base64");
    if (buf.length < 12 + 16 + 4) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    if (plain.length !== DESCRIPTOR_LENGTH * 4) return null;
    return Array.from(new Float32Array(plain.buffer, plain.byteOffset, DESCRIPTOR_LENGTH));
  } catch (_) {
    return null;
  }
}

export function descriptorFingerprint(vector) {
  return crypto.createHash("sha256").update(vector.map((n) => n.toFixed(6)).join(",")).digest("hex");
}

export function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}
