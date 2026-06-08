"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../../../lib/firebase";
import { mcqDb } from "../../../../../lib/firebaseMCQs";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { BookOpen, ArrowLeft, Play, FileText, Radio, Lock, Video, Presentation, ExternalLink, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { createCourseUrl } from "../../../../../lib/urlUtils";

// Helper: is this a Google Drive URL? (use secure viewer). Otherwise use simple viewer for direct PDFs.
function isGoogleDriveUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /drive\.google\.com/i.test(url);
}

// Helper to convert raw URLs into embeddable video URLs (YouTube / Google Drive) 
function getEmbedUrl(url) {
  if (!url) return "";

  // YouTube
  const youtubeRegex =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }
  if (url.includes("youtube.com/embed/")) return url;

  // Google Drive
  const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const driveMatch = url.match(driveRegex);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  if (url.includes("drive.google.com/file/d/") && url.includes("/preview")) {
    return url;
  }

  // Fallback: return as-is
  return url;
}

// Dummy chapters shown when course has no chapters from Firebase (per-course dummy data)
const DUMMY_CHAPTERS = [
  {
    id: "dummy-1",
    order: 1,
    title: "Introduction and Setup",
    topics: "Getting started, environment setup, first steps.",
    video: "",
    pptUrl: "https://docs.google.com/presentation/d/1/dummy/view",
    pdfDocument: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    liveClassLink: "https://meet.google.com/dummy",
    recordedClassLink: "https://youtu.be/V6U4anwVlx8?si=jm-pm0AraQKZAHgr",
    classDocs: "https://docs.google.com/document/d/1/dummy/view",
  },
  {
    id: "dummy-2",
    order: 2,
    title: "Core Concepts",
    topics: "Key concepts, best practices, examples.",
    video: "",
    pptUrl: "https://docs.google.com/presentation/d/2/dummy/view",
    pdfDocument: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    liveClassLink: "",
    recordedClassLink: "https://youtu.be/V6U4anwVlx8?si=jm-pm0AraQKZAHgr",
    classDocs: "https://docs.google.com/document/d/2/dummy/view",
  },
  {
    id: "dummy-3",
    order: 3,
    title: "Advanced Topics",
    topics: "Deep dive, case studies, assignments.",
    video: "",
    pptUrl: "https://docs.google.com/presentation/d/3/dummy/view",
    pdfDocument: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    liveClassLink: "https://meet.google.com/dummy",
    recordedClassLink: "https://youtu.be/V6U4anwVlx8?si=jm-pm0AraQKZAHgr",
    classDocs: "https://docs.google.com/document/d/3/dummy/view",
  },
];

function titleFromCourseId(id) {
  if (!id) return "Course";
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function InternshipCoursePage() {
  const router = useRouter();
  const params = useParams();
  const internshipId = params?.internshipId;
  const courseId = params?.courseId;

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isTrainerUser, setIsTrainerUser] = useState(false);

  const [course, setCourse] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progressTests, setProgressTests] = useState([]);
  const [progressTestSubmissions, setProgressTestSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  // Inline video player state (per chapter)
  const [activeVideoUrl, setActiveVideoUrl] = useState("");
  const [activeVideoTitle, setActiveVideoTitle] = useState("");
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [accessibleChapters, setAccessibleChapters] = useState([]);
  const [expandedChapterId, setExpandedChapterId] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          // Check role from users collection to see if this is a trainer/admin
          const userSnap = await getDoc(doc(db, "users", u.uid));
          const role = userSnap.exists() ? userSnap.data().role : undefined;
          const trainerLike =
            role === "trainer" || role === "crtTrainer" || role === "admin" || role === "superadmin";
          setIsTrainerUser(trainerLike);
        } catch {
          setIsTrainerUser(false);
        }
      } else {
        setIsTrainerUser(false);
      }
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!internshipId || !courseId) return;
      try {
        setLoading(true);
        const courseRef = doc(db, "internships", internshipId, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (courseSnap.exists()) {
          const data = courseSnap.data();
          setCourse({ id: courseSnap.id, ...data });
        }

        const chaptersRef = collection(
          db,
          "internships",
          internshipId,
          "courses",
          courseId,
          "chapters"
        );
        const qCh = query(chaptersRef, orderBy("order", "asc"));
        const chaptersSnap = await getDocs(qCh);
        const list = chaptersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setChapters(list);

        // Load progress tests / assignments from copiedcourses collection (separate from master courses)
        try {
          const testsSnap = await getDocs(
            collection(mcqDb, "copiedcourses", courseId, "assignments")
          );
          const tests = testsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setProgressTests(tests);
          
          // Load submissions for the current user (if logged in)
          if (user) {
            const submissionsMap = {};
            await Promise.all(
              tests.map(async (test) => {
                try {
                  const submissionsRef = collection(
                    mcqDb,
                    "copiedcourses",
                    courseId,
                    "assignments",
                    test.id,
                    "submissions"
                  );
                  const submissionQuery = query(submissionsRef, where("studentId", "==", user.uid));
                  const submissionSnap = await getDocs(submissionQuery);
                  
                  if (!submissionSnap.empty) {
                    const userSubmission = submissionSnap.docs[0];
                    submissionsMap[test.id] = {
                      id: userSubmission.id,
                      ...userSubmission.data(),
                      submittedAt: userSubmission.data().submittedAt?.toDate?.() || new Date(),
                    };
                  }
                } catch (err) {
                  console.error(`Error fetching submission for test ${test.id}:`, err);
                }
              })
            );
            setProgressTestSubmissions(submissionsMap);
          }
        } catch (err) {
          console.error("Failed to load progress tests for internship course:", err);
          setProgressTests([]);
        }
      } catch (e) {
        console.error("Failed to load internship course:", e);
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      fetchData();
    }
  }, [internshipId, courseId, user]);

  // Load which chapters are unlocked for this user (internship course access)
  useEffect(() => {
    async function loadAccess() {
      if (!user || !courseId || !internshipId) return;

      try {
        // Trainers/admins: mirror what students see by looking at the first internship student's chapterAccess
        if (isTrainerUser) {
          const internsSnap = await getDocs(
            collection(db, "internships", internshipId, "students")
          );
          const firstWithId = internsSnap.docs
            .map((d) => d.data())
            .find(
              (s) =>
                typeof s.studentId === "string" && s.studentId.trim().length > 0
            );

          if (firstWithId) {
            const sSnap = await getDoc(doc(db, "students", firstWithId.studentId));
            if (sSnap.exists()) {
              const data = sSnap.data() || {};
              const chapterAccess = data.chapterAccess || {};
              const unlocked = Array.isArray(chapterAccess[courseId])
                ? chapterAccess[courseId]
                : [];
              setAccessibleChapters(unlocked);
              return;
            }
          }
          // Fallback: no student found → treat as all locked
          setAccessibleChapters([]);
          return;
        }

        // Students: use chapterAccess from their own student document
        let studentDoc = await getDoc(doc(db, "students", user.uid));
        if (!studentDoc.exists()) {
          const q = query(
            collection(db, "students"),
            where("uid", "==", user.uid)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            studentDoc = snap.docs[0];
          }
        }
        if (studentDoc && studentDoc.exists()) {
          const data = studentDoc.data() || {};
          const chapterAccess = data.chapterAccess || {};
          const unlocked = Array.isArray(chapterAccess[courseId])
            ? chapterAccess[courseId]
            : [];
          setAccessibleChapters(unlocked);
        } else {
          setAccessibleChapters([]);
        }
      } catch (e) {
        console.error("Failed to load internship chapter access:", e);
        setAccessibleChapters([]);
      }
    }
    loadAccess();
  }, [user, courseId, isTrainerUser, internshipId]);

  if (loadingUser || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center gap-4 text-gray-600">
        <div className="w-12 h-12 border-2 border-[#00448a]/30 border-t-[#00448a] rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading course...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  // Use dummy data when course not in Firebase or no chapters, so clicking any course always shows content
  const displayCourse =
    course ||
    (courseId
      ? {
          id: courseId,
          title: titleFromCourseId(courseId),
          description: "Course content (sample data).",
        }
      : null);
  const displayChapters =
    chapters.length > 0 ? chapters : DUMMY_CHAPTERS;
  const isDummyChapters = chapters.length === 0;

  if (!displayCourse) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">Course not found.</p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </button>
      </div>
    );
  }

  const unlockedCount = displayChapters.filter((ch) =>
    isDummyChapters || accessibleChapters.includes(ch.id)
  ).length;
  const totalChapters = displayChapters.length;
  const progressPct = totalChapters > 0 ? Math.round((unlockedCount / totalChapters) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#00448a] hover:text-[#003a76] mb-6 px-3 py-2 -ml-2 rounded-xl hover:bg-[#00448a]/8 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Internship Courses
        </button>

        {/* Hero with circular progress */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00448a] via-[#003366] to-[#002244] shadow-[0_8px_30px_rgba(0,68,138,0.25)] p-6 sm:p-8 mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.12),transparent)]" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2.5"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                  <path
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeDasharray={`${progressPct}, 100`}
                    strokeLinecap="round"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{progressPct}%</span>
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                  {displayCourse.title || "Untitled Course"}
                </h1>
                {displayCourse.description && (
                  <p className="mt-1 text-sm sm:text-base text-white/90 leading-relaxed line-clamp-2">
                    {displayCourse.description}
                  </p>
                )}
                {displayCourse.courseCode && (
                  <p className="mt-2 text-xs font-medium text-white/60 uppercase tracking-wider">
                    {displayCourse.courseCode}
                  </p>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/12 backdrop-blur-sm border border-white/10 text-white">
              <span className="text-2xl font-bold">{unlockedCount}</span>
              <span className="text-white/70 text-sm">/ {totalChapters} chapters</span>
            </div>
          </div>
          {/* Progress bar under hero */}
          <div className="relative mt-6 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/90 transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Section title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 max-w-[60px] bg-gray-300 rounded-full" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Course content</h2>
          <div className="h-px flex-1 bg-gray-200 rounded-full" />
        </div>
        <div className="relative space-y-0">
              {displayChapters.map((ch, idx) => {
                const dayNumber =
                  typeof ch.order === "number" ? ch.order : idx + 1;
                const dayTests = progressTests.filter(
                  (t) => typeof t.day === "number" && t.day === dayNumber
                );
                const hasAccess =
                  isDummyChapters || accessibleChapters.includes(ch.id);
                const isLast = idx === displayChapters.length - 1;

                return (
                <div key={ch.id} className="relative flex gap-0">
                  {/* Timeline line (connects circles) */}
                  {!isLast && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 to-gray-200 z-0" />
                  )}
                  <div className="flex-shrink-0 w-10 flex flex-col items-center pt-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ring-4 ring-[#f8fafc] z-10 ${
                      hasAccess ? "bg-[#00448a] text-white shadow-md shadow-[#00448a]/25" : "bg-gray-300 text-gray-500"
                    }`}>
                      {typeof ch.order !== "undefined" ? ch.order : idx + 1}
                    </div>
                  </div>
                  <div className={`flex-1 min-w-0 pl-4 sm:pl-5 pb-6 ${!isLast ? "pb-8" : ""}`}>
                    <div
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        hasAccess
                          ? "bg-white border-gray-200/90 shadow-sm hover:shadow-lg hover:border-[#00448a]/20"
                          : "bg-white/60 border-gray-200"
                      } ${expandedChapterId === ch.id ? "ring-2 ring-[#00448a]/20" : ""}`}
                    >
                      {/* Clickable header: day + title (always visible) */}
                      <button
                        type="button"
                        onClick={() => setExpandedChapterId((id) => (id === ch.id ? null : ch.id))}
                        className="w-full text-left p-4 sm:p-5 flex items-center gap-3 hover:bg-gray-50/80 transition-colors rounded-t-2xl"
                      >
                        <span className="flex-shrink-0 text-gray-400">
                          {expandedChapterId === ch.id ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">
                              {ch.title || "Untitled Chapter"}
                            </h3>
                            {!hasAccess && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                                <Lock className="w-3.5 h-3.5" />
                                Locked
                              </span>
                            )}
                          </div>
                          {!hasAccess && (
                            <p className="mt-1 text-sm text-gray-500">
                              Your trainer will unlock this chapter when ready.
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-400 flex-shrink-0">
                          {expandedChapterId === ch.id ? "Hide details" : "View details"}
                        </span>
                      </button>

                      {/* Expanded content: topics, resources, video, tests */}
                      {expandedChapterId === ch.id && (
                      <div className={`px-4 sm:px-5 pb-5 pt-0 ${hasAccess ? "" : "opacity-90"}`}>
                        {ch.topics && (
                          <p className="mb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                            {ch.topics}
                          </p>
                        )}

                        {hasAccess && (
                          <div className="mt-5 pt-5 border-t border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resources</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ch.video && (
                      <button
                        type="button"
                        onClick={() => {
                          const embed = getEmbedUrl(ch.video);
                          if (!embed) return;
                          if (activeChapterId === ch.id && activeVideoUrl === embed) {
                            setActiveVideoUrl("");
                            setActiveVideoTitle("");
                            setActiveChapterId(null);
                          } else {
                            setActiveVideoUrl(embed);
                            setActiveVideoTitle(ch.title || displayCourse.title || "Topic Video");
                            setActiveChapterId(ch.id);
                          }
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                      >
                        <Video className="w-4 h-4 flex-shrink-0" />
                        Topic Video
                      </button>
                    )}
                    {ch.pptUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            router.push(`/view-ppt?url=${encodeURIComponent(ch.pptUrl)}&title=${encodeURIComponent(ch.title || displayCourse.title || "Presentation")}`);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 transition-all"
                        >
                          <Presentation className="w-4 h-4 flex-shrink-0" />
                          PPT
                        </button>
                    )}
                    {ch.pdfDocument && (
                        <button
                          type="button"
                          onClick={() => {
                            const base = isGoogleDriveUrl(ch.pdfDocument) ? "/view-pdf-secure" : "/view-pdf-simple";
                            router.push(`${base}?url=${encodeURIComponent(ch.pdfDocument)}&title=${encodeURIComponent(ch.title || displayCourse.title || "PDF Document")}`);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 hover:border-rose-300 transition-all"
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        PDF
                        </button>
                    )}
                    {ch.liveClassLink && (
                      <a
                        href={ch.liveClassLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-green-50 text-green-700 border border-green-200/80 hover:bg-green-100 hover:border-green-300 transition-all"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        Live Class
                      </a>
                    )}
                    {ch.recordedClassLink && (
                        <button
                          type="button"
                          onClick={() => {
                            const embed = getEmbedUrl(ch.recordedClassLink);
                            if (!embed) return;
                            if (activeChapterId === ch.id && activeVideoUrl === embed) {
                              setActiveVideoUrl("");
                              setActiveVideoTitle("");
                              setActiveChapterId(null);
                            } else {
                              setActiveVideoUrl(embed);
                              setActiveVideoTitle(`${ch.title || displayCourse.title || "Class"} - Recorded`);
                              setActiveChapterId(ch.id);
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 hover:bg-amber-100 hover:border-amber-300 transition-all"
                        >
                          <Play className="w-4 h-4 flex-shrink-0" />
                          Recorded
                        </button>
                      )}
                    {ch.classDocs && (
                        <button
                          type="button"
                          onClick={() => {
                            router.push(`/view-ppt?url=${encodeURIComponent(ch.classDocs)}&title=${encodeURIComponent(ch.title || displayCourse.title || "Class Docs")}`);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-violet-50 text-violet-700 border border-violet-200/80 hover:bg-violet-100 hover:border-violet-300 transition-all"
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        Class Docs
                        </button>
                    )}
                    {ch.referenceDocument && (
                        <button
                          type="button"
                          onClick={() => {
                            const base = isGoogleDriveUrl(ch.referenceDocument) ? "/view-pdf-secure" : "/view-pdf-simple";
                            router.push(`${base}?url=${encodeURIComponent(ch.referenceDocument)}&title=${encodeURIComponent(`${ch.title || displayCourse.title || "Reference"} - Reference Document`)}`);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 hover:border-indigo-300 transition-all"
                        >
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          Reference
                        </button>
                      )}
                            </div>
                          </div>
                        )}

                        {/* Inline video player */}
                        {hasAccess && activeVideoUrl && activeChapterId === ch.id && (
                          <div className="px-4 sm:px-5 pb-5">
                            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900 shadow-xl ring-1 ring-black/10">
                              <div className="px-4 py-2.5 bg-gray-800 flex items-center justify-between">
                                <span className="text-sm font-medium text-white truncate">{activeVideoTitle}</span>
                                <button
                                  type="button"
                                  onClick={() => { setActiveVideoUrl(""); setActiveVideoTitle(""); setActiveChapterId(null); }}
                                  className="text-gray-400 hover:text-white text-sm font-medium px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                  Close
                                </button>
                              </div>
                              <div className="aspect-video w-full relative">
                                <iframe
                                  src={activeVideoUrl}
                                  title={activeVideoTitle}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                                {/* Overlay to hide embed's top-right external link / "Watch on YouTube" icon */}
                                <div
                                  className="absolute top-0 right-0 w-14 h-12 bg-white/1 pointer-events-auto"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Day-wise progress tests */}
                        {hasAccess && dayTests.length > 0 && (
                          <div className="px-4 sm:px-5 pb-5">
                            <div className="pt-4 border-t border-gray-100">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Progress tests</p>
                              <div className="space-y-2">
                                {dayTests.map((test) => {
                                  const submission = progressTestSubmissions[test.id] || null;
                                  const isSubmitted = !!submission;
                                  return (
                                    <div key={test.id} className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden hover:border-[#00448a]/20 transition-colors">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const slug = createCourseUrl(displayCourse.title || "");
                                          if (!slug) return;
                                          const params = new URLSearchParams({ courseId, internshipId });
                                          router.push(`/courses/${slug}/assignments/${test.id}?${params.toString()}`);
                                        }}
                                        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/50 transition-colors"
                                      >
                                        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                                          <Radio className="w-4 h-4 text-[#00448a]" />
                                          {test.title || test.name || `Progress Test (Day ${dayNumber})`}
                                        </span>
                                        {isSubmitted ? (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-800">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Done
                                          </span>
                                        ) : (
                                          <span className="text-xs font-semibold text-[#00448a]">Attempt →</span>
                                        )}
                                      </button>
                                      {isSubmitted && (
                                        <div className="px-4 py-2.5 bg-white border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
                                          {typeof submission.autoScore === "number" && (
                                            <span className={`px-2 py-0.5 rounded-lg font-semibold ${
                                              submission.autoScore >= 80 ? "text-green-700 bg-green-50" :
                                              submission.autoScore >= 50 ? "text-amber-700 bg-amber-50" :
                                              "text-red-700 bg-red-50"
                                            }`}>
                                              {submission.autoScore}%
                                            </span>
                                          )}
                                          <span className="text-gray-500">
                                            {submission.resultStatus === "success" ? "Completed" :
                                             submission.resultStatus === "partial" ? "Partial" :
                                             submission.resultStatus === "fail" ? "Failed" : "Submitted"}
                                          </span>
                                          {submission.testSummary && (
                                            <span className="text-gray-500">
                                              · {submission.testSummary.passCount}/{submission.testSummary.totalCount} passed
                                            </span>
                                          )}
                                          <span className="text-gray-400">
                                            {submission.submittedAt?.toLocaleDateString?.() || "N/A"}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
        </div>

        {/* Full MCQ practice */}
        {displayCourse?.title && (
          <div className="mt-10 p-6 sm:p-7 rounded-2xl border border-gray-200/90 bg-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Full MCQ practice</h3>
                <p className="text-sm text-gray-500">
                  Practice all questions for this course in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const slug = createCourseUrl(displayCourse.title || "");
                  if (!slug) return;
                  router.push(`/practice/${slug}`);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] shadow-md shadow-[#00448a]/20 hover:shadow-lg hover:shadow-[#00448a]/25 transition-all"
              >
                <Radio className="w-4 h-4" />
                Open MCQ practice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


