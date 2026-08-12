import {
  createSlug,
  extractCourseIdFromSlug,
  createCourseUrl,
  parseCourseUrl,
} from "@/lib/urlUtils";

describe("urlUtils", () => {
  describe("createSlug", () => {
    it("converts title to URL-friendly slug", () => {
      expect(createSlug("Java Full Stack!")).toBe("java-full-stack");
    });

    it("returns empty string for falsy input", () => {
      expect(createSlug("")).toBe("");
      expect(createSlug(null)).toBe("");
    });
  });

  describe("extractCourseIdFromSlug", () => {
    it("extracts Firebase-like ID from end of slug", () => {
      const id = "abcdefghij1234567890";
      expect(extractCourseIdFromSlug(`java-course-${id}`)).toBe(id);
    });

    it("returns original slug when no ID found", () => {
      expect(extractCourseIdFromSlug("java-full-stack")).toBe("java-full-stack");
    });
  });

  describe("createCourseUrl / parseCourseUrl", () => {
    it("creates course URL from title", () => {
      expect(createCourseUrl("Python Basics")).toBe("python-basics");
    });

    it("parses course URL slug", () => {
      expect(parseCourseUrl("python-basics")).toEqual({ slug: "python-basics" });
    });
  });
});
