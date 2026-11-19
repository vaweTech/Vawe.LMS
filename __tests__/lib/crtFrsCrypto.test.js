import { decryptSample, descriptorFingerprint, encryptDescriptor } from "@/lib/crtFrsCrypto";

function sampleVector(seed = 0.1) {
  return Array.from({ length: 128 }, (_, i) => Math.sin(i * seed) * 0.5);
}

describe("crtFrsCrypto", () => {
  it("encrypts and decrypts a 128-D descriptor", () => {
    const v = sampleVector();
    const enc = encryptDescriptor(v);
    expect(enc.e).toEqual(expect.any(String));
    expect(enc.v).toBeUndefined();
    const out = decryptSample(enc);
    expect(out).toHaveLength(128);
    out.forEach((n, i) => expect(Math.abs(n - v[i])).toBeLessThan(1e-5));
  });

  it("still reads legacy plaintext samples", () => {
    const v = sampleVector(0.2);
    expect(decryptSample({ v })).toEqual(v);
  });

  it("rejects invalid encrypted payloads", () => {
    expect(decryptSample({ e: "not-valid" })).toBeNull();
    expect(decryptSample(null)).toBeNull();
  });

  it("fingerprints descriptors stably", () => {
    const v = sampleVector(0.3);
    expect(descriptorFingerprint(v)).toBe(descriptorFingerprint([...v]));
    expect(descriptorFingerprint(v)).not.toBe(descriptorFingerprint(sampleVector(0.4)));
  });
});
