"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CheckAuth from "../../../../../lib/CheckAuth";
import { createSlug, createCourseUrl } from "../../../../../lib/urlUtils";
import { db, auth, firestoreHelpers } from "../../../../../lib/firebase";
import { isCrtStudentRole } from "../../../../../lib/studentRole";
import { mcqDb } from "../../../../../lib/firebaseMCQs";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  orderBy,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  AcademicCapIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  LockClosedIcon,
} from "@heroicons/react/24/solid";

function getEmbedUrl(url) {
  if (!url) return "";
  const youtubeRegex =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  if (url.includes("youtube.com/embed/")) return url;
  const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const driveMatch = url.match(driveRegex);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return url;
}

function programFromCrtDoc(id, data) {
  if (!data) return null;
  return {
    id,
    title: data.name || id,
    commonCourses: Array.isArray(data.commonCourses) ? data.commonCourses : [],
    technicalCourses: Array.isArray(data.technicalCourses) ? data.technicalCourses : [],
  };
}

/**
 * Admin assigns batch members with `studentId` = document id from `students` (CRT list), not always Firebase Auth uid.
 * Collect every id/email we can tie to this login so unlock listeners attach to the right batch(es).
 */
function addRegd(set, v) {
  const s = String(v ?? "").trim();
  if (s) set.add(s);
}

async function resolveCrtStudentBatchMatchKeys(db, authUser) {
  const uid = authUser?.uid;
  const keys = new Set();
  const emails = new Set();
  const regdNos = new Set();
  if (uid) keys.add(uid);
  const authEmail = (authUser?.email || "").trim().toLowerCase();
  if (authEmail) emails.add(authEmail);

  const absorbStudentSnap = (snap) => {
    if (!snap || !snap.exists()) return;
    const data = snap.data() || {};
    keys.add(snap.id);
    if (data.email) emails.add(String(data.email).trim().toLowerCase());
    addRegd(regdNos, data.regdNo);
  };

  try {
    absorbStudentSnap(await getDoc(doc(db, "students", uid)));
  } catch (_) {
    /* ignore */
  }
  try {
    const q = query(collection(db, "students"), where("uid", "==", uid));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      keys.add(d.id);
      const data = d.data() || {};
      if (data.email) emails.add(String(data.email).trim().toLowerCase());
      addRegd(regdNos, data.regdNo);
    });
  } catch (_) {
    /* ignore */
  }
  try {
    const subQ = query(
      collection(db, "users", "crtStudent", "students"),
      where("uid", "==", uid)
    );
    const subSnap = await getDocs(subQ);
    subSnap.docs.forEach((d) => {
      keys.add(d.id);
      const data = d.data() || {};
      if (data.email) emails.add(String(data.email).trim().toLowerCase());
      addRegd(regdNos, data.regdNo);
    });
  } catch (_) {
    /* ignore */
  }
  try {
    const alt = await getDoc(doc(db, "users", "crtStudent", "students", uid));
    if (alt.exists()) {
      keys.add(alt.id);
      const data = alt.data() || {};
      if (data.email) emails.add(String(data.email).trim().toLowerCase());
      addRegd(regdNos, data.regdNo);
    }
  } catch (_) {
    /* ignore */
  }

  return { keys, emails, regdNos };
}

/** Batches where this student appears under crt/.../batches/{id}/students */
async function findBatchIdsForStudentInCrt(db, crtId, identity) {
  const keys = identity?.keys instanceof Set ? identity.keys : new Set();
  const emails = identity?.emails instanceof Set ? identity.emails : new Set();
  const regdNos = identity?.regdNos instanceof Set ? identity.regdNos : new Set();
  const batchesSnap = await getDocs(collection(db, "crt", crtId, "batches"));
  const ids = [];
  for (const b of batchesSnap.docs) {
    const stSnap = await getDocs(
      collection(db, "crt", crtId, "batches", b.id, "students")
    );
    const member = stSnap.docs.some((d) => {
      const x = d.data() || {};
      const sid = String(x.studentId ?? x.uid ?? d.id ?? "").trim();
      if (sid && keys.has(sid)) return true;
      const uidField = String(x.uid ?? "").trim();
      if (uidField && keys.has(uidField)) return true;
      const em = String(x.email ?? "").trim().toLowerCase();
      if (em && emails.has(em)) return true;
      const regd = String(x.regdNo ?? "").trim();
      if (regd && regdNos.has(regd)) return true;
      return false;
    });
    if (member) ids.push(b.id);
  }
  return ids;
}

/** Batches where this user is the assigned trainer */
async function findBatchIdsForTrainerInCrt(db, crtId, trainerUid) {
  const batchesSnap = await getDocs(collection(db, "crt", crtId, "batches"));
  return batchesSnap.docs
    .filter((d) => (d.data() || {}).trainerId === trainerUid)
    .map((d) => d.id);
}

function StarRating({ value, onChange, max = 5, showValue }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(0)}
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onChange(star); }}
            className="p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-all duration-150 hover:scale-110 active:scale-95"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            aria-pressed={value === star}
          >
            <StarIcon
              className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors ${
                display >= star ? "text-amber-400 drop-shadow-sm" : "text-slate-200"
              } ${display >= star ? "fill-amber-400" : ""}`}
            />
          </button>
        ))}
      </div>
      {showValue && value > 0 && (
        <span className="text-xs font-medium text-amber-700">{value} of {max}</span>
      )}
    </div>
  );
}

export default function CRTCoursePage() {
  const router = useRouter();
  const params = useParams();
  const programSlug = params?.slug;
  const courseSlug = params?.courseId;
  const [program, setProgram] = useState(null);

  useEffect(() => {
    if (!programSlug) {
      setProgram(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ref = firestoreHelpers.doc(db, "crt", programSlug);
        const snap = await firestoreHelpers.getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          setProgram(programFromCrtDoc(snap.id, snap.data()));
          return;
        }
        const crtSnap = await firestoreHelpers.getDocs(firestoreHelpers.collection(db, "crt"));
        if (cancelled) return;
        const found = crtSnap.docs.find(
          (d) => createSlug(d.data().name || "") === programSlug
        );
        setProgram(found ? programFromCrtDoc(found.id, found.data()) : null);
      } catch (_) {
        if (!cancelled) setProgram(null);
      }
    })();
    return () => { cancelled = true; };
  }, [programSlug]);

  const allCommon = (program?.commonCourses || []).map((n) => ({ name: n, slug: createSlug(n) }));
  const allTechnical = (program?.technicalCourses || []).map((n) => ({ name: n, slug: createSlug(n) }));
  const commonMatch = allCommon.find((c) => c.slug === courseSlug);
  const technicalMatch = allTechnical.find((c) => c.slug === courseSlug);

  const [course, setCourse] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progressTests, setProgressTests] = useState([]);
  const [progressTestSubmissions, setProgressTestSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);
  const [initialExpandDone, setInitialExpandDone] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState("");
  const [activeVideoTitle, setActiveVideoTitle] = useState("");
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [user, setUser] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0, percent: 0 });
  const [resolvedCrtId, setResolvedCrtId] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackChapter, setFeedbackChapter] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({
    practicalOriented: 0,
    adminSupport: 0,
    overallTraining: 0,
    classLinkOnTime: 0,
    comments: "",
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [roleCheckDone, setRoleCheckDone] = useState(false);
  const [viewerRole, setViewerRole] = useState(null);
  const [isCrtStudentViewer, setIsCrtStudentViewer] = useState(false);
  const [unlockedChapterIds, setUnlockedChapterIds] = useState([]);
  const [trainerPreviewEnabled, setTrainerPreviewEnabled] = useState(false);
  const unlockMergeRef = useRef({});
  const unlockUnsubsRef = useRef([]);
  const courseName = course?.title || commonMatch?.name || technicalMatch?.name || "";
  const isCommon = Boolean(commonMatch);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Resolve if user can access course: admin, superadmin, CRT student, or CRT/regular trainer
  useEffect(() => {
    if (!user) {
      setHasCourseAccess(false);
      setViewerRole(null);
      setIsCrtStudentViewer(false);
      setRoleCheckDone(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [userSnap, studentDirectSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "students", user.uid)),
        ]);
        if (cancelled) return;
        const userRole = userSnap.exists() ? userSnap.data().role : null;
        let studentData = studentDirectSnap.exists() ? studentDirectSnap.data() : null;
        if (!studentData) {
          const q = query(collection(db, "students"), where("uid", "==", user.uid));
          const studentSnap = await getDocs(q);
          if (!studentSnap.empty) studentData = studentSnap.docs[0].data();
        }
        const studentRole = studentData?.role;
        const isAdmin = userRole === "admin" || userRole === "superadmin";
        const isTrainerRole = userRole === "crtTrainer" || userRole === "trainer";
        const isCrtStudent =
          isCrtStudentRole(userRole) ||
          isCrtStudentRole(studentRole) ||
          studentData?.isCrt === true;
        setViewerRole(userRole || null);
        setIsCrtStudentViewer(Boolean(isCrtStudent));
        setHasCourseAccess(Boolean(isAdmin || isCrtStudent || isTrainerRole));
      } catch (_) {
        if (!cancelled) setHasCourseAccess(false);
      } finally {
        if (!cancelled) setRoleCheckDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  /**
   * Per-batch unlocks only: crt/{crtId}/batches/{batchId}/courses/{courseId}/chapterUnlocks/{chapterId}
   * Students see union of unlocks for batches they belong to; trainers see union for batches they teach.
   */
  useEffect(() => {
    unlockUnsubsRef.current.forEach((u) => u());
    unlockUnsubsRef.current = [];
    unlockMergeRef.current = {};
    setUnlockedChapterIds([]);

    if (!db || !resolvedCrtId || !course?.id || !user?.uid || !roleCheckDone) {
      return;
    }

    if (viewerRole === "admin" || viewerRole === "superadmin") {
      return;
    }

    const isTrainer = viewerRole === "crtTrainer" || viewerRole === "trainer";
    if (isTrainer && trainerPreviewEnabled) {
      return;
    }

    const flush = () => {
      const union = new Set();
      Object.values(unlockMergeRef.current).forEach((set) => {
        if (set && typeof set.forEach === "function") {
          set.forEach((id) => union.add(id));
        }
      });
      setUnlockedChapterIds(Array.from(union));
    };

    let cancelled = false;

    (async () => {
      let batchIds = [];
      if (isCrtStudentViewer) {
        const identity = await resolveCrtStudentBatchMatchKeys(db, user);
        batchIds = await findBatchIdsForStudentInCrt(db, resolvedCrtId, identity);
      } else if (isTrainer) {
        batchIds = await findBatchIdsForTrainerInCrt(db, resolvedCrtId, user.uid);
      } else {
        return;
      }

      if (cancelled) return;

      if (batchIds.length === 0) {
        setUnlockedChapterIds([]);
        return;
      }

      batchIds.forEach((batchId) => {
        const col = collection(
          db,
          "crt",
          resolvedCrtId,
          "batches",
          batchId,
          "courses",
          course.id,
          "chapterUnlocks"
        );
        const unsub = onSnapshot(
          col,
          (snap) => {
            if (cancelled) return;
            const ids = snap.docs
              .filter((d) => d.data()?.unlocked === true)
              .map((d) => d.id);
            unlockMergeRef.current[batchId] = new Set(ids);
            flush();
          },
          () => {
            if (cancelled) return;
            unlockMergeRef.current[batchId] = new Set();
            flush();
          }
        );
        unlockUnsubsRef.current.push(unsub);
      });
    })();

    return () => {
      cancelled = true;
      unlockUnsubsRef.current.forEach((u) => u());
      unlockUnsubsRef.current = [];
    };
  }, [
    resolvedCrtId,
    course?.id,
    user,
    roleCheckDone,
    viewerRole,
    isCrtStudentViewer,
    trainerPreviewEnabled,
  ]);

  // Trainer full-course preview flag (set from CRT Trainer dashboard checkbox)
  useEffect(() => {
    if (!db || !resolvedCrtId || !course?.id) {
      setTrainerPreviewEnabled(false);
      return;
    }
    const previewDoc = doc(
      db,
      "crt",
      resolvedCrtId,
      "courses",
      course.id,
      "trainerPreview",
      "default"
    );
    const unsub = onSnapshot(
      previewDoc,
      (snap) => {
        setTrainerPreviewEnabled(snap.exists() && snap.data()?.enabled === true);
      },
      () => setTrainerPreviewEnabled(false)
    );
    return () => unsub();
  }, [resolvedCrtId, course?.id]);

  useEffect(() => {
    setInitialExpandDone(false);
    setExpandedDay(null);
  }, [resolvedCrtId, course?.id]);

  // Fetch attendance for this course (when course + user available)
  useEffect(() => {
    if (!course?.id || !user?.uid) {
      setAttendanceStats({ total: 0, present: 0, percent: 0 });
      return;
    }
    const courseId = course.id;
    let cancelled = false;
    (async () => {
      try {
        const attCol = collection(db, "attendance");
        const trainerSnap = await getDocs(
          query(attCol, where("type", "==", "trainer"), where("courseId", "==", courseId))
        );
        const selfSnap = await getDocs(
          query(attCol, where("type", "==", "self"), where("courseId", "==", courseId), where("userId", "==", user.uid))
        );
        const trainerChapters = new Set();
        const trainerPresentChapters = new Set();
        let studentDocId = user.uid;
        try {
          const directSnap = await getDoc(doc(db, "students", user.uid));
          if (!directSnap.exists()) {
            const sq = query(collection(db, "students"), where("uid", "==", user.uid));
            const sSnap = await getDocs(sq);
            if (!sSnap.empty) studentDocId = sSnap.docs[0].id;
          }
        } catch (_) {}
        trainerSnap.docs.forEach((d) => {
          const data = d.data() || {};
          const chId = data.chapterId;
          if (!chId) return;
          trainerChapters.add(chId);
          const presentArr = Array.isArray(data.present) ? data.present : [];
          if (presentArr.includes(studentDocId)) trainerPresentChapters.add(chId);
        });
        const selfChapters = new Set();
        selfSnap.docs.forEach((d) => {
          const data = d.data() || {};
          if (data.chapterId) selfChapters.add(data.chapterId);
        });
        const totalChapters = new Set([...trainerChapters, ...selfChapters]);
        const selfOnlyPresent = new Set([...selfChapters].filter((ch) => !trainerChapters.has(ch)));
        const presentChapters = new Set([...trainerPresentChapters, ...selfOnlyPresent]);
        const total = totalChapters.size;
        const present = presentChapters.size;
        const percent = total > 0 ? Math.round((present / total) * 100) : 0;
        if (!cancelled) setAttendanceStats({ total, present, percent });
      } catch (e) {
        if (!cancelled) setAttendanceStats({ total: 0, present: 0, percent: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [course?.id, user?.uid]);

  useEffect(() => {
    async function resolveAndFetch() {
      if (!programSlug || !courseSlug || !program) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const crtSnap = await getDocs(collection(db, "crt"));
        let resolvedCrtId = null;
        let resolvedCourse = null;
        for (const crtDoc of crtSnap.docs) {
          const data = crtDoc.data();
          const matchesProgram =
            crtDoc.id === programSlug ||
            (data.programId && data.programId === programSlug) ||
            (data.name && createSlug(data.name) === programSlug) ||
            (data.name && data.name === program.title);
          if (!matchesProgram) continue;
          resolvedCrtId = crtDoc.id;
          const coursesRef = collection(db, "crt", crtDoc.id, "courses");
          const coursesSnap = await getDocs(coursesRef);
          const found = coursesSnap.docs.find(
            (c) => c.id === courseSlug || createSlug(c.data().title || "") === courseSlug
          );
          if (found) {
            resolvedCourse = { id: found.id, ...found.data() };
            break;
          }
        }
        if (!resolvedCourse || !resolvedCrtId) {
          setCourse(null);
          setChapters([]);
          setProgressTests([]);
          setResolvedCrtId(null);
          setLoading(false);
          return;
        }
        setCourse(resolvedCourse);
        setResolvedCrtId(resolvedCrtId);

        const chaptersRef = collection(
          db,
          "crt",
          resolvedCrtId,
          "courses",
          resolvedCourse.id,
          "chapters"
        );
        const chaptersQuery = query(chaptersRef, orderBy("order", "asc"));
        const chaptersSnap = await getDocs(chaptersQuery);
        const chapterList = chaptersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setChapters(chapterList);

        try {
          const testsSnap = await getDocs(
            collection(mcqDb, "copiedcourses", resolvedCourse.id, "assignments")
          );
          const tests = testsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setProgressTests(tests);

          if (user) {
            const submissionsMap = {};
            await Promise.all(
              tests.map(async (test) => {
                const submissionsRef = collection(
                  mcqDb,
                  "copiedcourses",
                  resolvedCourse.id,
                  "assignments",
                  test.id,
                  "submissions"
                );
                const q = query(submissionsRef, where("studentId", "==", user.uid));
                const subSnap = await getDocs(q);
                if (!subSnap.empty) {
                  const doc = subSnap.docs[0];
                  submissionsMap[test.id] = {
                    id: doc.id,
                    ...doc.data(),
                    submittedAt: doc.data().submittedAt?.toDate?.() || new Date(),
                  };
                }
              })
            );
            setProgressTestSubmissions(submissionsMap);
          }
        } catch {
          setProgressTests([]);
        }
      } catch (e) {
        console.error("CRT course fetch error:", e);
        setCourse(null);
        setChapters([]);
        setProgressTests([]);
        setResolvedCrtId(null);
      } finally {
        setLoading(false);
      }
    }
    resolveAndFetch();
  }, [programSlug, courseSlug, program?.id, program?.title, program, user?.uid, user]);

  // Expand first visible day (locked viewers: first unlocked chapter; full preview: first chapter)
  useEffect(() => {
    if (loading || !hasCourseAccess || initialExpandDone || chapters.length === 0) return;
    const isTrainer = viewerRole === "crtTrainer" || viewerRole === "trainer";
    const needsChapterUnlock =
      (isCrtStudentViewer && viewerRole !== "superadmin") ||
      (isTrainer && !trainerPreviewEnabled);
    const first = chapters.find((ch) => {
      if (!needsChapterUnlock) return true;
      return unlockedChapterIds.includes(ch.id);
    });
    if (first) setExpandedDay(first.id);
    setInitialExpandDone(true);
  }, [
    loading,
    hasCourseAccess,
    chapters,
    initialExpandDone,
    unlockedChapterIds,
    isCrtStudentViewer,
    viewerRole,
    trainerPreviewEnabled,
  ]);

  useEffect(() => {
    const isTrainer = viewerRole === "crtTrainer" || viewerRole === "trainer";
    const needsChapterUnlock =
      (isCrtStudentViewer && viewerRole !== "superadmin") ||
      (isTrainer && !trainerPreviewEnabled);
    if (!needsChapterUnlock || viewerRole === "superadmin") return;
    if (!chapters.length || !unlockedChapterIds.length) return;
    if (expandedDay !== null) return;
    const first = chapters.find((ch) => unlockedChapterIds.includes(ch.id));
    if (first) setExpandedDay(first.id);
  }, [
    unlockedChapterIds,
    chapters,
    isCrtStudentViewer,
    viewerRole,
    expandedDay,
    trainerPreviewEnabled,
  ]);

  const isChapterUnlockedForViewer = (ch) => {
    if (viewerRole === "superadmin") return true;
    if (viewerRole === "admin") return true;
    const isTrainer = viewerRole === "crtTrainer" || viewerRole === "trainer";
    if (isTrainer && trainerPreviewEnabled) return true;
    if (isTrainer && !trainerPreviewEnabled) return unlockedChapterIds.includes(ch.id);
    if (!isCrtStudentViewer) return true;
    return unlockedChapterIds.includes(ch.id);
  };

  const pendingAssignments = useMemo(() => {
    const pending = progressTests.filter((t) => !progressTestSubmissions[t.id]);
    const isTrainer = viewerRole === "crtTrainer" || viewerRole === "trainer";
    const filterByUnlock =
      (isCrtStudentViewer && viewerRole !== "superadmin") ||
      (isTrainer && !trainerPreviewEnabled);
    if (!filterByUnlock || viewerRole === "superadmin") return pending;
    return pending.filter((t) => {
      const dayNum = typeof t.day === "number" ? t.day : 1;
      const ch = chapters.find((c, idx) => {
        const ord = typeof c.order === "number" ? c.order : idx + 1;
        return ord === dayNum;
      });
      return ch && unlockedChapterIds.includes(ch.id);
    });
  }, [
    progressTests,
    progressTestSubmissions,
    chapters,
    unlockedChapterIds,
    isCrtStudentViewer,
    viewerRole,
    trainerPreviewEnabled,
  ]);

  if (!program) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Programme not found</h1>
          <Link href="/crt" className="text-[#00448a] font-semibold hover:underline">
            ← Back to CRT Programmes
          </Link>
        </div>
      </CheckAuth>
    );
  }

  const openPdf = (url, title) => {
    if (!url) return;
    router.push(
      `/view-pdf-secure?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || "PDF")}`
    );
  };
  const openPpt = (url, title) => {
    if (!url) return;
    router.push(
      `/view-ppt?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || "PPT")}`
    );
  };
  const openProgressTest = (test) => {
    const slug = createCourseUrl(course?.title || courseName);
    if (!slug) return;
    router.push(
      `/crt/${programSlug}/courses/${slug}/dayassignment/${test.id}`
    );
  };

  const openFeedbackModal = (ch, dayNumber) => {
    setFeedbackChapter({
      id: ch.id,
      title: ch.title || `Day ${dayNumber}`,
      dayNumber: typeof ch.order === "number" ? ch.order : dayNumber,
    });
    setFeedbackForm({
      practicalOriented: 0,
      adminSupport: 0,
      overallTraining: 0,
      classLinkOnTime: 0,
      comments: "",
    });
    setFeedbackSubmitted(false);
    setShowFeedbackModal(true);
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackChapter(null);
  };

  const submitFeedback = async () => {
    if (!user?.uid || !feedbackChapter || !resolvedCrtId || !course?.id) return;
    const { practicalOriented, adminSupport, overallTraining, classLinkOnTime, comments } = feedbackForm;
    if (practicalOriented === 0 || adminSupport === 0 || overallTraining === 0 || classLinkOnTime === 0) {
      alert("Please rate all four criteria (1–5 stars) before submitting.");
      return;
    }
    try {
      setFeedbackSubmitting(true);
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userName: user.displayName || user.email || "Anonymous",
        crtId: resolvedCrtId,
        courseId: course.id,
        courseName: courseName || course.title,
        chapterId: feedbackChapter.id,
        chapterTitle: feedbackChapter.title,
        day: feedbackChapter.dayNumber,
        practicalOriented,
        adminSupport,
        overallTraining,
        classLinkOnTime,
        comments: (comments || "").trim(),
        createdAt: serverTimestamp(),
      });
      setFeedbackSubmitted(true);
      setTimeout(closeFeedbackModal, 1500);
    } catch (e) {
      console.error("Feedback submit error:", e);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const displayChapters = chapters;

  return (
    <CheckAuth>
      <div className="min-h-screen bg-slate-100 pt-16 pb-20">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Link
            href={`/crt/${programSlug}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-[#00448a] font-medium text-sm mb-6 sm:mb-8 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to {program.title}
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
            {/* Main content: course card with days */}
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div
                  className={`px-6 sm:px-8 lg:px-10 py-6 sm:py-7 flex items-center gap-4 ${
                    isCommon
                      ? "bg-gradient-to-r from-slate-700 to-slate-600"
                      : "bg-gradient-to-r from-[#1a5796] to-[#0d3a6e]"
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <BookOpenIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/80 text-xs sm:text-sm font-semibold uppercase tracking-wider">
                      {program.title}
                    </p>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1 truncate">{courseName}</h1>
                  </div>
                </div>

                <div className="p-6 sm:p-8 lg:p-10">
                  {loading ? (
                    <p className="text-slate-500">Loading course content...</p>
                  ) : displayChapters.length === 0 ? (
                    <p className="text-slate-500">No course content added yet.</p>
                  ) : !roleCheckDone ? (
                    <p className="text-slate-500">Checking access...</p>
                  ) : (
                    <>
                  <div className="space-y-4">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-5">Course content (day-wise)</h2>
                
                  {displayChapters.map((ch, idx) => {
                    const dayNumber = typeof ch.order === "number" ? ch.order : idx + 1;
                    const dayTests = progressTests.filter(
                      (t) => (typeof t.day === "number" ? t.day : 1) === dayNumber
                    );
                    const dayUnlocked = isChapterUnlockedForViewer(ch);
                    const isExpanded =
                      hasCourseAccess &&
                      dayUnlocked &&
                      (expandedDay === ch.id || expandedDay === dayNumber);

                    if (!hasCourseAccess) {
                      return (
                        <div
                          key={ch.id}
                          className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-sm"
                        >
                          <div className="w-full px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-600 text-base sm:text-lg">
                              Day {dayNumber}: {ch.title || `Day ${dayNumber}`}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                              <LockClosedIcon className="w-4 h-4" />
                              Locked
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (!dayUnlocked) {
                      return (
                        <div
                          key={ch.id}
                          className="border border-amber-200/80 rounded-xl overflow-hidden bg-amber-50/50 shadow-sm"
                        >
                          <div className="w-full px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <span className="font-semibold text-slate-700 text-base sm:text-lg">
                              Day {dayNumber}: {ch.title || `Day ${dayNumber}`}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                              <LockClosedIcon className="w-4 h-4" />
                              Locked until trainer unlocks
                            </span>
                          </div>
                          <p className="px-4 sm:px-5 pb-3 text-xs text-amber-900/80">
                            Your trainer unlocks days per batch from the CRT Trainer dashboard — only students in that batch get access.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={ch.id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDay(isExpanded ? null : ch.id)
                          }
                          className="w-full px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/80 transition-colors text-left border-0"
                        >
                          <span className="font-semibold text-slate-800 text-base sm:text-lg">
                            Day {dayNumber}: {ch.title || `Day ${dayNumber}`}
                          </span>
                          {isExpanded ? (
                            <ChevronUpIcon className="w-5 h-5 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-slate-500 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 border-t border-slate-100 sm:px-5 sm:pb-5 sm:pt-4">
                            {ch.topics && (
                              <div className="mb-5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-[#0d3a6e] mb-2">
                                  <BookOpenIcon className="w-4 h-4" />
                                  Topics
                                </h4>
                                <p className="text-sm sm:text-base text-slate-600 whitespace-pre-line leading-relaxed max-w-4xl">
                                  {ch.topics}
                                </p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 sm:gap-3">
                              <button
                                type="button"
                                disabled={!ch.pdfDocument}
                                onClick={() => {
                                  if (ch.pdfDocument) openPdf(ch.pdfDocument, ch.title || courseName || "PDF");
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-100 text-violet-800 hover:bg-violet-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <DocumentArrowDownIcon className="w-4 h-4" />
                                PDF
                              </button>
                              <button
                                type="button"
                                disabled={!ch.pptUrl}
                                onClick={() => {
                                  if (ch.pptUrl) openPpt(ch.pptUrl, ch.title || courseName || "PPT");
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <DocumentTextIcon className="w-4 h-4" />
                                PPT
                              </button>
                              {ch.liveClassLink && (
                                <a
                                  href={ch.liveClassLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-sm font-medium"
                                >
                                  <VideoCameraIcon className="w-4 h-4" />
                                  Live Class
                                </a>
                              )}
                              <button
                                type="button"
                                disabled={!ch.recordedClassLink || !getEmbedUrl(ch.recordedClassLink)}
                                onClick={() => {
                                  const embed = ch.recordedClassLink ? getEmbedUrl(ch.recordedClassLink) : "";
                                  if (!embed) return;
                                  if (activeChapterId === ch.id && activeVideoUrl === embed) {
                                    setActiveVideoUrl("");
                                    setActiveVideoTitle("");
                                    setActiveChapterId(null);
                                  } else {
                                    setActiveVideoUrl(embed);
                                    setActiveVideoTitle(`${ch.title || "Class"} - Recorded`);
                                    setActiveChapterId(ch.id);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <VideoCameraIcon className="w-4 h-4" />
                                Recorded Class
                              </button>
                              {dayTests.map((test, testIdx) => {
                                const submission = progressTestSubmissions[test.id];
                                const isSubmitted = !!submission;
                                const label = dayTests.length === 1 ? "Progress Test (1)" : `Progress Test (${testIdx + 1})`;
                                return (
                                  <button
                                    key={test.id}
                                    type="button"
                                    onClick={() => openProgressTest(test)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm font-medium"
                                  >
                                    <DocumentTextIcon className="w-4 h-4" />
                                    {test.title || label}
                                    {isSubmitted && (
                                      <span className="ml-1 w-4 h-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center">✓</span>
                                    )}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                disabled={!(ch.referenceDocument || ch.classDocs)}
                                onClick={() => {
                                  const url = ch.referenceDocument || ch.classDocs;
                                  if (url) openPdf(url, `${ch.title || "Reference"} - Trainer document`);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <AcademicCapIcon className="w-4 h-4" />
                                Trainer reference document
                              </button>
                              <button
                                type="button"
                                onClick={() => openFeedbackModal(ch, dayNumber)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-100 text-pink-800 hover:bg-pink-200 text-sm font-medium"
                              >
                                <StarIcon className="w-4 h-4" />
                                Feedback
                              </button>
                            </div>

                            {activeVideoUrl && activeChapterId === ch.id && (
                              <div className="mt-5">
                                <h4 className="text-sm font-semibold text-slate-800 mb-2">
                                  {activeVideoTitle}
                                </h4>
                                <div className="aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-black">
                                  <iframe
                                    src={activeVideoUrl}
                                    title={activeVideoTitle}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )}
                </div>
              </div>
            </div>

            {/* Right sidebar: Pending assignments & Attendance (top right, uses remaining space) */}
            <div className="lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-24 order-1 lg:order-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white shadow-md p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <ClipboardDocumentListIcon className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Pending assignments</h3>
                    {pendingAssignments.length === 0 ? (
                      <p className="text-sm text-slate-600">No pending assignments</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-amber-700">{pendingAssignments.length} pending</p>
                        <ul className="mt-1.5 space-y-0.5">
                          {pendingAssignments.slice(0, 3).map((t) => (
                            <li key={t.id} className="text-xs text-slate-600 truncate">
                              Day {t.day ?? "—"}: {t.title || "Progress Test"}
                            </li>
                          ))}
                          {pendingAssignments.length > 3 && (
                            <li className="text-xs text-slate-500">+{pendingAssignments.length - 3} more</li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white shadow-md p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <UserGroupIcon className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Attendance</h3>
                    {course?.id ? (
                      attendanceStats.total > 0 ? (
                        <p className="text-sm text-slate-700">
                          <span className="font-medium text-blue-700">{attendanceStats.present}</span>
                          <span className="text-slate-500"> / {attendanceStats.total} sessions</span>
                          <span className="ml-1.5 text-xs font-medium text-slate-600">
                            ({attendanceStats.percent}%)
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-slate-600">No attendance recorded yet</p>
                      )
                    ) : (
                      <p className="text-sm text-slate-500">—</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback modal */}
      {showFeedbackModal && feedbackChapter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={closeFeedbackModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-amber-50 via-white to-pink-50 px-5 sm:px-6 py-5 border-b border-amber-100/80">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-md shrink-0">
                  <StarIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="feedback-modal-title" className="text-lg font-bold text-slate-800">
                    Session feedback
                  </h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Day {feedbackChapter.dayNumber} · {feedbackChapter.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    1 = Poor · 5 = Excellent
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {feedbackSubmitted ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-emerald-700 font-semibold text-lg">Thank you!</p>
                  <p className="text-slate-600 text-sm mt-1">Your feedback has been submitted.</p>
                </div>
              ) : (
                <>
                  {[
                    { key: "practicalOriented", label: "Practical Oriented" },
                    { key: "adminSupport", label: "Admin Support" },
                    { key: "overallTraining", label: "Overall class training" },
                    { key: "classLinkOnTime", label: "Class link on time" },
                  ].map((item, idx) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-3">
                       
                        <label className="text-sm font-semibold text-slate-800">{item.label}</label>
                      </div>
                      <StarRating
                        value={feedbackForm[item.key]}
                        onChange={(v) => setFeedbackForm((f) => ({ ...f, [item.key]: v }))}
                        showValue
                      />
                    </div>
                  ))}

                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Comments for trainer <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={feedbackForm.comments}
                      onChange={(e) => setFeedbackForm((f) => ({ ...f, comments: e.target.value }))}
                      placeholder="Share any additional feedback for the trainer..."
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 focus:outline-none transition"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeFeedbackModal}
                      disabled={feedbackSubmitting}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={
                        feedbackSubmitting ||
                        feedbackForm.practicalOriented === 0 ||
                        feedbackForm.adminSupport === 0 ||
                        feedbackForm.overallTraining === 0 ||
                        feedbackForm.classLinkOnTime === 0
                      }
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition"
                    >
                      {feedbackSubmitting ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </span>
                      ) : (
                        "Submit feedback"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </CheckAuth>
  );
}
