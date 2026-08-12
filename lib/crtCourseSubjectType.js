import { tenantSegments } from "@/lib/tenantPath";

/**
 * Whether a CRT programme course copy is non-technical (Aptitude & Soft Skills).
 * Checks the copy first, then the master crtCourses doc via sourceCourseId.
 */
export async function resolveCourseIsNonTechnical(
  db,
  firestoreHelpers,
  courseData,
  collegeSubdomain = null
) {
  if (courseData?.isNonTechnical === true) return true;
  const sourceId = courseData?.sourceCourseId;
  if (!sourceId || !db) return false;
  try {
    const masterSnap = await firestoreHelpers.getDoc(
      firestoreHelpers.doc(db, ...tenantSegments(collegeSubdomain, "crtCourses"), sourceId)
    );
    if (masterSnap.exists()) {
      return masterSnap.data().isNonTechnical === true;
    }
  } catch (_) {
    /* optional master lookup */
  }
  return false;
}

/** Attach resolved isNonTechnical to each CRT programme course. */
export async function enrichCrtCoursesWithSubjectType(
  db,
  firestoreHelpers,
  courses,
  collegeSubdomain = null
) {
  return Promise.all(
    courses.map(async (course) => ({
      ...course,
      isNonTechnical: await resolveCourseIsNonTechnical(
        db,
        firestoreHelpers,
        course,
        collegeSubdomain
      ),
    }))
  );
}
