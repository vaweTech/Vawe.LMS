"use client";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { mcqDb } from "@/lib/firebaseMCQs";
import { createSlug } from "@/lib/urlUtils";

/**
 * Batch copies of programme courses.
 *
 * A programme course (`crt/{p}/courses/{c}`) is shared by every batch. To let one batch change days or
 * tests without affecting the others, the course is copied for that batch:
 *   copy:     { ...course, batchIds: [batchId], forkedFromCourseId: c, forkedForBatchName }
 *   original: hiddenForBatchIds += batchId
 * Every batch-aware screen then shows the copy to that batch and the original to everyone else.
 */

function asIdList(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Whether a programme course should be shown to a batch. */
export function isCourseVisibleToBatch(course, batchId) {
  if (!course) return false;
  const only = asIdList(course.batchIds);
  if (only.length > 0) return !!batchId && only.includes(String(batchId));
  return !batchId || !asIdList(course.hiddenForBatchIds).includes(String(batchId));
}

/** Visible to any of the student's batches (no batches → only courses not limited to a batch). */
export function isCourseVisibleToAnyBatch(course, batchIds = []) {
  if (!batchIds.length) return asIdList(course?.batchIds).length === 0;
  return batchIds.some((b) => isCourseVisibleToBatch(course, b));
}

/** URL segment for a course page. Batch copies share their title, so they are addressed by id. */
export function crtCourseUrlSegment(course) {
  if (!course) return "";
  const title = course.title || course.name || "";
  return course.forkedFromCourseId ? course.id : createSlug(title) || course.id;
}

async function copyCollection(fromRef, toRef, mapData = (d) => d) {
  const snap = await getDocs(fromRef);
  const idMap = new Map();
  for (const d of snap.docs) {
    const created = await addDoc(toRef, mapData(d.data() || {}, d.id));
    idMap.set(d.id, created.id);
  }
  return idMap;
}

/**
 * Copy a programme course for one batch and move that batch's unlocks and attendance onto the copy.
 * Returns the new course id.
 */
export async function forkCourseForBatch(db, { crtId, courseId, batchId, batchName, userId }) {
  const courseRef = doc(db, "crt", crtId, "courses", courseId);
  const courseSnap = await getDoc(courseRef);
  if (!courseSnap.exists()) throw new Error("Course not found.");
  const course = courseSnap.data() || {};
  if (asIdList(course.batchIds).length > 0) throw new Error("This course is already a batch copy.");
  if (asIdList(course.hiddenForBatchIds).includes(String(batchId))) {
    throw new Error("This batch already has its own copy of this course.");
  }

  const copyRef = await addDoc(collection(db, "crt", crtId, "courses"), {
    ...course,
    hiddenForBatchIds: [],
    batchIds: [String(batchId)],
    forkedFromCourseId: courseId,
    forkedForBatchName: batchName || batchId,
    forkedAt: new Date().toISOString(),
    forkedBy: userId || null,
  });
  const newCourseId = copyRef.id;

  const chapterIdMap = await copyCollection(
    collection(db, "crt", crtId, "courses", courseId, "chapters"),
    collection(db, "crt", crtId, "courses", newCourseId, "chapters")
  );
  try {
    await copyCollection(
      collection(db, "crt", crtId, "courses", courseId, "referenceMaterials"),
      collection(db, "crt", crtId, "courses", newCourseId, "referenceMaterials")
    );
  } catch (_) {
    /* optional */
  }
  await copyCollection(
    collection(mcqDb, "copiedcourses", courseId, "assignments"),
    collection(mcqDb, "copiedcourses", newCourseId, "assignments"),
    (data, sourceId) => ({ ...data, sourceAssignmentId: sourceId, copiedAt: new Date().toISOString() })
  );

  // Day unlocks of this batch → the copy's chapter ids.
  const unlocksSnap = await getDocs(
    collection(db, "crt", crtId, "batches", batchId, "courses", courseId, "chapterUnlocks")
  );
  for (const u of unlocksSnap.docs) {
    const newChapterId = chapterIdMap.get(u.id);
    if (!newChapterId) continue;
    await setDoc(
      doc(db, "crt", crtId, "batches", batchId, "courses", newCourseId, "chapterUnlocks", newChapterId),
      u.data() || {}
    );
    await deleteDoc(u.ref);
  }

  // Attendance sessions of this batch → the copy (doc id includes course + chapter, so re-create).
  const attSnap = await getDocs(
    query(collection(db, "attendance"), where("type", "==", "trainer"), where("batchId", "==", batchId))
  );
  for (const a of attSnap.docs) {
    const x = a.data() || {};
    if (x.crtProgramId !== crtId || x.courseId !== courseId) continue;
    const newChapterId = chapterIdMap.get(x.chapterId) || x.chapterId;
    const s = (v) => String(v ?? "").replace(/\//g, "-");
    const newId = `TR_${s(crtId)}_${s(batchId)}_${s(newCourseId)}_${s(newChapterId)}_${x.date}`;
    await setDoc(doc(db, "attendance", newId), { ...x, courseId: newCourseId, chapterId: newChapterId });
    try {
      const hist = await getDocs(collection(db, "attendance", a.id, "history"));
      for (const h of hist.docs) {
        await setDoc(doc(db, "attendance", newId, "history", h.id), h.data() || {});
        await deleteDoc(h.ref);
      }
    } catch (_) {
      /* history is optional */
    }
    await deleteDoc(a.ref);
  }

  await updateDoc(courseRef, { hiddenForBatchIds: arrayUnion(String(batchId)) });
  return newCourseId;
}

/**
 * Delete a batch copy and give the batch the shared course again. The batch's unlocks and attendance
 * on the copy are not moved back (their day ids only exist in the copy).
 */
export async function removeBatchCopy(db, { crtId, copyCourseId }) {
  const copyRef = doc(db, "crt", crtId, "courses", copyCourseId);
  const copySnap = await getDoc(copyRef);
  if (!copySnap.exists()) return;
  const copy = copySnap.data() || {};
  const originalId = copy.forkedFromCourseId;
  const batchIds = asIdList(copy.batchIds);

  const chapters = await getDocs(collection(db, "crt", crtId, "courses", copyCourseId, "chapters"));
  for (const ch of chapters.docs) await deleteDoc(ch.ref);
  try {
    const refs = await getDocs(collection(db, "crt", crtId, "courses", copyCourseId, "referenceMaterials"));
    for (const r of refs.docs) await deleteDoc(r.ref);
  } catch (_) {
    /* optional */
  }
  const tests = await getDocs(collection(mcqDb, "copiedcourses", copyCourseId, "assignments"));
  for (const t of tests.docs) await deleteDoc(t.ref);
  await deleteDoc(copyRef);

  if (originalId) {
    for (const b of batchIds) {
      await updateDoc(doc(db, "crt", crtId, "courses", originalId), {
        hiddenForBatchIds: arrayRemove(b),
      }).catch(() => {});
    }
  }
}
