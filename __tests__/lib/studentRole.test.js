import {
  DEFAULT_COLLEGE_SUBDOMAIN,
  normalizeCollegeSubdomain,
  resolveCollegeSubdomain,
  getScopedStudentRole,
  getScopedCrtStudentRole,
  getScopedInternshipRole,
  getScopedSkillwinsRole,
  isCrtStudentRole,
  isScopedStudentRole,
  isScopedInternshipRole,
  isSkillwinsStudentRole,
  buildStudentRolesFromFlags,
  inferStudentRole,
} from "@/lib/studentRole";

describe("studentRole", () => {
  describe("normalizeCollegeSubdomain", () => {
    it("lowercases and strips invalid characters", () => {
      expect(normalizeCollegeSubdomain(" CR_Reddy!! ")).toBe("crreddy");
      expect(normalizeCollegeSubdomain(" CR-Reddy!! ")).toBe("cr-reddy");
    });

    it("collapses multiple hyphens", () => {
      expect(normalizeCollegeSubdomain("a---b")).toBe("a-b");
    });

    it("returns empty string for falsy input", () => {
      expect(normalizeCollegeSubdomain("")).toBe("");
      expect(normalizeCollegeSubdomain(null)).toBe("");
    });
  });

  describe("resolveCollegeSubdomain", () => {
    it("defaults to vawe when empty", () => {
      expect(resolveCollegeSubdomain("")).toBe(DEFAULT_COLLEGE_SUBDOMAIN);
      expect(resolveCollegeSubdomain(null)).toBe("vawe");
    });

    it("returns normalized subdomain when present", () => {
      expect(resolveCollegeSubdomain("CRReddy")).toBe("crreddy");
    });
  });

  describe("scoped role builders", () => {
    it("builds tenant-scoped roles", () => {
      expect(getScopedStudentRole("crreddy")).toBe("crreddyStudent");
      expect(getScopedCrtStudentRole("crreddy")).toBe("crreddyCrtStudent");
      expect(getScopedInternshipRole("crreddy")).toBe("crreddyInternship");
      expect(getScopedSkillwinsRole("crreddy")).toBe("crreddySkillwins");
    });

    it("falls back for CRT when subdomain missing", () => {
      expect(getScopedCrtStudentRole("")).toBe("crtStudent");
    });
  });

  describe("role detectors", () => {
    it("detects CRT student roles", () => {
      expect(isCrtStudentRole("crtStudent")).toBe(true);
      expect(isCrtStudentRole("crreddyCrtStudent")).toBe(true);
      expect(isCrtStudentRole("student")).toBe(false);
    });

    it("detects internship roles", () => {
      expect(isScopedInternshipRole("internship")).toBe(true);
      expect(isScopedInternshipRole("vaweInternship")).toBe(true);
      expect(isScopedInternshipRole("student")).toBe(false);
    });

    it("detects skillwins roles", () => {
      expect(isSkillwinsStudentRole("skillwins")).toBe(true);
      expect(isSkillwinsStudentRole("vaweSkillwins")).toBe(true);
      expect(isSkillwinsStudentRole("student")).toBe(false);
    });

    it("detects scoped students but excludes CRT/internship/skillwins", () => {
      expect(isScopedStudentRole("student")).toBe(true);
      expect(isScopedStudentRole("vaweStudent")).toBe(true);
      expect(isScopedStudentRole("crtStudent")).toBe(false);
      expect(isScopedStudentRole("vaweInternship")).toBe(false);
      expect(isScopedStudentRole("vaweSkillwins")).toBe(false);
    });
  });

  describe("buildStudentRolesFromFlags", () => {
    it("returns default student role when no flags set", () => {
      expect(buildStudentRolesFromFlags({ collegeSubdomain: "vawe" })).toEqual([
        "vaweStudent",
      ]);
    });

    it("builds multiple roles from flags", () => {
      expect(
        buildStudentRolesFromFlags({
          isCrt: true,
          isInternship: true,
          collegeSubdomain: "crreddy",
        })
      ).toEqual(["crreddyInternship", "crreddyCrtStudent"]);
    });
  });

  describe("inferStudentRole", () => {
    it("infers CRT role from flag", () => {
      expect(
        inferStudentRole({ isCrt: true, collegeSubdomain: "vawe" })
      ).toBe("vaweCrtStudent");
    });

    it("defaults to vaweStudent when student is null", () => {
      expect(inferStudentRole(null)).toBe("vaweStudent");
    });
  });
});
