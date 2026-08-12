/** Default tenant for main VAWE LMS (no college subdomain on host). */
export const DEFAULT_COLLEGE_SUBDOMAIN = "vawe";

export function normalizeCollegeSubdomain(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveCollegeSubdomain(raw) {
  return normalizeCollegeSubdomain(raw) || DEFAULT_COLLEGE_SUBDOMAIN;
}

export function getScopedCrtStudentRole(collegeSubdomain) {
  const sub = normalizeCollegeSubdomain(collegeSubdomain);
  return sub ? `${sub}CrtStudent` : "crtStudent";
}

export function getScopedStudentRole(collegeSubdomain) {
  const sub = resolveCollegeSubdomain(collegeSubdomain);
  return `${sub}Student`;
}

export function getScopedInternshipRole(collegeSubdomain) {
  const sub = resolveCollegeSubdomain(collegeSubdomain);
  return `${sub}Internship`;
}

/** vawe.skillwins portal students (e.g. vaweSkillwins). */
export function getScopedSkillwinsRole(collegeSubdomain) {
  const sub = resolveCollegeSubdomain(collegeSubdomain);
  return `${sub}Skillwins`;
}

export function isSkillwinsStudentRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return false;
  if (value === "skillwins" || value === "vaweskillwins") return true;
  return value.endsWith("skillwins");
}

export function isCrtStudentRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return false;
  return value === "crtstudent" || value.endsWith("crtstudent");
}

export function isScopedInternshipRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return false;
  if (value === "internship") return true;
  return value.endsWith("internship");
}

/** @deprecated Use isScopedInternshipRole */
export function isInternshipRole(role) {
  return isScopedInternshipRole(role);
}

export function isScopedStudentRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return false;
  if (isCrtStudentRole(role) || isScopedInternshipRole(role) || isSkillwinsStudentRole(role)) {
    return false;
  }
  if (value === "student") return true;
  return value.endsWith("student");
}

export function isLegacyStudentRole(role) {
  return String(role || "").trim().toLowerCase() === "student";
}

export function isLegacyInternshipRole(role) {
  return String(role || "").trim().toLowerCase() === "internship";
}

export function inferStudentRole(student) {
  if (!student) return getScopedStudentRole(DEFAULT_COLLEGE_SUBDOMAIN);
  if (Array.isArray(student.roles) && student.roles.length > 0) {
    return resolvePrimaryStudentRole(student);
  }
  const sub = resolveCollegeSubdomain(student.collegeSubdomain);

  if (student.isCrt) return getScopedCrtStudentRole(sub);
  if (student.isSkillwins || student.isSkillWins) return getScopedSkillwinsRole(sub);
  if (student.isInternship) return getScopedInternshipRole(sub);

  const role = String(student.role || "").trim();
  if (role) {
    if (isCrtStudentRole(role)) return getScopedCrtStudentRole(sub);
    if (isSkillwinsStudentRole(role)) return getScopedSkillwinsRole(sub);
    if (isScopedInternshipRole(role) || isLegacyInternshipRole(role)) {
      return getScopedInternshipRole(sub);
    }
    return role;
  }

  return getScopedStudentRole(sub);
}

/** Build scoped role strings from admin checkbox flags (supports multiple roles). */
export function buildStudentRolesFromFlags({
  isCrt = false,
  isInternship = false,
  isSkillwins = false,
  collegeSubdomain,
}) {
  const roles = [];
  if (isInternship) roles.push(getScopedInternshipRole(collegeSubdomain));
  if (isCrt) roles.push(getScopedCrtStudentRole(collegeSubdomain));
  if (isSkillwins) roles.push(getScopedSkillwinsRole(collegeSubdomain));
  if (!roles.length) roles.push(getScopedStudentRole(collegeSubdomain));
  return [...new Set(roles)];
}

/** Read all roles for a student (array is canonical when present). */
export function getStudentRoles(student) {
  if (!student) return [getScopedStudentRole(DEFAULT_COLLEGE_SUBDOMAIN)];
  const sub = resolveCollegeSubdomain(student.collegeSubdomain);
  if (Array.isArray(student.roles) && student.roles.length > 0) {
    return [
      ...new Set(
        student.roles.map((r) => coerceStudentRoleForSave(r, sub)).filter(Boolean)
      ),
    ];
  }
  return buildStudentRolesFromFlags({
    isCrt: !!(student.isCrt || isCrtStudentRole(student.role)),
    isInternship: !!(student.isInternship || isScopedInternshipRole(student.role)),
    isSkillwins: !!(student.isSkillwins || student.isSkillWins || isSkillwinsStudentRole(student.role)),
    collegeSubdomain: sub,
  });
}

/** Primary `role` field when a student has multiple roles (CRT > Skillwins > Internship > Student). */
export function resolvePrimaryStudentRole(student) {
  const roles = getStudentRoles(student);
  const sub = resolveCollegeSubdomain(student?.collegeSubdomain);
  if (roles.some((r) => isCrtStudentRole(r))) return getScopedCrtStudentRole(sub);
  if (roles.some((r) => isSkillwinsStudentRole(r))) return getScopedSkillwinsRole(sub);
  if (roles.some((r) => isScopedInternshipRole(r))) return getScopedInternshipRole(sub);
  return getScopedStudentRole(sub);
}

export function studentHasInternshipRole(student) {
  return getStudentRoles(student).some((r) => isScopedInternshipRole(r));
}

export function studentHasCrtRole(student) {
  return getStudentRoles(student).some((r) => isCrtStudentRole(r));
}

export function studentHasSkillwinsRole(student) {
  return getStudentRoles(student).some((r) => isSkillwinsStudentRole(r));
}

/** Persistable role fields: `roles` array + legacy flags + primary `role`. */
export function resolveStudentRoleFieldsForSave({
  isCrt = false,
  isInternship = false,
  isSkillwins = false,
  collegeSubdomain,
}) {
  const roles = buildStudentRolesFromFlags({ isCrt, isInternship, isSkillwins, collegeSubdomain });
  const primaryRole = resolvePrimaryStudentRole({
    collegeSubdomain,
    roles,
  });
  const typeFlags = resolveStudentTypeFlags(
    { isCrt, isInternship, isSkillwins },
    primaryRole
  );
  return {
    roles,
    role: coerceStudentRoleForSave(primaryRole, collegeSubdomain),
    isCrt: typeFlags.isCrt,
    isInternship: typeFlags.isInternship,
    isSkillwins: typeFlags.isSkillwins,
    portal: typeFlags.portal || null,
  };
}

/** Single source of truth for isCrt / isSkillwins / isInternship / portal from resolved role. */
export function normalizeStudentTypeFlags(derivedRole) {
  const isCrt = isCrtStudentRole(derivedRole);
  const isSkillwins = isSkillwinsStudentRole(derivedRole);
  const isInternship = isScopedInternshipRole(derivedRole);
  return {
    isCrt,
    isSkillwins,
    isInternship,
    portal: isSkillwins ? "vawe.skillwins" : null,
  };
}

/** Merge explicit doc/body flags with role-derived flags (supports Internship + CRT together). */
export function resolveStudentTypeFlags(source, derivedRole) {
  const fromRole = normalizeStudentTypeFlags(derivedRole);
  return {
    isCrt: !!(source?.isCrt || fromRole.isCrt),
    isSkillwins: !!(source?.isSkillwins || source?.isSkillWins || fromRole.isSkillwins),
    isInternship: !!(source?.isInternship || fromRole.isInternship),
    portal: source?.portal || fromRole.portal || null,
  };
}

export function formatStudentRoleLabelsForDoc(student) {
  if (!student) return "Student";
  const roles = getStudentRoles(student);
  const labels = [];
  if (roles.some((r) => isScopedInternshipRole(r))) labels.push("Internship");
  if (roles.some((r) => isCrtStudentRole(r))) labels.push("CRT");
  if (roles.some((r) => isSkillwinsStudentRole(r))) labels.push("vawe.skillwins");
  if (labels.length) return labels.join(" + ");
  return formatStudentRoleLabel(resolvePrimaryStudentRole(student));
}

export function formatStudentRoleLabel(role) {
  if (isCrtStudentRole(role)) return String(role || "CRT Student");
  if (isSkillwinsStudentRole(role)) return "vawe.skillwins";
  if (isScopedInternshipRole(role)) return "Internship";
  if (isScopedStudentRole(role)) return "Student";
  return String(role || "Student");
}

export function matchesStudentRoleFilter(roleOrStudent, filter) {
  if (!filter) return true;
  const student =
    roleOrStudent && typeof roleOrStudent === "object" ? roleOrStudent : null;
  const role = student ? resolvePrimaryStudentRole(student) : roleOrStudent;
  const roles = student ? getStudentRoles(student) : [role];

  if (filter === "crtStudent") {
    return roles.some((r) => isCrtStudentRole(r)) || (student && student.isCrt);
  }
  if (filter === "skillwins") {
    return roles.some((r) => isSkillwinsStudentRole(r));
  }
  if (filter === "internship") {
    return roles.some((r) => isScopedInternshipRole(r)) || (student && student.isInternship);
  }
  if (filter === "student") {
    return (
      roles.some((r) => isScopedStudentRole(r)) &&
      !roles.some((r) => isCrtStudentRole(r) || isScopedInternshipRole(r) || isSkillwinsStudentRole(r))
    );
  }
  return String(role || "").trim() === filter;
}

/** Roles to count toward college student limit (legacy + scoped). */
export function getStudentLimitRoles(collegeSubdomain) {
  const scoped = getScopedStudentRole(collegeSubdomain);
  return scoped === "student" ? ["student"] : ["student", scoped];
}

/** Firestore `in` query values for internship students (legacy + scoped). */
export function getInternshipRoleQueryValues(collegeSubdomain) {
  const scoped = getScopedInternshipRole(collegeSubdomain);
  return [...new Set(["internship", scoped])];
}

/** Firestore `in` query values for regular students (legacy + scoped). */
export function getStudentRoleQueryValues(collegeSubdomain) {
  const scoped = getScopedStudentRole(collegeSubdomain);
  return [...new Set(["student", scoped])];
}

/** Firestore `in` query values for CRT students (legacy + scoped). */
export function getCrtStudentRoleQueryValues(collegeSubdomain) {
  const scoped = getScopedCrtStudentRole(collegeSubdomain);
  return [...new Set(["crtStudent", scoped])];
}

function crtStudentMergeKey(student) {
  const uid = String(student?.uid || "").trim();
  if (uid) return `uid:${uid}`;
  const docId = String(student?.studentDocId || student?.id || "").trim();
  if (docId) return `doc:${docId}`;
  const email = String(student?.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  return "";
}

/** Merge central CRT roster docs with main `students` collection CRT docs (deduped). */
export function mergeCrtStudentsForAdmin(rosterStudents = [], collectionStudents = []) {
  const byKey = new Map();

  rosterStudents.forEach((student) => {
    const key = crtStudentMergeKey(student);
    if (!key) return;
    byKey.set(key, { ...student, isCrt: true });
  });

  collectionStudents.forEach((student) => {
    const normalized = normalizeStudentDoc(student);
    if (!studentHasCrtRole(normalized)) return;
    const key = crtStudentMergeKey(normalized) || `doc:${normalized.id}`;
    const existing = byKey.get(key);
    byKey.set(key, {
      ...(existing || {}),
      ...normalized,
      id: existing?.id || normalized.uid || normalized.id,
      studentDocId: normalized.id,
      isCrt: true,
      isInternship: !!(normalized.isInternship || existing?.isInternship),
    });
  });

  return [...byKey.values()];
}

export function isInternshipStudentDoc(student) {
  if (!student) return false;
  return studentHasInternshipRole(student);
}

export function isSkillwinsStudentDoc(student) {
  if (!student) return false;
  return !!student.isSkillwins || !!student.isSkillWins || isSkillwinsStudentRole(student.role);
}

export function isRegularStudentDoc(student) {
  if (!student) return false;
  if (studentHasCrtRole(student)) return false;
  if (isSkillwinsStudentDoc(student)) return false;
  if (isInternshipStudentDoc(student)) return false;
  const roles = getStudentRoles(student);
  return (
    roles.some((r) => isScopedStudentRole(r) || isLegacyStudentRole(r)) ||
    roles.length === 0
  );
}

/** Normalize student doc for admin UI (resolved role + aligned type flags). */
export function normalizeStudentDoc(student) {
  if (!student) return student;
  const sub = resolveCollegeSubdomain(student.collegeSubdomain);
  const roles = getStudentRoles(student);
  const role = resolvePrimaryStudentRole({ ...student, roles });
  const isCrt = roles.some((r) => isCrtStudentRole(r));
  const isInternship = roles.some((r) => isScopedInternshipRole(r));
  const isSkillwins = roles.some((r) => isSkillwinsStudentRole(r));
  const flags = resolveStudentTypeFlags(
    { isCrt, isInternship, isSkillwins, portal: student.portal },
    role
  );
  return {
    ...student,
    collegeSubdomain: student.collegeSubdomain || sub,
    roles,
    role,
    isCrt: flags.isCrt,
    isInternship: flags.isInternship,
    isSkillwins: flags.isSkillwins,
    portal: flags.portal ?? student.portal ?? null,
  };
}

export function normalizeStudentsForAdmin(students) {
  return (students || []).map((s) => normalizeStudentDoc(s));
}

/** Whether a student doc belongs to the active college tenant (for admin lists). */
export function belongsToCollegeTenant(student, tenantSubdomain) {
  const tenant = resolveCollegeSubdomain(tenantSubdomain);
  const docSub = normalizeCollegeSubdomain(student?.collegeSubdomain);
  if (!docSub) return tenant === DEFAULT_COLLEGE_SUBDOMAIN;
  return docSub === tenant;
}

/** LMS pool — includes internship (+ dual CRT+internship). Pure CRT-only uses CRT filter. */
export function isLmsStudentDoc(student) {
  if (!student) return false;
  if (isSkillwinsStudentDoc(student)) return false;
  if (studentHasInternshipRole(student)) return true;
  if (studentHasCrtRole(student)) return false;
  return isRegularStudentDoc(student);
}

/** Map legacy role strings to scoped roles when saving from admin forms. */
export function coerceStudentRoleForSave(role, collegeSubdomain) {
  const raw = String(role || "").trim();
  if (!raw) return getScopedStudentRole(collegeSubdomain);
  if (isCrtStudentRole(raw)) return getScopedCrtStudentRole(collegeSubdomain);
  if (isSkillwinsStudentRole(raw)) return getScopedSkillwinsRole(collegeSubdomain);
  if (isLegacyStudentRole(raw) || isScopedStudentRole(raw)) {
    return getScopedStudentRole(collegeSubdomain);
  }
  if (isLegacyInternshipRole(raw) || isScopedInternshipRole(raw)) {
    return getScopedInternshipRole(collegeSubdomain);
  }
  return raw;
}
