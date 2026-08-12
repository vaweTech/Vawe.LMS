/** Roles that use trainer assignment fields on users/{uid}. */
export function isTrainerLikeRole(role) {
  return (
    role === "trainer" ||
    role === "crtTrainer" ||
    role === "admin" ||
    role === "superadmin"
  );
}

/**
 * True when admin assigned this user to the course copy, master course, or internship.
 * Used to grant full chapter/assignment access for trainers only (not students).
 */
export function trainerIsAssignedToCourse(userData, { courseId, sourceCourseId, internshipId } = {}) {
  if (!userData || !isTrainerLikeRole(userData.role)) return false;
  const courses = Array.isArray(userData.trainerCourses) ? userData.trainerCourses : [];
  const internships = Array.isArray(userData.trainerInternships) ? userData.trainerInternships : [];
  if (internshipId && internships.includes(internshipId)) return true;
  if (courseId && courses.includes(courseId)) return true;
  if (sourceCourseId && courses.includes(sourceCourseId)) return true;
  return false;
}
