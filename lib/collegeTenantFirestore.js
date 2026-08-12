/**
 * Multi-tenant CRT staff paths. College admins use `collegeTenants/{subdomain}/…`.
 * Superadmin / full admin use legacy `users/…` paths (shared) when subdomain is absent.
 */

export const COLLEGE_TENANTS_COLLECTION = "collegeTenants";

/** @param {string | null | undefined} subdomain */
export function crtTrainerCollectionSegments(subdomain) {
  if (subdomain) {
    return [COLLEGE_TENANTS_COLLECTION, subdomain, "crtTrainers"];
  }
  return ["users", "crtTrainers", "trainers"];
}

/** @param {string | null | undefined} subdomain @param {string} trainerUid */
export function crtTrainerDocSegments(subdomain, trainerUid) {
  return [...crtTrainerCollectionSegments(subdomain), trainerUid];
}

/** @param {string | null | undefined} subdomain */
export function crtPoCollectionSegments(subdomain) {
  if (subdomain) {
    return [COLLEGE_TENANTS_COLLECTION, subdomain, "crtPO"];
  }
  return ["users", "crtPO", "po"];
}

/** @param {string | null | undefined} subdomain @param {string} poId */
export function crtPoDocSegments(subdomain, poId) {
  return [...crtPoCollectionSegments(subdomain), poId];
}

/** @param {string | null | undefined} subdomain */
export function crtStudentRosterCollectionSegments(subdomain) {
  if (subdomain) {
    return [COLLEGE_TENANTS_COLLECTION, subdomain, "crtStudents"];
  }
  return ["users", "crtStudent", "students"];
}

/** @param {string | null | undefined} subdomain @param {string} studentUid */
export function crtStudentRosterDocSegments(subdomain, studentUid) {
  return [...crtStudentRosterCollectionSegments(subdomain), studentUid];
}

/**
 * Incharge listing: legacy `users/crtActiveIncharge/{activeIncharge|classroomMonitor}`.
 * Tenant: `collegeTenants/{sub}/{activeIncharge|classroomMonitor}`.
 * @param {string | null | undefined} subdomain
 * @param {"activeIncharge" | "classroomMonitor"} subcollectionName
 */
export function crtInchargeSubcollectionSegments(subdomain, subcollectionName) {
  if (subdomain) {
    return [COLLEGE_TENANTS_COLLECTION, subdomain, subcollectionName];
  }
  return ["users", "crtActiveIncharge", subcollectionName];
}

/** @param {string | null | undefined} subdomain @param {string} subcollectionName @param {string} docId */
export function crtInchargeDocSegments(subdomain, subcollectionName, docId) {
  return [...crtInchargeSubcollectionSegments(subdomain, subcollectionName), docId];
}

/**
 * Nested assignments mirror under each incharge doc.
 * @param {string | null | undefined} subdomain
 * @param {string} subcollectionName
 * @param {string} inchargeDocId
 */
export function crtInchargeAssignedClassesCollectionSegments(
  subdomain,
  subcollectionName,
  inchargeDocId
) {
  return [...crtInchargeDocSegments(subdomain, subcollectionName, inchargeDocId), "assignedClasses"];
}
