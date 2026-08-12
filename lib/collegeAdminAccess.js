/**
 * College-scoped admin: role collegeAdmin with moduleLms / moduleCrt flags on users/{uid}.
 */

/** Normalize role strings from Firestore (e.g. "CollegeAdmin", "DATAENTRY"). */
export function canonicalAdminRole(source) {
  const raw =
    source != null && typeof source === "object" && !Array.isArray(source)
      ? source.role ?? source.Role
      : source;
  if (raw == null || raw === "") return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  const map = {
    admin: "admin",
    administrator: "admin",
    superadmin: "superadmin",
    collegeadmin: "collegeAdmin",
    college_admin: "collegeAdmin",
    dataentry: "dataentry",
  };
  return map[key] ?? null;
}

/** Subdomain / tenant id from user root or profile document. */
export function subdomainFromUserOrDetails(d) {
  if (!d || typeof d !== "object") return null;
  const pick = (...keys) => {
    for (const k of keys) {
      const v = d[k];
      const s = v == null ? "" : String(v).trim();
      if (s) return s;
    }
    return null;
  };
  return pick("collegeSubdomain", "CollegeSubdomain", "subdomain", "Subdomain");
}

export function computeAdminAccess(role, moduleLms, moduleCrt) {
  // Treat collegeAdmin as full admin inside the app.
  // Tenant isolation already ensures they only affect their college data.
  const isFullAdmin = role === "admin" || role === "superadmin" || role === "collegeAdmin";
  const isCollegeAdmin = role === "collegeAdmin";
  const isDataEntry = role === "dataentry";
  return {
    isFullAdmin,
    isCollegeAdmin,
    isDataEntry,
    hasCrtManagerAccess:
      isFullAdmin || isDataEntry || (isCollegeAdmin && !!moduleCrt),
    hasLmsManagerAccess:
      isFullAdmin || isDataEntry || (isCollegeAdmin && !!moduleLms),
  };
}

/**
 * Route guard for collegeAdmin only. Full admins and dataentry should bypass in the layout.
 */
export function collegeAdminPathAllowed(pathname, moduleLms, moduleCrt) {
  // collegeAdmin has full access to Admin pages now.
  return true;
  // (legacy rules kept below for reference)
  const p = (pathname || "").replace(/\/$/, "") || "/Admin";
  if (p.startsWith("/Admin/register-form")) return false;
  if (p.startsWith("/Admin/analytics")) return false;
  if (p === "/Admin" || p === "/Admin/dashboard") return !!(moduleLms || moduleCrt);
  if (p.startsWith("/Admin/crt")) return !!moduleCrt;
  if (p.startsWith("/Admin/programs") || p.startsWith("/Admin/internships")) {
    return !!moduleLms;
  }
  return !!moduleLms;
}
