import { crtStudentRosterDocSegments } from "@/lib/collegeTenantFirestore";

/** Firestore document paths (slash-separated) for CRT roster entries to remove. */
export function getCrtRosterDocPathsToDelete({
  uid,
  docId,
  collegeSubdomain,
  requestCollegeSubdomain,
}) {
  const rosterIds = [...new Set([uid, docId].filter(Boolean))];
  if (!rosterIds.length) return [];

  const subdomains = [];
  if (collegeSubdomain) subdomains.push(collegeSubdomain);
  if (
    requestCollegeSubdomain &&
    requestCollegeSubdomain !== collegeSubdomain
  ) {
    subdomains.push(requestCollegeSubdomain);
  }
  subdomains.push(null);

  const paths = [];
  for (const sub of subdomains) {
    for (const rosterId of rosterIds) {
      paths.push(crtStudentRosterDocSegments(sub, rosterId).join("/"));
    }
  }
  return [...new Set(paths)];
}
