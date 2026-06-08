/**
 * Tenant path helpers.
 *
 * All tenant-scoped data lives under:
 *   collegeTenants/{collegeSubdomain}/...
 *
 * When `collegeSubdomain` is falsy, it falls back to legacy global paths.
 */

export const COLLEGE_TENANTS_COLLECTION = "collegeTenants";

export function normalizeCollegeSubdomain(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCollegeSubdomainFromHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return null;
  if (host.includes("localhost") || host.includes("127.0.0.1")) return null;
  const first = host.split(":")[0].split(".")[0] || "";
  const sub = normalizeCollegeSubdomain(first);
  return sub || null;
}

/** Client-only helper — URL subdomain disabled; use AdminAccessContext collegeSubdomain instead. */
export function getClientCollegeSubdomain() {
  return null;
}

/**
 * Build Firestore segments for a collection/doc path.
 * Example: tenantSegments("crreddy", "students") =>
 *   ["collegeTenants","crreddy","students"]
 */
export function tenantSegments(collegeSubdomain, ...segments) {
  const sub = normalizeCollegeSubdomain(collegeSubdomain);
  if (sub) return [COLLEGE_TENANTS_COLLECTION, sub, ...segments];
  return segments;
}

