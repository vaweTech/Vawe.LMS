"use client";

import { useMemo } from "react";
import { useAdminAccess } from "../AdminAccessContext";
import {
  resolveCollegeSubdomain,
  getScopedStudentRole,
  getScopedInternshipRole,
  getScopedCrtStudentRole,
  getInternshipRoleQueryValues,
  getStudentRoleQueryValues,
  normalizeStudentDoc,
  normalizeStudentsForAdmin,
  isInternshipStudentDoc,
  isRegularStudentDoc,
  isScopedStudentRole,
  isScopedInternshipRole,
  isCrtStudentRole,
  inferStudentRole,
  matchesStudentRoleFilter,
  formatStudentRoleLabel,
  coerceStudentRoleForSave,
} from "@/lib/studentRole";

/**
 * Shared student role helpers for all Admin pages.
 * Treats legacy `student` / `internship` the same as `vaweStudent` / `vaweInternship`.
 */
export function useAdminStudentRole() {
  const { collegeSubdomain, tenantSubdomain } = useAdminAccess();

  return useMemo(
    () => ({
      collegeSubdomain,
      tenantSubdomain,
      scopedStudentRole: getScopedStudentRole(tenantSubdomain),
      scopedInternshipRole: getScopedInternshipRole(tenantSubdomain),
      scopedCrtStudentRole: getScopedCrtStudentRole(collegeSubdomain),
      internshipRoleQueryValues: getInternshipRoleQueryValues(tenantSubdomain),
      studentRoleQueryValues: getStudentRoleQueryValues(tenantSubdomain),
      normalizeStudent: normalizeStudentDoc,
      normalizeStudents: normalizeStudentsForAdmin,
      isInternshipStudent: isInternshipStudentDoc,
      isRegularStudent: isRegularStudentDoc,
      isScopedStudentRole,
      isScopedInternshipRole,
      isCrtStudentRole,
      inferRole: inferStudentRole,
      matchesFilter: matchesStudentRoleFilter,
      formatLabel: formatStudentRoleLabel,
      coerceRoleForSave: (role) => coerceStudentRoleForSave(role, tenantSubdomain),
    }),
    [collegeSubdomain, tenantSubdomain]
  );
}
