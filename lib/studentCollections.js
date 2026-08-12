import { tenantSegments } from "@/lib/tenantPath";

/** All Firestore `students` collection paths to search (root + college tenant). */
export function getStudentCollectionSegmentVariants(
  collegeSubdomain,
  requestCollegeSubdomain
) {
  const subs = [
    ...new Set([collegeSubdomain, requestCollegeSubdomain].filter(Boolean)),
  ];
  const paths = [tenantSegments(null, "students")];
  subs.forEach((sub) => paths.push(tenantSegments(sub, "students")));
  const seen = new Set();
  return paths.filter((segs) => {
    const key = segs.join("/");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
