"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import CheckAuth from "../../lib/CheckAuth";
import { db, auth, isFirebaseConfigured } from "../../lib/firebase";
import { createSlug } from "../../lib/urlUtils";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { resolveCrtAndCourse } from "../../lib/crtCourseResolve";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChartBarIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  LockOpenIcon,
  LockClosedIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  LinkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

const CARD_STYLES = [
  { color: "from-emerald-500 to-teal-600", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  { color: "from-violet-500 to-purple-600", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
  { color: "from-amber-500 to-orange-600", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  { color: "from-sky-500 to-blue-600", iconBg: "bg-sky-100", iconColor: "text-sky-600" },
  { color: "from-rose-500 to-pink-600", iconBg: "bg-rose-100", iconColor: "text-rose-600" },
  { color: "from-slate-500 to-slate-600", iconBg: "bg-slate-100", iconColor: "text-slate-600" },
];

/**
 * Batches with trainerId === trainerUid; one card per visible course for that batch.
 * - Skips batch when `showClass === false` (admin can hide until ready).
 * - If batch has `assignedSubjectIds` / `assignedCourseIds` / `courseIds` / `visibleCourseIds`
 *   (non-empty array), only those courses are listed.
 */
async function fetchAssignmentsForTrainer(db, trainerUid) {
  const assignments = [];
  const programsSnap = await getDocs(collection(db, "crt"));
  let styleIdx = 0;
  for (const progDoc of programsSnap.docs) {
    const programId = progDoc.id;
    const programData = progDoc.data();
    const programName = programData.name || programId;
    const batchesSnap = await getDocs(collection(db, "crt", programId, "batches"));
    for (const batchDoc of batchesSnap.docs) {
      const batch = batchDoc.data();
      if (batch.trainerId !== trainerUid) continue;
      /** Admin-controlled: omit batch from trainer panel when explicitly false */
      if (batch.showClass === false) continue;
      const batchId = batchDoc.id;
      const courseIdAllowList = (() => {
        const raw =
          batch.assignedSubjectIds ??
          batch.assignedCourseIds ??
          batch.visibleCourseIds ??
          batch.courseIds;
        if (!Array.isArray(raw) || raw.length === 0) return null;
        return new Set(raw.map((id) => String(id)));
      })();
      let studentsCount = 0;
      try {
        const stSnap = await getDocs(
          collection(db, "crt", programId, "batches", batchId, "students")
        );
        studentsCount = stSnap.size;
      } catch (_) {
        /* optional subcollection */
      }
      const coursesSnap = await getDocs(collection(db, "crt", programId, "courses"));
      for (const courseDoc of coursesSnap.docs) {
        const courseId = courseDoc.id;
        if (courseIdAllowList && !courseIdAllowList.has(String(courseId))) continue;
        const course = courseDoc.data();
        const title = course.title || course.name || "Untitled course";
        let chapterCount = 0;
        try {
          const chSnap = await getDocs(
            collection(db, "crt", programId, "courses", courseId, "chapters")
          );
          chapterCount = chSnap.size;
        } catch (_) {}
        const style = CARD_STYLES[styleIdx % CARD_STYLES.length];
        styleIdx += 1;
        const rawStatus = (batch.status || "active").toLowerCase();
        const status = rawStatus === "completed" ? "completed" : "active";
        assignments.push({
          id: `${programId}__${batchId}__${courseId}`,
          programId,
          programName,
          programSlug: createSlug(programName) || programId,
          batchId,
          batchName: batch.name || batchId,
          courseId,
          courseName: title,
          courseSlug: createSlug(title) || courseId,
          schedule: batch.schedule || batch.classSchedule || "—",
          time: batch.time || batch.classTime || "—",
          startDate: batch.startDate || batch.start || "",
          endDate: batch.endDate || batch.end || "",
          studentsCount,
          totalSessions:
            typeof course.totalSessions === "number" ? course.totalSessions : chapterCount,
          completedSessions:
            typeof batch.completedSessions === "number" ? batch.completedSessions : 0,
          status,
          ...style,
        });
      }
    }
  }
  return assignments.sort((a, b) =>
    `${a.programName} ${a.batchName} ${a.courseName}`.localeCompare(
      `${b.programName} ${b.batchName} ${b.courseName}`
    )
  );
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Accept pasted URLs; add https if missing; validate */
function normalizeSharedUrl(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    return new URL(withProto).href;
  } catch {
    return null;
  }
}

function formatSharedLinkDate(value) {
  if (value == null) return "—";
  if (typeof value?.toDate === "function") {
    try {
      return formatDate(value.toDate().toISOString().slice(0, 10));
    } catch {
      return "—";
    }
  }
  return formatDate(value);
}

function progressPercent(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

/** Combined sessions progress across course rows in one batch. */
function programAggregateProgress(classes) {
  let completed = 0;
  let total = 0;
  for (const c of classes) {
    completed += Number(c.completedSessions) || 0;
    total += Number(c.totalSessions) || 0;
  }
  const pct = progressPercent(completed, total);
  return { pct, completed, total };
}

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Stable id for top-level `attendance` docs (trainer, per batch/course/chapter/day) */
function trainerAttendanceDocId(programId, batchId, courseId, chapterId, dateStr) {
  const s = (x) => String(x ?? "").replace(/\//g, "-");
  return `TR_${s(programId)}_${s(batchId)}_${s(courseId)}_${s(chapterId)}_${dateStr}`;
}

/** Firestore batch limit is 500 ops; stay under for safety */
const CRT_STUDENT_ATTENDANCE_BATCH_SIZE = 450;

/**
 * Mirror day attendance into each CRT student profile using ONE attendance doc:
 * `users/crtStudent/students/{uid}/attendance/courseWise`
 * with `courses[courseId].days[chapterId][YYYY-MM-DD] === true|false`.
 */
async function mirrorTrainerAttendanceToCrtStudentProfiles(db, cls, ch, dateStr, students, attendanceByDay, dayKey) {
  if (!db || !cls?.courseId || !ch?.id || !students?.length) return;
  const rows = [];
  for (const s of students) {
    const uid = String(s.studentId || s.id || "").trim();
    if (!uid) continue;
    const present = attendanceByDay[dayKey]?.[s.id] === true;
    rows.push({ uid, present });
  }
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += CRT_STUDENT_ATTENDANCE_BATCH_SIZE) {
    const chunk = rows.slice(i, i + CRT_STUDENT_ATTENDANCE_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const { uid, present } of chunk) {
      const ref = doc(db, "users", "crtStudent", "students", uid, "attendance", "courseWise");
      batch.set(
        ref,
        {
          courses: {
            [cls.courseId]: {
              courseId: cls.courseId,
              courseName: cls.courseName || "",
              programId: cls.programId,
              batchId: cls.batchId,
              days: {
                [ch.id]: {
                  [dateStr]: present,
                },
              },
            },
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
}

const TRAINER_ROLES = ["crtTrainer", "trainer", "admin", "superadmin"];

export default function CRTTrainerPage() {
  const [filter, setFilter] = useState("all");
  const [activeModal, setActiveModal] = useState(null); // 'attendance' | 'unlock' | 'notes'
  const [selectedClass, setSelectedClass] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState(null);
  const [authUid, setAuthUid] = useState(null);
  /** Shown under page title — from Firebase Auth (displayName or email) */
  const [trainerDisplayName, setTrainerDisplayName] = useState(null);
  const [viewerRole, setViewerRole] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  /** `programId__batchId` → students in batch (shared across courses in Mark Attendance) */
  const [studentsByBatch, setStudentsByBatch] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  /** Notes modal: reference materials loaded per course when accordion expands */
  const [referenceNotesByCourseId, setReferenceNotesByCourseId] = useState({});
  const [loadingRefNotesCourseId, setLoadingRefNotesCourseId] = useState(null);
  /** `courseId::chapterId::YYYY-MM-DD` → { [studentRowId]: true | false } */
  const [attendanceByDay, setAttendanceByDay] = useState({});
  /** Firestore-backed unlock list for the open "Unlock class" modal (chapter doc ids). */
  const [unlockSnapshotIds, setUnlockSnapshotIds] = useState([]);
  const [unlockMeta, setUnlockMeta] = useState(null); // { crtId, courseId, chapters }
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState(null);
  const [dayAttendanceSavingKey, setDayAttendanceSavingKey] = useState(null);
  const [attendanceDaySavedKey, setAttendanceDaySavedKey] = useState(null);
  const [unlockSaving, setUnlockSaving] = useState(false);
  const [notesSharing, setNotesSharing] = useState(false);
  // Share reference notes: link input and shared links per class
  /** Per-course general link form in notes modal (courseId → url/title) */
  const [generalLinkFormByCourse, setGeneralLinkFormByCourse] = useState({});
  /** Firestore trainerSharedLinks per courseId while notes modal open */
  const [trainerSharedLinksByCourse, setTrainerSharedLinksByCourse] = useState({});
  const [trainerSharedLinksLoading, setTrainerSharedLinksLoading] = useState(false);
  /** dayReferenceLinks snapshot: courseId → { chapterId → doc data } */
  const [dayLinksByCourse, setDayLinksByCourse] = useState({});
  const [linkShareSuccessCourseId, setLinkShareSuccessCourseId] = useState(null);
  /** Expanded course rows in notes modal; click to show day-wise links */
  const [notesExpandedCourseIds, setNotesExpandedCourseIds] = useState(() => new Set());
  const [chaptersByCourseForNotes, setChaptersByCourseForNotes] = useState({});
  const [chaptersLoadingCourseId, setChaptersLoadingCourseId] = useState(null);
  const [dayLinkInputDraft, setDayLinkInputDraft] = useState({});
  const [dayLinkSavingKey, setDayLinkSavingKey] = useState(null);
  /** Course tools modal (single course): chapters + day links */
  const [courseToolsChapters, setCourseToolsChapters] = useState([]);
  const [courseToolsChaptersLoading, setCourseToolsChaptersLoading] = useState(false);
  /** chapterId → doc data (dayReferenceLinks for the selected course) */
  const [courseToolsDayLinks, setCourseToolsDayLinks] = useState({});
  /** Show one selected day at a time in CourseTools modal */
  const [courseToolsSelectedChapterId, setCourseToolsSelectedChapterId] = useState(null);
  // When user clicks Share on a reference material, show text field + upload
  /** `${courseId}__${noteId}` when expanding Share under reference materials */
  const [expandedShareNoteKey, setExpandedShareNoteKey] = useState(null);
  const [shareLinkInput, setShareLinkInput] = useState("");
  /** `${programId}__${courseId}` → trainer full-course preview enabled (Firestore trainerPreview/default). */
  const [trainerPreviewMap, setTrainerPreviewMap] = useState({});
  const [previewSavingKey, setPreviewSavingKey] = useState(null);
  /** `${programId}__${batchId}` → expanded; click row (e.g. MCA - 1) to show courses for that batch */
  const [expandedBatchGroups, setExpandedBatchGroups] = useState({});
  /** Mark Attendance: expanded courses + chapters per course */
  const [attendanceExpandedCourseIds, setAttendanceExpandedCourseIds] = useState(() => new Set());
  const [chaptersByCourseForAttendance, setChaptersByCourseForAttendance] = useState({});
  const [chaptersAttendanceLoadingCourseId, setChaptersAttendanceLoadingCourseId] = useState(null);

  const loadAssignments = useCallback(async () => {
    if (!db || !authUid) {
      setAssignments([]);
      setTrainerPreviewMap({});
      setLoadingAssignments(false);
      return;
    }
    setLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      const list = await fetchAssignmentsForTrainer(db, authUid);
      setAssignments(list);
      const seen = new Set();
      const pairs = [];
      for (const a of list) {
        const k = `${a.programId}__${a.courseId}`;
        if (seen.has(k)) continue;
        seen.add(k);
        pairs.push({ programId: a.programId, courseId: a.courseId });
      }
      const nextPreview = {};
      await Promise.all(
        pairs.map(async ({ programId, courseId }) => {
          const k = `${programId}__${courseId}`;
          try {
            const snap = await getDoc(
              doc(db, "crt", programId, "courses", courseId, "trainerPreview", "default")
            );
            nextPreview[k] = snap.exists() && snap.data()?.enabled === true;
          } catch {
            nextPreview[k] = false;
          }
        })
      );
      setTrainerPreviewMap(nextPreview);
    } catch (e) {
      console.error(e);
      setAssignmentsError(e?.message || "Failed to load assignments.");
      setAssignments([]);
      setTrainerPreviewMap({});
    } finally {
      setLoadingAssignments(false);
    }
  }, [authUid]);

  const handleTrainerPreviewToggle = async (cls, enabled) => {
    if (!db) return;
    const key = `${cls.programId}__${cls.courseId}`;
    setPreviewSavingKey(key);
    try {
      const ref = doc(db, "crt", cls.programId, "courses", cls.courseId, "trainerPreview", "default");
      await setDoc(ref, { enabled, updatedAt: serverTimestamp() }, { merge: true });
      setTrainerPreviewMap((prev) => ({ ...prev, [key]: enabled }));
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not update trainer preview setting.");
    } finally {
      setPreviewSavingKey(null);
    }
  };

  useEffect(() => {
    if (!auth || !db) {
      setAuthUid(null);
      setTrainerDisplayName(null);
      setViewerRole(null);
      setAccessDenied(false);
      setLoadingAssignments(false);
      return;
    }
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setAuthUid(null);
        setTrainerDisplayName(null);
        setViewerRole(null);
        setAccessDenied(false);
        setAuthReady(true);
        return;
      }
      setAuthUid(u.uid);
      const label =
        (typeof u.displayName === "string" && u.displayName.trim()) ||
        (typeof u.email === "string" && u.email.trim()) ||
        null;
      setTrainerDisplayName(label);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const role = snap.exists() ? snap.data()?.role : null;
        setViewerRole(role || null);
        setAccessDenied(!TRAINER_ROLES.includes(role));
      } catch {
        setViewerRole(null);
        setAccessDenied(true);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!accessDenied && authUid && db && isFirebaseConfigured) {
      loadAssignments();
    } else {
      setLoadingAssignments(false);
    }
  }, [authUid, accessDenied, loadAssignments]);

  useEffect(() => {
    if (!["attendance", "courseTools"].includes(activeModal) || !selectedClass?.batchId || !db) return;
    const bk = `${selectedClass.programId}__${selectedClass.batchId}`;
    if (Object.prototype.hasOwnProperty.call(studentsByBatch, bk)) return;
    let cancelled = false;
    (async () => {
      setLoadingStudents(true);
      try {
        const snap = await getDocs(
          collection(db, "crt", selectedClass.programId, "batches", selectedClass.batchId, "students")
        );
        if (cancelled) return;
        const list = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: x.name || x.studentName || x.displayName || "—",
            email: x.email || "",
            rollNo: x.rollNo || x.regNo || x.regdNo || x.registrationNo || "",
            studentId: x.studentId || x.uid || "",
          };
        });
        setStudentsByBatch((prev) => ({ ...prev, [bk]: list }));
      } catch (e) {
        console.error(e);
        setStudentsByBatch((prev) => ({ ...prev, [bk]: [] }));
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeModal,
    selectedClass?.programId,
    selectedClass?.batchId,
    studentsByBatch,
  ]);

  const openModal = (modal, cls) => {
    setSelectedClass(cls);
    setActiveModal(modal);
    if (modal === "notes") {
      setGeneralLinkFormByCourse({});
      setLinkShareSuccessCourseId(null);
      setExpandedShareNoteKey(null);
      setShareLinkInput("");
      setNotesExpandedCourseIds(new Set());
      setChaptersByCourseForNotes({});
      setReferenceNotesByCourseId({});
      setDayLinkInputDraft({});
    }
    if (modal === "attendance") {
      setAttendanceExpandedCourseIds(new Set());
      setChaptersByCourseForAttendance({});
      setAttendanceByDay({});
      setAttendanceDaySavedKey(null);
    }
    if (modal === "courseTools") {
      setAttendanceByDay({});
      setAttendanceDaySavedKey(null);
      setDayLinkInputDraft({});
      setCourseToolsChapters([]);
      setCourseToolsDayLinks({});
      setCourseToolsSelectedChapterId(null);
    }
  };
  const closeModal = () => {
    setActiveModal(null);
    setSelectedClass(null);
    setNotesExpandedCourseIds(new Set());
    setChaptersByCourseForNotes({});
    setReferenceNotesByCourseId({});
    setDayLinkInputDraft({});
    setExpandedShareNoteKey(null);
    setShareLinkInput("");
    setAttendanceExpandedCourseIds(new Set());
    setChaptersByCourseForAttendance({});
    setAttendanceByDay({});
    setCourseToolsChapters([]);
    setCourseToolsDayLinks({});
    setCourseToolsSelectedChapterId(null);
  };

  const getBatchStudents = useCallback((cls) => {
    if (!cls?.programId || !cls?.batchId) return [];
    const bk = `${cls.programId}__${cls.batchId}`;
    return studentsByBatch[bk] || [];
  }, [studentsByBatch]);

  const attendanceDayKey = useCallback(
    (cls, ch, dateStr = getTodayStr()) => `${cls.courseId}::${ch.id}::${dateStr}`,
    []
  );

  const setStudentDayAttendance = (dayKey, studentRowId, present) => {
    setAttendanceByDay((prev) => ({
      ...prev,
      [dayKey]: { ...(prev[dayKey] || {}), [studentRowId]: present },
    }));
  };

  const loadTrainerAttendanceForChapters = useCallback(async (cls, chapters, students) => {
    if (!db || !students.length) return;
    const dateStr = getTodayStr();
    await Promise.all(
      chapters.map(async (ch) => {
        const dayKey = attendanceDayKey(cls, ch, dateStr);
        try {
          const ref = doc(
            db,
            "attendance",
            trainerAttendanceDocId(
              cls.programId,
              cls.batchId,
              cls.courseId,
              ch.id,
              dateStr
            )
          );
          const snap = await getDoc(ref);
          const presentArr = snap.exists() ? snap.data()?.present : [];
          const presentSet = new Set(Array.isArray(presentArr) ? presentArr : []);
          const row = {};
          for (const s of students) {
            const pid = s.studentId || s.id;
            row[s.id] = presentSet.has(pid);
          }
          setAttendanceByDay((prev) => ({ ...prev, [dayKey]: row }));
        } catch (e) {
          console.warn("attendance load", dayKey, e);
        }
      })
    );
  }, [attendanceDayKey]);

  const toggleAttendanceCourseExpand = async (cls) => {
    const id = cls.courseId;
    const willExpand = !attendanceExpandedCourseIds.has(id);
    setAttendanceExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!willExpand) return;
    const students = getBatchStudents(cls);
    if (!chaptersByCourseForAttendance[id]) {
      setChaptersAttendanceLoadingCourseId(id);
      try {
        const chRef = collection(db, "crt", cls.programId, "courses", cls.courseId, "chapters");
        const chSnap = await getDocs(query(chRef, orderBy("order", "asc")));
        const list = chSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setChaptersByCourseForAttendance((p) => ({ ...p, [id]: list }));
        await loadTrainerAttendanceForChapters(cls, list, students);
      } catch (e) {
        console.error(e);
        setChaptersByCourseForAttendance((p) => ({ ...p, [id]: [] }));
      } finally {
        setChaptersAttendanceLoadingCourseId(null);
      }
    } else {
      const chapters = chaptersByCourseForAttendance[id] || [];
      await loadTrainerAttendanceForChapters(cls, chapters, students);
    }
  };

  const handleSaveDayAttendance = async (cls, ch) => {
    if (!db || !cls?.batchId) return;
    const dateStr = getTodayStr();
    const dayKey = attendanceDayKey(cls, ch, dateStr);
    const students = getBatchStudents(cls);
    const presentList = students
      .filter((s) => attendanceByDay[dayKey]?.[s.id] === true)
      .map((s) => s.studentId || s.id);
    setDayAttendanceSavingKey(dayKey);
    setAttendanceDaySavedKey(null);
    try {
      await setDoc(
        doc(
          db,
          "attendance",
          trainerAttendanceDocId(cls.programId, cls.batchId, cls.courseId, ch.id, dateStr)
        ),
        {
          type: "trainer",
          courseId: cls.courseId,
          chapterId: ch.id,
          crtProgramId: cls.programId,
          batchId: cls.batchId,
          date: dateStr,
          present: presentList,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      try {
        await mirrorTrainerAttendanceToCrtStudentProfiles(
          db,
          cls,
          ch,
          dateStr,
          students,
          attendanceByDay,
          dayKey
        );
      } catch (mirrorErr) {
        console.warn("[crtTrainar] CRT student profile attendance mirror failed:", mirrorErr);
      }
      setAttendanceDaySavedKey(dayKey);
      setTimeout(() => setAttendanceDaySavedKey(null), 2500);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save attendance.");
    } finally {
      setDayAttendanceSavingKey(null);
    }
  };

  useEffect(() => {
    if (activeModal !== "unlock" || !selectedClass || !db) {
      setUnlockMeta(null);
      setUnlockSnapshotIds([]);
      setUnlockError(null);
      return;
    }
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      setUnlockLoading(true);
      setUnlockError(null);
      try {
        const { crtId, courseId } = await resolveCrtAndCourse(
          db,
          selectedClass.programId,
          selectedClass.courseId,
          selectedClass.programName
        );
        if (cancelled) return;
        if (!crtId || !courseId) {
          setUnlockMeta(null);
          setUnlockError(
            "No matching CRT programme/course in Firestore. Ensure programme slug and course id match your CRT admin data."
          );
          setUnlockLoading(false);
          return;
        }
        const chRef = collection(db, "crt", crtId, "courses", courseId, "chapters");
        const chSnap = await getDocs(query(chRef, orderBy("order", "asc")));
        if (cancelled) return;
        const chapters = chSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const batchId = selectedClass.batchId;
        if (!batchId) {
          setUnlockMeta(null);
          setUnlockError(
            "This class has no batch. Unlocks are stored per batch — ask an admin to assign this course to a batch."
          );
          setUnlockLoading(false);
          return;
        }
        setUnlockMeta({ crtId, courseId, batchId, chapters });
        /** Per-batch only: students in other batches stay locked. */
        const unlockCol = collection(
          db,
          "crt",
          crtId,
          "batches",
          batchId,
          "courses",
          courseId,
          "chapterUnlocks"
        );
        unsub = onSnapshot(unlockCol, (snap) => {
          if (cancelled) return;
          setUnlockSnapshotIds(
            snap.docs.filter((d) => d.data()?.unlocked === true).map((d) => d.id)
          );
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) setUnlockError(e?.message || "Failed to load course chapters.");
      } finally {
        if (!cancelled) setUnlockLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [
    activeModal,
    selectedClass,
    selectedClass?.id,
    selectedClass?.programId,
    selectedClass?.courseId,
    selectedClass?.batchId,
  ]);

  const isChapterUnlockedForTrainer = (chapterId) => unlockSnapshotIds.includes(chapterId);

  const handleToggleChapterUnlock = async (chapterId) => {
    if (!unlockMeta || !db || !unlockMeta.batchId) return;
    const currently = unlockSnapshotIds.includes(chapterId);
    try {
      setUnlockSaving(true);
      const ref = doc(
        db,
        "crt",
        unlockMeta.crtId,
        "batches",
        unlockMeta.batchId,
        "courses",
        unlockMeta.courseId,
        "chapterUnlocks",
        chapterId
      );
      if (currently) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          unlocked: true,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to update day unlock. Check Firestore rules and connection.");
    } finally {
      setUnlockSaving(false);
    }
  };
  const getNoteSharedFromDummy = (courseId, note) => {
    if (note.shared) return true;
    const list = trainerSharedLinksByCourse[courseId] || [];
    return list.some((l) => l.referenceMaterialId === note.id);
  };

  const setGeneralLinkField = (courseId, field, value) => {
    setGeneralLinkFormByCourse((p) => ({
      ...p,
      [courseId]: { ...(p[courseId] || { url: "", title: "" }), [field]: value },
    }));
  };

  const toggleNotesCourseExpand = async (cls) => {
    const id = cls.courseId;
    const willExpand = !notesExpandedCourseIds.has(id);
    setNotesExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!willExpand) return;
    if (!chaptersByCourseForNotes[id]) {
      setChaptersLoadingCourseId(id);
      try {
        const chRef = collection(db, "crt", cls.programId, "courses", cls.courseId, "chapters");
        const chSnap = await getDocs(query(chRef, orderBy("order", "asc")));
        setChaptersByCourseForNotes((p) => ({
          ...p,
          [id]: chSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        }));
      } catch (e) {
        console.error(e);
        setChaptersByCourseForNotes((p) => ({ ...p, [id]: [] }));
      } finally {
        setChaptersLoadingCourseId(null);
      }
    }
    if (referenceNotesByCourseId[id] === undefined) {
      setLoadingRefNotesCourseId(id);
      try {
        const snap = await getDocs(
          collection(db, "crt", cls.programId, "courses", cls.courseId, "referenceMaterials")
        );
        setReferenceNotesByCourseId((p) => ({
          ...p,
          [id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        }));
      } catch {
        setReferenceNotesByCourseId((p) => ({ ...p, [id]: [] }));
      } finally {
        setLoadingRefNotesCourseId(null);
      }
    }
  };

  const saveDayReferenceLink = async (cls, chapter) => {
    if (!db || !cls?.batchId) return;
    const dk = `${cls.courseId}__${chapter.id}`;
    const existingUrl =
      dayLinksByCourse[cls.courseId]?.[chapter.id]?.url ??
      courseToolsDayLinks?.[chapter.id]?.url ??
      "";
    const raw = dayLinkInputDraft[dk] ?? existingUrl;
    const url = normalizeSharedUrl(raw);
    if (!url) {
      alert("Enter a valid https link for this day.");
      return;
    }
    setDayLinkSavingKey(dk);
    try {
      await setDoc(
        doc(
          db,
          "crt",
          cls.programId,
          "batches",
          cls.batchId,
          "courses",
          cls.courseId,
          "dayReferenceLinks",
          chapter.id
        ),
        {
          url,
          dayOrder: typeof chapter.order === "number" ? chapter.order : null,
          chapterTitle: chapter.title || null,
          courseId: cls.courseId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setDayLinkInputDraft((p) => {
        const next = { ...p };
        delete next[dk];
        return next;
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save day link.");
    } finally {
      setDayLinkSavingKey(null);
    }
  };

  const handleSaveUnlock = () => {
    closeModal();
  };
  const openShareForNote = (courseId, noteId) => {
    const key = `${courseId}__${noteId}`;
    setExpandedShareNoteKey((prev) => {
      const next = prev === key ? null : key;
      setShareLinkInput("");
      return next;
    });
  };

  const handleUploadShareNote = async (cls, note) => {
    if (!db || !cls?.batchId) {
      alert("This class has no batch. Cannot save link.");
      return;
    }
    const url = normalizeSharedUrl(shareLinkInput);
    if (!url) {
      alert("Enter a valid link (e.g. https://drive.google.com/...).");
      return;
    }
    setNotesSharing(true);
    try {
      await addDoc(
        collection(
          db,
          "crt",
          cls.programId,
          "batches",
          cls.batchId,
          "courses",
          cls.courseId,
          "trainerSharedLinks"
        ),
        {
          url,
          title: (note.title || "Reference").trim(),
          referenceMaterialId: note.id,
          courseId: cls.courseId,
          source: "referenceMaterial",
          sharedAt: getTodayStr(),
          createdAt: serverTimestamp(),
        }
      );
      setExpandedShareNoteKey(null);
      setShareLinkInput("");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save link. Check Firestore rules.");
    } finally {
      setNotesSharing(false);
    }
  };

  const handleShareGeneralLinkForCourse = async (e, cls) => {
    e?.preventDefault();
    if (!cls || !db || !cls.batchId) {
      alert("This class has no batch. Cannot save link.");
      return;
    }
    const form = generalLinkFormByCourse[cls.courseId] || { url: "", title: "" };
    const url = normalizeSharedUrl(form.url);
    if (!url) {
      alert("Enter a valid link (e.g. https://...).");
      return;
    }
    setNotesSharing(true);
    setLinkShareSuccessCourseId(null);
    try {
      await addDoc(
        collection(
          db,
          "crt",
          cls.programId,
          "batches",
          cls.batchId,
          "courses",
          cls.courseId,
          "trainerSharedLinks"
        ),
        {
          url,
          title: (form.title || "").trim() || "Reference link",
          courseId: cls.courseId,
          source: "manual",
          sharedAt: getTodayStr(),
          createdAt: serverTimestamp(),
        }
      );
      setGeneralLinkFormByCourse((p) => ({
        ...p,
        [cls.courseId]: { url: "", title: "" },
      }));
      setLinkShareSuccessCourseId(cls.courseId);
      setTimeout(() => setLinkShareSuccessCourseId(null), 3500);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save link. Check Firestore rules.");
    } finally {
      setNotesSharing(false);
    }
  };

  const filteredClasses = useMemo(
    () =>
      filter === "all"
        ? assignments
        : assignments.filter((c) => c.status === filter),
    [assignments, filter]
  );

  /** All courses (assignments) for the same programme + batch as the opened notes modal */
  const coursesInSelectedBatch = useMemo(() => {
    if (!selectedClass) return [];
    const seen = new Set();
    const rows = [];
    for (const a of assignments) {
      if (a.programId !== selectedClass.programId || a.batchId !== selectedClass.batchId) continue;
      if (seen.has(a.courseId)) continue;
      seen.add(a.courseId);
      rows.push(a);
    }
    return rows.sort((x, y) =>
      String(x.courseName || "").localeCompare(String(y.courseName || ""), undefined, {
        sensitivity: "base",
      })
    );
  }, [assignments, selectedClass]);

  /** CourseTools modal: load chapters for selected course */
  useEffect(() => {
    if (activeModal !== "courseTools" || !selectedClass?.programId || !selectedClass?.courseId || !db) {
      setCourseToolsChapters([]);
      setCourseToolsChaptersLoading(false);
      setCourseToolsSelectedChapterId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setCourseToolsChaptersLoading(true);
      try {
        const chRef = collection(db, "crt", selectedClass.programId, "courses", selectedClass.courseId, "chapters");
        const chSnap = await getDocs(query(chRef, orderBy("order", "asc")));
        if (cancelled) return;
        const list = chSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCourseToolsChapters(list);
        setCourseToolsSelectedChapterId((prev) => {
          if (prev && list.some((ch) => ch.id === prev)) return prev;
          return list[0]?.id || null;
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) setCourseToolsChapters([]);
      } finally {
        if (!cancelled) setCourseToolsChaptersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeModal, selectedClass?.programId, selectedClass?.courseId]);

  /** CourseTools modal: live dayReferenceLinks for selected course */
  useEffect(() => {
    if (
      activeModal !== "courseTools" ||
      !selectedClass?.programId ||
      !selectedClass?.batchId ||
      !selectedClass?.courseId ||
      !db
    ) {
      setCourseToolsDayLinks({});
      return;
    }
    const col = collection(
      db,
      "crt",
      selectedClass.programId,
      "batches",
      selectedClass.batchId,
      "courses",
      selectedClass.courseId,
      "dayReferenceLinks"
    );
    return onSnapshot(col, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setCourseToolsDayLinks(map);
    });
  }, [activeModal, selectedClass?.programId, selectedClass?.batchId, selectedClass?.courseId]);

  /** CourseTools modal: once students + chapters exist, hydrate attendance (today) */
  useEffect(() => {
    if (activeModal !== "courseTools" || !selectedClass?.programId || !selectedClass?.batchId || !db) return;
    const students = getBatchStudents(selectedClass);
    if (!students.length || !courseToolsChapters.length) return;
    loadTrainerAttendanceForChapters(selectedClass, courseToolsChapters, students);
  }, [
    activeModal,
    selectedClass,
    studentsByBatch,
    courseToolsChapters,
    getBatchStudents,
    loadTrainerAttendanceForChapters,
  ]);

  /** If chapters were expanded before students finished loading, hydrate attendance once students exist */
  useEffect(() => {
    if (activeModal !== "attendance" || !selectedClass?.programId || !selectedClass?.batchId || !db) return;
    const bk = `${selectedClass.programId}__${selectedClass.batchId}`;
    const students = studentsByBatch[bk] || [];
    if (!students.length) return;
    for (const courseId of attendanceExpandedCourseIds) {
      const cls = coursesInSelectedBatch.find((c) => c.courseId === courseId);
      const chapters = chaptersByCourseForAttendance[courseId];
      if (!cls || !chapters?.length) continue;
      loadTrainerAttendanceForChapters(cls, chapters, students);
    }
  }, [
    activeModal,
    selectedClass,
    studentsByBatch,
    attendanceExpandedCourseIds,
    chaptersByCourseForAttendance,
    coursesInSelectedBatch,
    loadTrainerAttendanceForChapters,
  ]);

  /** trainerSharedLinks per course in this batch (notes modal) */
  useEffect(() => {
    if (activeModal !== "notes" || !selectedClass?.batchId || !db) {
      setTrainerSharedLinksByCourse({});
      setTrainerSharedLinksLoading(false);
      return;
    }
    const courses = coursesInSelectedBatch;
    if (courses.length === 0) {
      setTrainerSharedLinksByCourse({});
      setTrainerSharedLinksLoading(false);
      return;
    }
    setTrainerSharedLinksLoading(true);
    const unsubs = courses.map((cls) => {
      const col = collection(
        db,
        "crt",
        cls.programId,
        "batches",
        cls.batchId,
        "courses",
        cls.courseId,
        "trainerSharedLinks"
      );
      return onSnapshot(
        col,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          items.sort((a, b) => {
            const ta =
              a.createdAt?.toMillis?.() ??
              (a.sharedAt ? new Date(a.sharedAt).getTime() : 0);
            const tb =
              b.createdAt?.toMillis?.() ??
              (b.sharedAt ? new Date(b.sharedAt).getTime() : 0);
            return tb - ta;
          });
          setTrainerSharedLinksByCourse((prev) => ({ ...prev, [cls.courseId]: items }));
          setTrainerSharedLinksLoading(false);
        },
        () => {
          setTrainerSharedLinksByCourse((prev) => ({ ...prev, [cls.courseId]: [] }));
          setTrainerSharedLinksLoading(false);
        }
      );
    });
    return () => unsubs.forEach((u) => u());
  }, [activeModal, selectedClass?.batchId, selectedClass?.programId, coursesInSelectedBatch]);

  /** Day-wise reference link docs per course */
  useEffect(() => {
    if (activeModal !== "notes" || !selectedClass?.batchId || !db) {
      setDayLinksByCourse({});
      return;
    }
    const courses = coursesInSelectedBatch;
    if (courses.length === 0) {
      setDayLinksByCourse({});
      return;
    }
    const unsubs = courses.map((cls) => {
      const col = collection(
        db,
        "crt",
        cls.programId,
        "batches",
        cls.batchId,
        "courses",
        cls.courseId,
        "dayReferenceLinks"
      );
      return onSnapshot(col, (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setDayLinksByCourse((prev) => ({ ...prev, [cls.courseId]: map }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [activeModal, selectedClass?.batchId, selectedClass?.programId, coursesInSelectedBatch]);

  /** Stable list of assignment ids so unlock listeners are not torn down when only progress counts change */
  const unlockWatchKey = useMemo(
    () => filteredClasses.map((c) => c.id).sort().join("|"),
    [filteredClasses]
  );

  /** Live: completed sessions = count of chapterUnlocks docs with unlocked:true (matches Unlock Class modal) */
  useEffect(() => {
    if (!db || !isFirebaseConfigured || !unlockWatchKey) return;
    if (!filteredClasses.length) return;
    const list = filteredClasses;
    const unsubs = [];
    for (const cls of list) {
      if (!cls.batchId || !cls.programId || !cls.courseId) continue;
      const assignmentId = cls.id;
      const unlockCol = collection(
        db,
        "crt",
        cls.programId,
        "batches",
        cls.batchId,
        "courses",
        cls.courseId,
        "chapterUnlocks"
      );
      const unsub = onSnapshot(
        unlockCol,
        (snap) => {
          const completed = snap.docs.filter((d) => d.data()?.unlocked === true).length;
          setAssignments((prev) =>
            prev.map((a) =>
              a.id === assignmentId ? { ...a, completedSessions: completed } : a
            )
          );
        },
        (err) => {
          console.warn("[crtTrainar] chapterUnlocks listener", assignmentId, err);
        }
      );
      unsubs.push(unsub);
    }
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-subscribe when visible assignment ids change (filter), not when progress counts update
  }, [unlockWatchKey, db, isFirebaseConfigured]);

  const batchGroups = useMemo(() => {
    const map = new Map();
    for (const cls of filteredClasses) {
      const key = `${cls.programId}__${cls.batchId}`;
      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          programId: cls.programId,
          programName: cls.programName,
          programSlug: cls.programSlug,
          batchId: cls.batchId,
          batchName: cls.batchName,
          /** e.g. "MCA - 1" (program + batch, not course title) */
          batchTitle: `${cls.programName} - ${cls.batchName}`,
          classes: [],
        });
      }
      map.get(key).classes.push(cls);
    }
    return Array.from(map.values()).sort((a, b) => {
      const byProg = a.programName.localeCompare(b.programName);
      if (byProg !== 0) return byProg;
      return String(a.batchName).localeCompare(String(b.batchName), undefined, {
        numeric: true,
      });
    });
  }, [filteredClasses]);

  const toggleBatchGroup = (groupKey) => {
    setExpandedBatchGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  /** Same batch may appear once per course; count students per batch only, not per course row */
  const totalStudentsUniqueByBatch = useMemo(() => {
    const byBatch = new Map();
    for (const c of assignments) {
      const key = `${c.programId}__${c.batchId}`;
      if (!byBatch.has(key)) {
        byBatch.set(key, Number(c.studentsCount) || 0);
      }
    }
    let sum = 0;
    byBatch.forEach((n) => {
      sum += n;
    });
    return sum;
  }, [assignments]);

  const stats = {
    total: assignments.length,
    active: assignments.filter((c) => c.status === "active").length,
    completed: assignments.filter((c) => c.status === "completed").length,
    totalStudents: totalStudentsUniqueByBatch,
  };

  if (!authReady) {
    return (
      <CheckAuth>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading...</p>
          </div>
        </div>
      </CheckAuth>
    );
  }

  if (accessDenied) {
    return (
      <CheckAuth>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access denied</h1>
            <p className="text-slate-600 mb-6">
              This page is for CRT trainers. Your role is{" "}
              <span className="font-semibold">{viewerRole || "unknown"}</span>.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </CheckAuth>
    );
  }

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 pt-16 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/crt"
                className="inline-flex items-center gap-2 text-slate-600 hover:text-[#00448a] font-medium text-sm transition-colors p-1.5 rounded-lg hover:bg-white/80"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to CRT
              </Link>
              <div className="hidden sm:block w-px h-6 bg-slate-200" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00448a] to-cyan-600 flex items-center justify-center shadow-lg shadow-[#00448a]/20">
                  <AcademicCapIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    CRT Trainer
                  </h1>
                  <p className="text-slate-600 text-sm mt-0.5">
                    {trainerDisplayName ||
                      "Classes from batches where you are assigned as trainer"}
                  </p>
                </div>
              </div>
            </div>
            {isFirebaseConfigured && (
              <button
                type="button"
                onClick={loadAssignments}
                disabled={loadingAssignments}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loadingAssignments ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {!isFirebaseConfigured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm mb-6">
              Firebase is not configured. Assignments cannot be loaded.
            </div>
          )}
          {assignmentsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm mb-6">
              {assignmentsError}
            </div>
          )}

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <BookOpenIcon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assigned Classes
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <ChartBarIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Active
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.active}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Completed
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.completed}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00448a]/10 flex items-center justify-center">
                  <UserGroupIcon className="w-5 h-5 text-[#00448a]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Students
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats.totalStudents}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm font-medium text-slate-600 mr-2">
              Filter:
            </span>
            {["all", "active", "completed"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                  filter === key
                    ? "bg-[#00448a] text-white shadow-md shadow-[#00448a]/25"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          {/* Batches (program - batch name) → expand for course cards */}
          <div className="space-y-6">
            {loadingAssignments ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <ArrowPathIcon className="w-10 h-10 text-[#00448a] mx-auto mb-3 animate-spin" />
                <p className="text-slate-500 font-medium">Loading assignments…</p>
              </div>
            ) : filteredClasses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm"
              >
                <BookOpenIcon className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium max-w-md mx-auto">
                  {filter === "all"
                    ? "No classes yet. Ask an admin to assign you to a CRT batch (CRT Admin → Trainer management), or check that the batch has show class enabled (not showClass: false) and lists this course if assignedCourseIds is set."
                    : "No assigned classes for this filter."}
                </p>
              </motion.div>
            ) : (
              batchGroups.map((group, gi) => {
                const isOpen = expandedBatchGroups[group.groupKey];
                const agg = programAggregateProgress(group.classes);
                return (
                  <motion.div
                    key={group.groupKey}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: gi * 0.05, duration: 0.25 }}
                    className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleBatchGroup(group.groupKey)}
                      aria-expanded={!!isOpen}
                      className="w-full text-left px-5 py-4 sm:px-6 sm:py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-50/90 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00448a]/12 to-cyan-600/10 flex items-center justify-center shrink-0 border border-slate-200/60">
                          <AcademicCapIcon className="w-6 h-6 text-[#00448a]" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                            {group.batchTitle}
                          </h2>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {group.programName} · {group.classes.length} course
                            {group.classes.length === 1 ? "" : "s"} ·{" "}
                            {isOpen ? "Click to collapse" : "Click to show all courses"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 lg:max-w-md lg:flex-1 lg:min-w-[240px]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500 font-medium">Progress</span>
                            <span className="text-slate-700 font-semibold tabular-nums">
                              {agg.total ? (
                                <>
                                  {agg.completed} / {agg.total} sessions ({agg.pct}%)
                                </>
                              ) : (
                                <>—</>
                              )}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#00448a] to-cyan-600 transition-all duration-500"
                              style={{ width: `${agg.pct}%` }}
                            />
                          </div>
                        </div>
                        <ChevronDownIcon
                          className={`w-6 h-6 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-5">
                        <div className="space-y-6">
                          {group.classes.map((cls, ci) => {
                const progress = progressPercent(
                  cls.completedSessions,
                  cls.totalSessions
                );
                const href = `/crt/${encodeURIComponent(cls.programSlug)}/courses/${encodeURIComponent(cls.courseId)}`;
                return (
                  <motion.div
                    key={cls.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: ci * 0.04, duration: 0.25 }}
                  >
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-lg hover:border-slate-300/80 transition-all duration-200">
                      <div className="flex flex-col lg:flex-row">
                        <div className="flex-1 p-6 sm:p-8">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div
                                className={`w-14 h-14 rounded-xl ${cls.iconBg} ${cls.iconColor} flex items-center justify-center shrink-0 shadow-sm`}
                              >
                                <BookOpenIcon className="w-7 h-7" />
                              </div>
                              <div>
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                                  {cls.courseName}
                                </h2>
                                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDaysIcon className="w-4 h-4" />
                                    {cls.schedule}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <ClockIcon className="w-4 h-4" />
                                    {cls.time}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                  cls.status === "active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {cls.status === "active"
                                  ? "Active"
                                  : "Completed"}
                              </span>
                              <Link
                                href={href}
                                className="inline-flex items-center gap-1 text-sm font-medium text-[#00448a] hover:underline"
                              >
                                View course
                                <ChevronRightIcon className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-5">
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="text-slate-500 font-medium">
                                Sessions progress
                              </span>
                              <span className="text-slate-700 font-semibold">
                                {cls.completedSessions} / {cls.totalSessions} (
                                {progress}%)
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${cls.color} transition-all duration-500`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-slate-100">
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <UserGroupIcon className="w-4 h-4 text-slate-400" />
                              <strong className="text-slate-800">
                                {cls.studentsCount}
                              </strong>{" "}
                              students
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatDate(cls.startDate)} –{" "}
                              {formatDate(cls.endDate)}
                            </span>
                          </div>

                          <div className="mt-4 p-3 rounded-xl bg-violet-50/90 border border-violet-200/70">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                id={`trainer-preview-${cls.id}`}
                                checked={trainerPreviewMap[`${cls.programId}__${cls.courseId}`] === true}
                                disabled={
                                  !isFirebaseConfigured ||
                                  previewSavingKey === `${cls.programId}__${cls.courseId}`
                                }
                                onChange={(e) => handleTrainerPreviewToggle(cls, e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
                              />
                              <label
                                htmlFor={`trainer-preview-${cls.id}`}
                                className="text-sm text-slate-700 cursor-pointer select-none min-w-0"
                              >
                                <span className="font-semibold text-slate-900">
                                  Unlock full course only for trainer
                                </span>
                              </label>
                            </div>
                          </div>

                          {/* Action buttons — Unlock Class first (batch-scoped day unlocks) */}
                          <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => openModal("unlock", cls)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00448a] text-white hover:bg-[#003a75] font-semibold text-sm transition-colors shadow-md shadow-[#00448a]/20"
                            >
                              <LockOpenIcon className="w-4 h-4" />
                              Unlock Class
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal("courseTools", cls)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-sm transition-colors border border-emerald-200/80"
                            >
                              <ClipboardDocumentCheckIcon className="w-4 h-4" />
                              Days: Attendance & Links
                            </button>
                          </div>
                        </div>
                        <div
                          className={`hidden lg:block w-1.5 min-h-[120px] bg-gradient-to-b ${cls.color} opacity-90`}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </motion.div>
                );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Modals */}
          <AnimatePresence>
            {activeModal && selectedClass && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
                  onClick={closeModal}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "tween", duration: 0.2 }}
                  className="fixed inset-4 sm:inset-8 md:inset-12 lg:max-w-3xl lg:mx-auto z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {activeModal === "attendance" && "Mark Attendance"}
                        {activeModal === "courseTools" && "Course Days: Attendance & Reference Links"}
                        {activeModal === "unlock" && "Unlock Class"}
                        {activeModal === "notes" && "Share Reference Notes"}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {activeModal === "attendance"
                          ? `${selectedClass.programName} · ${selectedClass.batchName}`
                          : activeModal === "courseTools"
                            ? `${selectedClass.courseName} · ${selectedClass.batchName}`
                          : `${selectedClass.courseName} · ${selectedClass.batchName}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      aria-label="Close"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* Mark Attendance — all courses in batch, day (chapter) wise + save per day */}
                    {activeModal === "attendance" && selectedClass && (
                      <div className="space-y-6">
                        <p className="text-sm text-slate-600">
                          Expand each <strong>course</strong>, then mark <strong>per day</strong> for{" "}
                          <strong>all students in this batch</strong>. Attendance date:{" "}
                          <strong>{getTodayStr()}</strong> (saved in Firestore under that date).
                        </p>
                        {!isFirebaseConfigured && (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Firebase is not configured. Add env keys to load and save attendance.
                          </p>
                        )}
                        {loadingStudents && getBatchStudents(selectedClass).length === 0 && (
                          <p className="text-sm text-slate-500 py-2 text-center">Loading students…</p>
                        )}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-slate-800">Courses in this batch</h4>
                          {coursesInSelectedBatch.length === 0 && (
                            <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
                              No courses listed for this batch.
                            </p>
                          )}
                          {coursesInSelectedBatch.map((cls) => {
                            const expanded = attendanceExpandedCourseIds.has(cls.courseId);
                            const chapters = chaptersByCourseForAttendance[cls.courseId] || [];
                            const batchStudents = getBatchStudents(cls);
                            const dateStr = getTodayStr();
                            return (
                              <div
                                key={cls.courseId}
                                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleAttendanceCourseExpand(cls)}
                                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/90 transition-colors"
                                >
                                  <span className="font-semibold text-slate-900">{cls.courseName}</span>
                                  <ChevronDownIcon
                                    className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                                      expanded ? "rotate-180" : ""
                                    }`}
                                    aria-hidden
                                  />
                                </button>
                                {expanded && (
                                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4 bg-slate-50/60">
                                    {chaptersAttendanceLoadingCourseId === cls.courseId ? (
                                      <p className="text-sm text-slate-500 py-2">Loading days…</p>
                                    ) : chapters.length === 0 ? (
                                      <p className="text-sm text-slate-500 py-2 border border-dashed border-slate-200 rounded-lg px-3">
                                        No chapters (days) found. Add days under CRT admin for this course.
                                      </p>
                                    ) : (
                                      <ul className="space-y-4">
                                        {chapters.map((ch, idx) => {
                                          const dayNum = typeof ch.order === "number" ? ch.order : idx + 1;
                                          const dayKey = attendanceDayKey(cls, ch, dateStr);
                                          const saving = dayAttendanceSavingKey === dayKey;
                                          const justSaved = attendanceDaySavedKey === dayKey;
                                          return (
                                            <li
                                              key={ch.id}
                                              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-3"
                                            >
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-slate-800">
                                                  Day {dayNum}: {ch.title || `Day ${dayNum}`}
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveDayAttendance(cls, ch)}
                                                  disabled={saving || !isFirebaseConfigured || batchStudents.length === 0}
                                                  className="px-4 py-2 rounded-lg bg-[#00448a] text-white text-sm font-semibold hover:bg-[#003a75] disabled:opacity-60 shrink-0"
                                                >
                                                  {saving ? "Saving…" : "Save this day"}
                                                </button>
                                              </div>
                                              {justSaved && (
                                                <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                                                  <CheckCircleIcon className="w-4 h-4 shrink-0" />
                                                  Saved for this day.
                                                </div>
                                              )}
                                              {batchStudents.length === 0 ? (
                                                <p className="text-sm text-slate-500">
                                                  {loadingStudents
                                                    ? "Loading students…"
                                                    : "No students in this batch yet."}
                                                </p>
                                              ) : (
                                                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                                  {batchStudents.map((student) => {
                                                    const present = attendanceByDay[dayKey]?.[student.id];
                                                    return (
                                                      <li
                                                        key={student.id}
                                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2.5 bg-white hover:bg-slate-50/50"
                                                      >
                                                        <div className="min-w-0">
                                                          <p className="font-medium text-slate-900 text-sm">
                                                            {student.name}
                                                          </p>
                                                          <p className="text-xs text-slate-500 truncate">
                                                            {student.rollNo}
                                                            {student.rollNo && student.email ? " · " : ""}
                                                            {student.email}
                                                          </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setStudentDayAttendance(dayKey, student.id, true)
                                                            }
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                              present === true
                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                                                            }`}
                                                          >
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                            Present
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setStudentDayAttendance(dayKey, student.id, false)
                                                            }
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                              present === false
                                                                ? "bg-red-100 text-red-800 border border-red-200"
                                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                                                            }`}
                                                          >
                                                            <XCircleIcon className="w-4 h-4" />
                                                            Absent
                                                          </button>
                                                        </div>
                                                      </li>
                                                    );
                                                  })}
                                                </ul>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Course tools — single course: day-wise attendance + day-wise reference link */}
                    {activeModal === "courseTools" && selectedClass && (
                      <div className="space-y-5">
                        <p className="text-sm text-slate-600">
                          Mark <strong>day-wise attendance</strong> and add a <strong>day-wise reference link</strong>{" "}
                          for this course. Date: <strong>{getTodayStr()}</strong>.
                        </p>

                        {!isFirebaseConfigured && (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Firebase is not configured. Add env keys to load and save attendance/links.
                          </p>
                        )}

                        {courseToolsChaptersLoading ? (
                          <p className="text-sm text-slate-500 py-4 text-center">Loading days…</p>
                        ) : courseToolsChapters.length === 0 ? (
                          <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                            No chapters (days) found for this course.
                          </p>
                        ) : (
                          (() => {
                            const selectedIdx = Math.max(
                              0,
                              courseToolsChapters.findIndex((ch) => ch.id === courseToolsSelectedChapterId)
                            );
                            const activeChapter = courseToolsChapters[selectedIdx] || courseToolsChapters[0];
                            if (!activeChapter) return null;
                            const dayNum =
                              typeof activeChapter.order === "number" ? activeChapter.order : selectedIdx + 1;
                            const dateStr = getTodayStr();
                            const dayKey = attendanceDayKey(selectedClass, activeChapter, dateStr);
                            const savingAttendance = dayAttendanceSavingKey === dayKey;
                            const justSavedAttendance = attendanceDaySavedKey === dayKey;

                            const dk = `${selectedClass.courseId}__${activeChapter.id}`;
                            const savedLink = courseToolsDayLinks?.[activeChapter.id]?.url;
                            const linkVal = dayLinkInputDraft[dk] ?? (savedLink != null ? String(savedLink) : "");
                            const savingLink = dayLinkSavingKey === dk;

                            const batchStudents = getBatchStudents(selectedClass);
                            return (
                              <div className="space-y-4">
                                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                    Select Day
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {courseToolsChapters.map((chapterBtn, btnIdx) => {
                                      const btnDayNum =
                                        typeof chapterBtn.order === "number" ? chapterBtn.order : btnIdx + 1;
                                      const active = chapterBtn.id === activeChapter.id;
                                      return (
                                        <button
                                          key={chapterBtn.id}
                                          type="button"
                                          onClick={() => setCourseToolsSelectedChapterId(chapterBtn.id)}
                                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                            active
                                              ? "bg-[#00448a] text-white border-[#00448a]"
                                              : "bg-white text-slate-700 border-slate-200 hover:border-[#00448a]/40 hover:bg-[#00448a]/5"
                                          }`}
                                          title={chapterBtn.title || `Day ${btnDayNum}`}
                                        >
                                          Day {btnDayNum}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                  <div className="px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">
                                    <p className="font-semibold text-slate-900">
                                      Day {dayNum}: {activeChapter.title || `Day ${dayNum}`}
                                    </p>
                                  </div>

                                  <div className="p-4 space-y-4">
                                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                        Reference link (this day)
                                      </p>
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                          type="text"
                                          placeholder="Paste https link for this day"
                                          value={linkVal}
                                          onChange={(e) =>
                                            setDayLinkInputDraft((p) => ({
                                              ...p,
                                              [dk]: e.target.value,
                                            }))
                                          }
                                          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/25"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => saveDayReferenceLink(selectedClass, activeChapter)}
                                          disabled={savingLink || !isFirebaseConfigured}
                                          className="px-4 py-2.5 rounded-lg bg-[#00448a] text-white text-sm font-semibold hover:bg-[#003a75] disabled:opacity-60 shrink-0"
                                        >
                                          {savingLink ? "Saving…" : "Save link"}
                                        </button>
                                      </div>
                                      {courseToolsDayLinks?.[activeChapter.id]?.url && (
                                        <p className="text-xs text-slate-500 mt-2 break-all">
                                          Saved:{" "}
                                          <a
                                            href={courseToolsDayLinks[activeChapter.id].url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#00448a] hover:underline"
                                          >
                                            {courseToolsDayLinks[activeChapter.id].url}
                                          </a>
                                        </p>
                                      )}
                                    </div>

                                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                          Attendance (this day)
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveDayAttendance(selectedClass, activeChapter)}
                                          disabled={savingAttendance || !isFirebaseConfigured || batchStudents.length === 0}
                                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                                        >
                                          {savingAttendance ? "Saving…" : "Save attendance"}
                                        </button>
                                      </div>
                                      {justSavedAttendance && (
                                        <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium mb-2">
                                          <CheckCircleIcon className="w-4 h-4 shrink-0" />
                                          Attendance saved for this day.
                                        </div>
                                      )}
                                      {batchStudents.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                          {loadingStudents ? "Loading students…" : "No students in this batch yet."}
                                        </p>
                                      ) : (
                                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                          {batchStudents.map((student) => {
                                            const present = attendanceByDay[dayKey]?.[student.id];
                                            return (
                                              <li
                                                key={student.id}
                                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2.5 bg-white hover:bg-slate-50/50"
                                              >
                                                <div className="min-w-0">
                                                  <p className="font-medium text-slate-900 text-sm">{student.name}</p>
                                                  <p className="text-xs text-slate-500 truncate">
                                                    {student.rollNo}
                                                    {student.rollNo && student.email ? " · " : ""}
                                                    {student.email}
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                  <button
                                                    type="button"
                                                    onClick={() => setStudentDayAttendance(dayKey, student.id, true)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                      present === true
                                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                                                    }`}
                                                  >
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                    Present
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setStudentDayAttendance(dayKey, student.id, false)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                      present === false
                                                        ? "bg-red-100 text-red-800 border border-red-200"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                                                    }`}
                                                  >
                                                    <XCircleIcon className="w-4 h-4" />
                                                    Absent
                                                  </button>
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}

                    {/* Unlock class modal — writes to: crt/{crtId}/batches/{batchId}/courses/{courseId}/chapterUnlocks/{chapterId} */}
                    {activeModal === "unlock" && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                          Unlock each day (chapter) for <strong>this batch only</strong>. Students in other batches for the same course stay locked until their trainer unlocks for their batch.
                        </p>
                        {!isFirebaseConfigured && (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Firebase is not configured. Add env keys to use live unlocks.
                          </p>
                        )}
                        {unlockLoading && (
                          <p className="text-sm text-slate-500">Loading chapters from Firestore…</p>
                        )}
                        {unlockError && (
                          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {unlockError}
                          </p>
                        )}
                        {!unlockLoading && unlockMeta?.chapters?.length === 0 && !unlockError && (
                          <p className="text-sm text-slate-600">No chapters found for this course. Add days under CRT admin.</p>
                        )}
                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                          {(unlockMeta?.chapters || []).map((ch) => {
                            const unlocked = isChapterUnlockedForTrainer(ch.id);
                            const canSync = Boolean(unlockMeta?.crtId && unlockMeta?.courseId);
                            return (
                              <li
                                key={ch.id}
                                className="flex items-center justify-between gap-4 px-4 py-3 bg-white hover:bg-slate-50/50 transition-colors"
                              >
                                <span className="font-medium text-slate-900">
                                  Day {typeof ch.order === "number" ? ch.order : "—"}: {ch.title}
                                </span>
                                <button
                                  type="button"
                                  disabled={!canSync || unlockLoading}
                                  onClick={() => handleToggleChapterUnlock(ch.id)}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    unlocked
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 border border-transparent"
                                  }`}
                                >
                                  {unlocked ? (
                                    <>
                                      <LockOpenIcon className="w-4 h-4" />
                                      Unlocked
                                    </>
                                  ) : (
                                    <>
                                      <LockClosedIcon className="w-4 h-4" />
                                      Locked
                                    </>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={handleSaveUnlock}
                            disabled={unlockSaving}
                            className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-semibold text-sm hover:bg-[#003a76] disabled:opacity-60 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )} 

                    {/* Share reference notes — all courses in batch, day-wise + per-course links */}
                    {activeModal === "notes" && selectedClass && (
                      <div className="space-y-6">
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {selectedClass.programName} · {selectedClass.batchName}
                          </span>
                          . Expand each course to add <strong>day-wise</strong> links (stored in{" "}
                          <code className="text-xs bg-slate-100 px-1 rounded">dayReferenceLinks</code>) and optional
                          course-level links (
                          <code className="text-xs bg-slate-100 px-1 rounded">trainerSharedLinks</code>). PDFs stay in{" "}
                          <code className="text-xs bg-slate-100 px-1 rounded">referenceMaterials</code>.
                        </p>

                        {trainerSharedLinksLoading && coursesInSelectedBatch.length > 0 && (
                          <p className="text-sm text-slate-500">Syncing shared links…</p>
                        )}

                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-slate-800">Courses in this batch</h4>
                          {coursesInSelectedBatch.length === 0 && (
                            <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
                              No courses listed for this batch.
                            </p>
                          )}
                          {coursesInSelectedBatch.map((cls) => {
                            const expanded = notesExpandedCourseIds.has(cls.courseId);
                            const sharedForCourse = trainerSharedLinksByCourse[cls.courseId] || [];
                            const chapters = chaptersByCourseForNotes[cls.courseId] || [];
                            const refNotes = referenceNotesByCourseId[cls.courseId];
                            const form = generalLinkFormByCourse[cls.courseId] || { url: "", title: "" };
                            return (
                              <div
                                key={cls.courseId}
                                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleNotesCourseExpand(cls)}
                                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/90 transition-colors"
                                >
                                  <span className="font-semibold text-slate-900">{cls.courseName}</span>
                                  <ChevronDownIcon
                                    className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                                      expanded ? "rotate-180" : ""
                                    }`}
                                    aria-hidden
                                  />
                                </button>

                                {expanded && (
                                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-6 bg-slate-50/60">
                                    {/* Day-wise links */}
                                    <div>
                                      <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                                        Day-wise reference links
                                      </h5>
                                      {chaptersLoadingCourseId === cls.courseId ? (
                                        <p className="text-sm text-slate-500 py-2">Loading days…</p>
                                      ) : chapters.length === 0 ? (
                                        <p className="text-sm text-slate-500 py-2 border border-dashed border-slate-200 rounded-lg px-3">
                                          No chapters (days) found. Add days under CRT admin for this course.
                                        </p>
                                      ) : (
                                        <ul className="space-y-3">
                                          {chapters.map((ch, idx) => {
                                            const dayNum = typeof ch.order === "number" ? ch.order : idx + 1;
                                            const dk = `${cls.courseId}__${ch.id}`;
                                            const saved = dayLinksByCourse[cls.courseId]?.[ch.id];
                                            const val =
                                              dayLinkInputDraft[dk] ?? (saved?.url != null ? String(saved.url) : "");
                                            return (
                                              <li
                                                key={ch.id}
                                                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                                              >
                                                <p className="text-sm font-medium text-slate-800 mb-2">
                                                  Day {dayNum}: {ch.title || `Day ${dayNum}`}
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                  <input
                                                    type="text"
                                                    placeholder="Paste https link for this day"
                                                    value={val}
                                                    onChange={(e) =>
                                                      setDayLinkInputDraft((p) => ({
                                                        ...p,
                                                        [dk]: e.target.value,
                                                      }))
                                                    }
                                                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/25"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => saveDayReferenceLink(cls, ch)}
                                                    disabled={dayLinkSavingKey === dk}
                                                    className="px-4 py-2.5 rounded-lg bg-[#00448a] text-white text-sm font-semibold hover:bg-[#003a75] disabled:opacity-60 shrink-0"
                                                  >
                                                    {dayLinkSavingKey === dk ? "Saving…" : "Save"}
                                                  </button>
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>

                                    {/* General link for this course */}
                                    <form
                                      onSubmit={(e) => handleShareGeneralLinkForCourse(e, cls)}
                                      className="rounded-lg border border-dashed border-slate-300 bg-white p-3 space-y-2"
                                    >
                                      <h5 className="text-xs font-semibold text-slate-600 uppercase">
                                        General link (whole course)
                                      </h5>
                                      <input
                                        type="url"
                                        placeholder="https://..."
                                        value={form.url}
                                        onChange={(e) => setGeneralLinkField(cls.courseId, "url", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Title (optional)"
                                        value={form.title}
                                        onChange={(e) => setGeneralLinkField(cls.courseId, "title", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                      />
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="submit"
                                          disabled={notesSharing || !String(form.url || "").trim()}
                                          className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"
                                        >
                                          {notesSharing ? "Saving…" : "Save link"}
                                        </button>
                                        {linkShareSuccessCourseId === cls.courseId && (
                                          <span className="text-sm text-emerald-700 flex items-center gap-1">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            Saved
                                          </span>
                                        )}
                                      </div>
                                    </form>

                                    {/* Course-level shared links */}
                                    {sharedForCourse.length > 0 && (
                                      <div>
                                        <h5 className="text-xs font-semibold text-slate-600 uppercase mb-2">
                                          Saved links (this course)
                                        </h5>
                                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                                          {sharedForCourse.map((item) => (
                                            <li
                                              key={item.id}
                                              className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50/80"
                                            >
                                              <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">
                                                  {item.title}
                                                </p>
                                                <a
                                                  href={item.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-[#00448a] hover:underline truncate block"
                                                >
                                                  {item.url}
                                                </a>
                                              </div>
                                              <span className="text-[10px] text-slate-500 shrink-0">
                                                {formatSharedLinkDate(item.createdAt || item.sharedAt)}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Reference materials for this course */}
                                    <div>
                                      <h5 className="text-xs font-semibold text-slate-600 uppercase mb-2">
                                        Reference materials
                                      </h5>
                                      {loadingRefNotesCourseId === cls.courseId ? (
                                        <p className="text-sm text-slate-500 py-2">Loading…</p>
                                      ) : !refNotes || refNotes.length === 0 ? (
                                        <p className="text-sm text-slate-500 py-3 px-3 border border-dashed border-slate-200 rounded-lg bg-white">
                                          No documents in{" "}
                                          <code className="text-[10px]">
                                            crt/{cls.programId}/courses/{cls.courseId}/referenceMaterials
                                          </code>
                                          .
                                        </p>
                                      ) : (
                                        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                                          {refNotes.map((note) => {
                                            const shared = getNoteSharedFromDummy(cls.courseId, note);
                                            const noteKey = `${cls.courseId}__${note.id}`;
                                            const isExpanded = expandedShareNoteKey === noteKey;
                                            return (
                                              <li key={note.id} className="hover:bg-slate-50/50">
                                                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                                                  <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900">{note.title}</p>
                                                    <p className="text-xs text-slate-500">
                                                      {note.type}
                                                      {shared && (
                                                        <>
                                                          {" "}
                                                          · Shared
                                                          {note.sharedAt ? ` ${formatDate(note.sharedAt)}` : ""}
                                                        </>
                                                      )}
                                                    </p>
                                                  </div>
                                                  {shared ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                      <CheckCircleIcon className="w-3.5 h-3.5" />
                                                      Shared
                                                    </span>
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={() => openShareForNote(cls.courseId, note.id)}
                                                      className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                                                        isExpanded
                                                          ? "bg-[#00448a] text-white"
                                                          : "bg-amber-100 text-amber-900"
                                                      }`}
                                                    >
                                                      Share
                                                    </button>
                                                  )}
                                                </div>
                                                {isExpanded && !shared && (
                                                  <div className="px-3 pb-3 border-t border-slate-100 bg-amber-50/40">
                                                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                                      <input
                                                        type="url"
                                                        placeholder="Paste link…"
                                                        value={shareLinkInput}
                                                        onChange={(e) => setShareLinkInput(e.target.value)}
                                                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                                      />
                                                      <div className="flex gap-2">
                                                        <button
                                                          type="button"
                                                          onClick={() => handleUploadShareNote(cls, note)}
                                                          disabled={notesSharing}
                                                          className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-60"
                                                        >
                                                          {notesSharing ? "…" : "Save"}
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setExpandedShareNoteKey(null);
                                                            setShareLinkInput("");
                                                          }}
                                                          className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                                        >
                                                          Cancel
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </CheckAuth>
  );
}
