import { isAppleMobileDevice } from "@/lib/deviceDetect";

describe("deviceDetect", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("returns false when navigator is missing", () => {
    Object.defineProperty(global, "navigator", {
      value: undefined,
      configurable: true,
    });
    expect(isAppleMobileDevice()).toBe(false);
  });

  it("detects iPhone / iPad / iPod user agents", () => {
    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      configurable: true,
    });
    expect(isAppleMobileDevice()).toBe(true);

    Object.defineProperty(global, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)" },
      configurable: true,
    });
    expect(isAppleMobileDevice()).toBe(true);
  });

  it("returns false for desktop Chrome", () => {
    Object.defineProperty(global, "navigator", {
      value: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      configurable: true,
    });
    expect(isAppleMobileDevice()).toBe(false);
  });
});
