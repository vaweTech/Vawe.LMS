import {
  COLLEGE_TENANTS_COLLECTION,
  normalizeCollegeSubdomain,
  getCollegeSubdomainFromHost,
  getClientCollegeSubdomain,
  tenantSegments,
} from "@/lib/tenantPath";

describe("tenantPath", () => {
  describe("normalizeCollegeSubdomain", () => {
    it("normalizes subdomain strings", () => {
      expect(normalizeCollegeSubdomain(" Foo_Bar ")).toBe("foobar");
      expect(normalizeCollegeSubdomain(" Foo-Bar ")).toBe("foo-bar");
    });
  });

  describe("getCollegeSubdomainFromHost", () => {
    it("returns null for localhost", () => {
      expect(getCollegeSubdomainFromHost("localhost:3000")).toBeNull();
      expect(getCollegeSubdomainFromHost("127.0.0.1")).toBeNull();
    });

    it("extracts first label as subdomain", () => {
      expect(getCollegeSubdomainFromHost("crreddy.example.com")).toBe("crreddy");
    });

    it("returns null for empty host", () => {
      expect(getCollegeSubdomainFromHost("")).toBeNull();
      expect(getCollegeSubdomainFromHost(null)).toBeNull();
    });
  });

  describe("getClientCollegeSubdomain", () => {
    it("returns null (URL subdomain disabled)", () => {
      expect(getClientCollegeSubdomain()).toBeNull();
    });
  });

  describe("tenantSegments", () => {
    it("prefixes collegeTenants path when subdomain present", () => {
      expect(tenantSegments("crreddy", "students")).toEqual([
        COLLEGE_TENANTS_COLLECTION,
        "crreddy",
        "students",
      ]);
    });

    it("returns legacy segments when subdomain missing", () => {
      expect(tenantSegments("", "students", "abc")).toEqual(["students", "abc"]);
      expect(tenantSegments(null, "users")).toEqual(["users"]);
    });
  });
});
