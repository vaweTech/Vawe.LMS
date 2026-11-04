"use client";

import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { mcqDb } from "@/lib/firebaseMCQs";
import { createSlug } from "@/lib/urlUtils";
import { assignmentPercent, toDate } from "@/lib/assignmentScores";
import {
  findCrtBatchMembership,
  localDateStr,
  resolveCrtStudentBatchMatchKeys,
} from "@/lib/crtAttendance";

export const SCORE_TYPE_LABELS = {
  mcq: "MCQ",
  coding: "Coding",
  exam: "Full test",
};

const ENROLL_CACHE_MS = 5 * 60 * 1000;

function cacheKey(uid) {
  return `crtEnrollments:${uid}`;
}

function readCache(uid) {
  try {
    const raw = sessionStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.at > ENROLL_CACHE_MS) return null;
    return parsed.list;
  } catch (_) {
    return null;
  }
}

function writeCache(uid, list) {
  try {
    sessionStorage.setItem(cacheKey(uid), JSON.stringify({ at: Date.now(), list }));
  } catch (_) {
    /* storage full / disabled */
  }
}

function matchesIdentity(x, docId, identity) {
  const sid = String(x.studentId ?? x.uid ?? docId ?? "").trim();
  if (sid && identity.keys.has(sid)) return true;
  const uidField = String(x.uid ?? "").trim();
  if (uidField && identity.keys.has(uidField)) return true;
  const em = String(x.email ?? "").trim().toLowerCase();
  if (em && identity.emails.has(em)) return true;
  const regd = String(x.regdNo ?? "").trim();
  return !!regd && identity.regdNos.has(regd);
}

/**
 * CRT programmes the signed-in student belongs to (via a batch or the programme student list).
 * Returns [{ crtId, programName, slug, batches: [{ batchId, batchName, joinDate }] }].
 */
export async function findMyCrtEnrollments(db, authUser, { force = false } = {}) {
  const uid = authUser?.uid;
  if (!db || !uid) return [];
  if (!force) {
    const cached = readCache(uid);
    if (cached) return cached;
  }
  const identity = await resolveCrtStudentBatchMatchKeys(db, authUser);
  const crtSnap = await getDocs(collection(db, "crt"));
  const results = await Promise.all(
    crtSnap.docs.map(async (crtDoc) => {
      const data = crtDoc.data() || {};
      let batches = [];
      try {
        batches = await findCrtBatchMembership(db, crtDoc.id, identity);
      } catch (_) {
        batches = [];
      }
      let direct = false;
      if (batches.length === 0) {
        try {
          const stSnap = await getDocs(collection(db, "crt", crtDoc.id, "students"));
          direct = stSnap.docs.some((d) => matchesIdentity(d.data() || {}, d.id, identity));
        } catch (_) {
          direct = false;
        }
      }
      if (batches.length === 0 && !direct) return null;
      const programName = data.name || data.title || crtDoc.id;
      return {
        crtId: crtDoc.id,
        programName,
        slug: createSlug(programName),
        batches: batches.map((b) => ({ batchId: b.batchId, batchName: b.batchName, joinDate: b.joinDate })),
      };
    })
  );
  const list = results.filter(Boolean);
  writeCache(uid, list);
  return list;
}

function scoreOf(sub) {
  if (!sub) return null;
  const pct = assignmentPercent(sub);
  if (pct != null) return Math.round(pct);
  if (typeof sub.score === "number" && sub.total > 0) return Math.round((sub.score / sub.total) * 100);
  if (typeof sub.score === "number" && sub.score >= 0 && sub.score <= 100) return Math.round(sub.score);
  return null;
}

function average(list) {
  const nums = list.filter((n) => typeof n === "number");
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

/** Number of days of one course unlocked for any of the student's batches. */
async function countUnlockedClasses(db, crtId, courseId, batchIds) {
  const ids = new Set();
  await Promise.all(
    batchIds.map(async (batchId) => {
      try {
        const snap = await getDocs(
          collection(db, "crt", crtId, "batches", batchId, "courses", courseId, "chapterUnlocks")
        );
        snap.docs.forEach((d) => d.data()?.unlocked === true && ids.add(d.id));
      } catch (_) {
        /* no unlocks for this batch */
      }
    })
  );
  return ids.size;
}

/**
 * Every day assignment (MCQ / coding) and full-length test of one CRT programme with the signed-in
 * student's score. Returns { items, summary, courses } where summary has per-type counts and averages
 * and courses has, per course, classes unlocked / total and the average score of its assignments.
 */
export async function fetchMyCrtScores(db, authUser, crtId, programSlug = crtId, batchIds = []) {
  const uid = authUser?.uid;
  const empty = { items: [], summary: buildSummary([]), courses: [] };
  if (!db || !uid || !crtId) return empty;

  const coursesSnap = await getDocs(collection(db, "crt", crtId, "courses"));
  const courseStats = [];
  const dayItems = (
    await Promise.all(
      coursesSnap.docs.map(async (courseDoc) => {
        const course = courseDoc.data() || {};
        const courseTitle = course.title || course.name || "Course";
        const [totalClasses, unlockedClasses] = await Promise.all([
          getDocs(collection(db, "crt", crtId, "courses", courseDoc.id, "chapters"))
            .then((s) => s.size)
            .catch(() => 0),
          countUnlockedClasses(db, crtId, courseDoc.id, batchIds),
        ]);
        const stats = {
          courseId: courseDoc.id,
          courseTitle,
          href: `/crt/${programSlug}/courses/${createSlug(courseTitle)}`,
          totalClasses,
          unlockedClasses,
        };
        courseStats.push(stats);
        let assignmentsSnap;
        try {
          assignmentsSnap = await getDocs(collection(mcqDb, "copiedcourses", courseDoc.id, "assignments"));
        } catch (_) {
          return [];
        }
        return Promise.all(
          assignmentsSnap.docs.map(async (a) => {
            const x = a.data() || {};
            const type = x.type === "coding" ? "coding" : "mcq";
            const day = Number(x.day) || 1;
            let sub = null;
            try {
              const subSnap = await getDocs(
                query(
                  collection(mcqDb, "copiedcourses", courseDoc.id, "assignments", a.id, "submissions"),
                  where("studentId", "==", uid)
                )
              );
              sub = subSnap.empty ? null : subSnap.docs[0].data();
            } catch (_) {
              sub = null;
            }
            return {
              key: `day:${courseDoc.id}:${a.id}`,
              courseId: courseDoc.id,
              type,
              title: x.title || `Day ${day} ${type === "coding" ? "Coding" : "MCQ"} Test`,
              courseTitle,
              day,
              submitted: !!sub,
              percent: scoreOf(sub),
              submittedAt: toDate(sub?.submittedAt),
              href: `/crt/${programSlug}/courses/${createSlug(courseTitle)}/dayassignment/${a.id}`,
            };
          })
        );
      })
    )
  ).flat();

  let examItems = [];
  try {
    const testsSnap = await getDocs(collection(db, "crt", crtId, "tests"));
    examItems = await Promise.all(
      testsSnap.docs.map(async (t) => {
        const x = t.data() || {};
        let sub = null;
        try {
          const subSnap = await getDocs(
            query(collection(db, "crt", crtId, "tests", t.id, "submissions"), where("userId", "==", uid))
          );
          sub = subSnap.empty ? null : subSnap.docs[0].data();
        } catch (_) {
          sub = null;
        }
        return {
          key: `exam:${t.id}`,
          type: "exam",
          title: x.name || x.title || "CRT Full Length Test",
          courseTitle: "",
          day: null,
          submitted: !!sub,
          percent: scoreOf(sub),
          submittedAt: toDate(sub?.submittedAt),
          href: `/crt/${programSlug}/exams/${t.id}`,
        };
      })
    );
  } catch (_) {
    examItems = [];
  }

  const items = [...dayItems, ...examItems].sort((a, b) => {
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    const at = a.submittedAt?.getTime() || 0;
    const bt = b.submittedAt?.getTime() || 0;
    if (at !== bt) return bt - at;
    return (a.courseTitle || "").localeCompare(b.courseTitle || "") || (a.day || 0) - (b.day || 0);
  });
  const courses = courseStats
    .map((c) => {
      const done = dayItems.filter((i) => i.courseId === c.courseId && i.submitted);
      return {
        ...c,
        totalAssignments: dayItems.filter((i) => i.courseId === c.courseId).length,
        submittedAssignments: done.length,
        averageScore: average(done.map((i) => i.percent)),
      };
    })
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  return { items, summary: buildSummary(items), courses };
}

function buildSummary(items) {
  const summary = { total: items.length, submitted: 0, pending: 0, overallAverage: null, byType: {} };
  for (const type of Object.keys(SCORE_TYPE_LABELS)) {
    const ofType = items.filter((i) => i.type === type);
    const done = ofType.filter((i) => i.submitted);
    summary.byType[type] = {
      total: ofType.length,
      submitted: done.length,
      average: average(done.map((i) => i.percent)),
      awaitingReview: done.filter((i) => i.percent == null).length,
    };
  }
  summary.submitted = items.filter((i) => i.submitted).length;
  summary.pending = summary.total - summary.submitted;
  summary.overallAverage = average(items.filter((i) => i.submitted).map((i) => i.percent));
  return summary;
}

function chapterView(ch, idx, unlockedAt) {
  const day = typeof ch.order === "number" ? ch.order : idx + 1;
  return {
    id: ch.id,
    day,
    title: ch.title || `Day ${day}`,
    topics: ch.topics || "",
    pdfUrl: ch.pdfDocument || "",
    pptUrl: ch.pptUrl || "",
    liveClassLink: ch.liveClassLink || "",
    recordedClassLink: ch.recordedClassLink || "",
    referenceUrl: ch.referenceDocument || ch.classDocs || "",
    unlockedAt,
  };
}

/**
 * Recent / current / upcoming class of every course in one enrolled programme, from the day unlocks
 * the trainer sets per batch (`crt/{crt}/batches/{batch}/courses/{course}/chapterUnlocks`).
 * - current: a day unlocked today
 * - recent: the latest unlocked day before the current one
 * - upcoming: the next locked day (only when nothing was unlocked today)
 * Each class carries its day assignments with the student's submission state.
 */
export async function fetchMyCrtClasses(db, authUser, enrollment) {
  const uid = authUser?.uid;
  if (!db || !uid || !enrollment?.crtId) return [];
  const { crtId, slug } = enrollment;
  const batchIds = (enrollment.batches || []).map((b) => b.batchId);
  const today = localDateStr();

  const coursesSnap = await getDocs(collection(db, "crt", crtId, "courses"));
  const courses = await Promise.all(
    coursesSnap.docs.map(async (courseDoc) => {
      const course = courseDoc.data() || {};
      const courseTitle = course.title || course.name || "Course";
      let chapters = [];
      try {
        const chSnap = await getDocs(
          query(collection(db, "crt", crtId, "courses", courseDoc.id, "chapters"), orderBy("order", "asc"))
        );
        chapters = chSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (_) {
        chapters = [];
      }

      const unlockedAt = new Map();
      await Promise.all(
        batchIds.map(async (batchId) => {
          try {
            const snap = await getDocs(
              collection(db, "crt", crtId, "batches", batchId, "courses", courseDoc.id, "chapterUnlocks")
            );
            snap.docs.forEach((d) => {
              if (d.data()?.unlocked !== true) return;
              const at = toDate(d.data()?.updatedAt);
              const prev = unlockedAt.get(d.id);
              if (!unlockedAt.has(d.id) || (at && (!prev || at > prev))) unlockedAt.set(d.id, at);
            });
          } catch (_) {
            /* no unlocks for this batch */
          }
        })
      );

      const all = chapters.map((ch, idx) => chapterView(ch, idx, unlockedAt.get(ch.id) || null));
      const unlocked = all.filter((c) => unlockedAt.has(c.id));
      const byLatest = [...unlocked].sort(
        (a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0) || b.day - a.day
      );
      const current = byLatest.find((c) => c.unlockedAt && localDateStr(c.unlockedAt) === today) || null;
      const recent = byLatest.find((c) => c !== current) || null;
      const highestDay = unlocked.reduce((m, c) => Math.max(m, c.day), 0);
      const upcoming = current ? null : all.find((c) => !unlockedAt.has(c.id) && c.day > highestDay) || null;

      let tests = [];
      try {
        const aSnap = await getDocs(collection(mcqDb, "copiedcourses", courseDoc.id, "assignments"));
        tests = await Promise.all(
          aSnap.docs.map(async (a) => {
            const x = a.data() || {};
            let submitted = false;
            try {
              const s = await getDocs(
                query(
                  collection(mcqDb, "copiedcourses", courseDoc.id, "assignments", a.id, "submissions"),
                  where("studentId", "==", uid)
                )
              );
              submitted = !s.empty;
            } catch (_) {
              submitted = false;
            }
            return {
              id: a.id,
              day: Number(x.day) || 1,
              type: x.type === "coding" ? "coding" : "mcq",
              title: x.title || "Progress test",
              submitted,
            };
          })
        );
      } catch (_) {
        tests = [];
      }
      const testsFor = (c) => (c ? tests.filter((t) => t.day === c.day) : []);

      const courseSlug = createSlug(courseTitle);
      return {
        courseId: courseDoc.id,
        courseTitle,
        courseHref: `/crt/${slug}/courses/${courseSlug}`,
        assignmentBase: `/crt/${slug}/courses/${courseSlug}/dayassignment`,
        recent: recent && { ...recent, tests: testsFor(recent) },
        current: current && { ...current, tests: testsFor(current) },
        upcoming: upcoming && { ...upcoming, tests: [] },
      };
    })
  );
  return courses.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
}
