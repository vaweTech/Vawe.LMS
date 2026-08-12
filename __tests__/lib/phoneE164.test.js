import {
  toE164,
  toWhatsAppRecipientId,
  isValidIndianMobileE164,
  isValidWhatsAppRecipientE164,
} from "@/lib/phoneE164";

describe("phoneE164", () => {
  describe("toE164", () => {
    it("converts 10-digit Indian mobile to +91", () => {
      expect(toE164("9876543210")).toBe("+919876543210");
    });

    it("strips Excel float artifacts", () => {
      expect(toE164("9876543210.0")).toBe("+919876543210");
    });

    it("handles already-prefixed 91 numbers", () => {
      expect(toE164("919876543210")).toBe("+919876543210");
      expect(toE164("+919876543210")).toBe("+919876543210");
    });

    it("strips leading zero from 11-digit local format", () => {
      expect(toE164("09876543210")).toBe("+919876543210");
    });
  });

  describe("toWhatsAppRecipientId", () => {
    it("returns E.164 without leading plus", () => {
      expect(toWhatsAppRecipientId("9876543210")).toBe("919876543210");
    });
  });

  describe("validators", () => {
    it("validates Indian mobile E.164", () => {
      expect(isValidIndianMobileE164("+919876543210")).toBe(true);
      expect(isValidIndianMobileE164("+915876543210")).toBe(false);
      expect(isValidIndianMobileE164("9876543210")).toBe(false);
    });

    it("validates WhatsApp recipient E.164", () => {
      expect(isValidWhatsAppRecipientE164("+919876543210")).toBe(true);
      expect(isValidWhatsAppRecipientE164("+123")).toBe(false);
    });
  });
});
