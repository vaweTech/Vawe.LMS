import { collection, getDocs } from "firebase/firestore";
import { createSlug } from "./urlUtils";

/**
 * Find CRT program doc + course doc from URL slugs (same logic as CRT course page).
 */
export async function resolveCrtAndCourse(db, programSlug, courseSlug, programTitleFallback) {
  if (!db || !programSlug || !courseSlug) {
    return { crtId: null, courseId: null, courseData: null };
  }
  const crtSnap = await getDocs(collection(db, "crt"));
  for (const crtDoc of crtSnap.docs) {
    const data = crtDoc.data();
    const matchesProgram =
      crtDoc.id === programSlug ||
      (data.programId && data.programId === programSlug) ||
      (data.name && createSlug(data.name) === programSlug) ||
      (programTitleFallback && data.name && data.name === programTitleFallback);
    if (!matchesProgram) continue;
    const coursesRef = collection(db, "crt", crtDoc.id, "courses");
    const coursesSnap = await getDocs(coursesRef);
    const found = coursesSnap.docs.find(
      (c) => c.id === courseSlug || createSlug(c.data().title || "") === courseSlug
    );
    if (found) {
      return { crtId: crtDoc.id, courseId: found.id, courseData: found.data() };
    }
  }
  return { crtId: null, courseId: null, courseData: null };
}
