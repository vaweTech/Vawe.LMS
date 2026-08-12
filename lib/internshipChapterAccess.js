/** Collect unlocked chapter ids from a chapterAccess map (copy + optional source course). */
export function collectChapterAccessIds(chapterAccess, courseId, sourceCourseId) {
  const ids = new Set();
  if (!chapterAccess || typeof chapterAccess !== "object") return [];
  const fromCopy = chapterAccess[courseId];
  if (Array.isArray(fromCopy)) fromCopy.forEach((id) => ids.add(id));
  if (sourceCourseId) {
    const fromSource = chapterAccess[sourceCourseId];
    if (Array.isArray(fromSource)) fromSource.forEach((id) => ids.add(id));
  }
  return [...ids];
}

/**
 * Map stored access ids to current internship chapter document ids.
 * Handles legacy ids from the master course via copiedFromChapterId.
 */
export function normalizeUnlockedChapterIds(chapters, accessIds) {
  const list = Array.isArray(chapters) ? chapters : [];
  const raw = Array.isArray(accessIds) ? accessIds : [];
  if (list.length === 0) return [...new Set(raw)];

  const copyIds = new Set(list.map((ch) => ch.id));
  const byCopiedFrom = new Map();
  list.forEach((ch) => {
    if (ch.copiedFromChapterId) byCopiedFrom.set(ch.copiedFromChapterId, ch.id);
  });

  const out = new Set();
  for (const id of raw) {
    if (!id) continue;
    if (copyIds.has(id)) out.add(id);
    else if (byCopiedFrom.has(id)) out.add(byCopiedFrom.get(id));
  }
  return [...out];
}
