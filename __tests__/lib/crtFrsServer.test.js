jest.mock("@/lib/firebaseAdmin", () => {
  const fs = { settings: jest.fn() };
  return {
    __esModule: true,
    default: {
      apps: [{ name: "crt-frs", firestore: () => fs }],
      firestore: {
        FieldValue: { serverTimestamp: () => "server-ts" },
        FieldPath: class FieldPath {
          constructor(...parts) {
            this.parts = parts;
          }
        },
      },
    },
  };
});

import {
  MATCH_THRESHOLD,
  bestMatchDistance,
  checkLocation,
  euclidean,
  normalizeGeofence,
  parseDescriptor,
  parseThumbnail,
  samplesAreConsistent,
} from "@/lib/crtFrsServer";

function vec(fill = 0.1) {
  return Array.from({ length: 128 }, () => fill);
}

describe("crtFrsServer pure helpers", () => {
  it("exposes a calibrated match threshold (<= 0.5)", () => {
    expect(MATCH_THRESHOLD).toBeGreaterThan(0.3);
    expect(MATCH_THRESHOLD).toBeLessThanOrEqual(0.5);
  });

  it("parses valid descriptors only", () => {
    expect(parseDescriptor(vec())).toHaveLength(128);
    expect(parseDescriptor([1, 2])).toBeNull();
    expect(parseDescriptor(null)).toBeNull();
  });

  it("accepts jpeg data-url thumbnails and rejects others", () => {
    const ok = `data:image/jpeg;base64,${"a".repeat(100)}`;
    expect(parseThumbnail(ok)).toBe(ok);
    expect(parseThumbnail("data:image/png;base64,abc")).toBeNull();
    expect(parseThumbnail("")).toBeNull();
  });

  it("computes euclidean distance and best match", () => {
    expect(euclidean(vec(0), vec(0))).toBe(0);
    expect(bestMatchDistance([vec(0.1), vec(0.5)], vec(0.1))).toBeCloseTo(0, 5);
  });

  it("checks registration sample consistency", () => {
    expect(samplesAreConsistent([vec(0.1), vec(0.11), vec(0.12)])).toBe(true);
    expect(samplesAreConsistent([vec(0), vec(1)])).toBe(false);
  });

  it("normalizes geofence and validates location", () => {
    const g = normalizeGeofence({ enabled: true, lat: 17.4, lng: 78.4, radiusM: 100, maxAccuracyM: 150 });
    expect(g.enabled).toBe(true);
    const ok = checkLocation(g, { lat: 17.4001, lng: 78.4, accuracy: 20 });
    expect(ok.distanceM).toBeLessThan(50);
    expect(() => checkLocation(g, { lat: 17.5, lng: 78.5, accuracy: 20 })).toThrow(/m from/);
    expect(() => checkLocation(g, { lat: 17.4, lng: 78.4, accuracy: 5000 })).toThrow(/imprecise/);
  });
});
