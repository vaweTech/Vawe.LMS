"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  GraduationCap,
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Video,
  FileText,
  Presentation,
  ClipboardList,
  MessageSquare,
  Radio,
  BookOpen,
  X,
} from "lucide-react";
import { db } from "../lib/firebase";
import { createSlug } from "../lib/urlUtils";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  collectionGroup,
  query,
  where,
} from "firebase/firestore";

const RECENT_CLASS_CARDS = [
  { id: "java", name: "JAVA", gradient: "from-[#00448a] to-[#26ebe5]" },
  { id: "soft-skills", name: "Soft Skills", gradient: "from-[#26ebe5] to-[#0ea5e9]" },
  { id: "aptitude", name: "Aptitude", gradient: "from-[#f56c53] to-[#fdc377]" },
  { id: "html", name: "HTML", gradient: "from-[#00448a] to-[#f56c53]" },
];

export default function CRTProgramView({ user, profile, setProfile, showBackToDashboard, studentDocId }) {
  const [selectedCrtId, setSelectedCrtId] = useState(null);
  const [recentClassModal, setRecentClassModal] = useState(null);
  const [upcomingClassModal, setUpcomingClassModal] = useState(null);
  const [crtPrograms, setCrtPrograms] = useState([]);
  const [crtCourses, setCrtCourses] = useState([]);
  const [coursesWithProgress, setCoursesWithProgress] = useState([]);
  const [assignedCrtIds, setAssignedCrtIds] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Real-time: CRT programs from Firestore collection "crt"
  useEffect(() => {
    if (!db) {
      setLoadingPrograms(false);
      return () => {};
    }
    const unsub = onSnapshot(
      collection(db, "crt"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCrtPrograms(list);
        setLoadingPrograms(false);
      },
      (err) => {
        console.error("CRT programs listener error:", err);
        setLoadingPrograms(false);
      }
    );
    return () => unsub();
  }, []);

  // Resolve which CRTs this student is assigned to (crt/{id}/students has studentId)
  useEffect(() => {
    if (!db || !studentDocId) {
      setAssignedCrtIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collectionGroup(db, "students"),
          where("studentId", "==", studentDocId)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const ids = snap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean);
        setAssignedCrtIds(ids);
      } catch (e) {
        if (!cancelled) setAssignedCrtIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [studentDocId]);

  // Real-time: courses for selected CRT from crt/{crtId}/courses
  useEffect(() => {
    if (!db || !selectedCrtId) {
      setCrtCourses([]);
      setCoursesWithProgress([]);
      setLoadingCourses(false);
      return () => {};
    }
    setLoadingCourses(true);
    const unsub = onSnapshot(
      collection(db, "crt", selectedCrtId, "courses"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCrtCourses(list);
        setLoadingCourses(false);
      },
      (err) => {
        console.error("CRT courses listener error:", err);
        setCrtCourses([]);
        setLoadingCourses(false);
      }
    );
    return () => unsub();
  }, [selectedCrtId]);

  // Enrich courses with progress (totalChapters from crt/{id}/courses/{courseId}/chapters, opened from student chapterAccess)
  useEffect(() => {
    if (!db || !selectedCrtId || crtCourses.length === 0) {
      setCoursesWithProgress([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let chapterAccess = {};
      if (studentDocId) {
        try {
          const studentSnap = await getDoc(doc(db, "students", studentDocId));
          if (studentSnap.exists() && !cancelled) {
            chapterAccess = studentSnap.data().chapterAccess || {};
          }
        } catch (_) {}
      }
      const enriched = await Promise.all(
        crtCourses.map(async (course) => {
          let totalChapters = 0;
          try {
            const chRef = collection(db, "crt", selectedCrtId, "courses", course.id, "chapters");
            const chSnap = await getDocs(chRef);
            if (!cancelled) totalChapters = chSnap.size;
          } catch (_) {}
          const openedChapters = Array.isArray(chapterAccess[course.id]) ? chapterAccess[course.id].length : 0;
          const percentage = totalChapters > 0 ? Math.round((openedChapters / totalChapters) * 100) : 0;
          return {
            ...course,
            title: course.title || course.name || "Untitled",
            totalChapters,
            openedChapters,
            percentage,
          };
        })
      );
      if (!cancelled) setCoursesWithProgress(enriched);
    })();
    return () => { cancelled = true; };
  }, [selectedCrtId, crtCourses, studentDocId]);

  const displayedPrograms =
    assignedCrtIds.length > 0
      ? crtPrograms.filter((p) => assignedCrtIds.includes(p.id))
      : crtPrograms;
  const selectedProgram = crtPrograms.find((p) => p.id === selectedCrtId);

  const displayName =
    profile?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Student";
  const email = profile?.email || user?.email || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdc377]/30 via-[#26ebe5]/20 to-[#00448a]/10 p-4 sm:p-6 lg:p-8 2xl:p-10">
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 space-y-4 sm:space-y-0">
          <h1 className="text-2xl sm:text-3xl font-bold">CRT Dashboard</h1>
          {showBackToDashboard && (
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm bg-white/90 border border-gray-200 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)] items-start">
          {/* Left column: profile + classes */}
          <div className="space-y-6">
            {/* Profile (dashboard theme) */}
            <div className="border border-black bg-white/95 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full border-4 border-black shadow-lg bg-white/20">
                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-black" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-black truncate">
                      {displayName}
                    </h3>
                    {email && (
                      <p className="text-xs sm:text-sm opacity-80 text-black truncate">
                        {email}
                      </p>
                    )}
                    {profile?.phone && (
                      <p className="text-xs sm:text-sm text-gray-700 mt-0.5 truncate">
                        {profile.phone}
                      </p>
                    )}
                    {profile?.address && (
                      <p className="text-xs sm:text-sm text-gray-700 mt-0.5 truncate">
                        {profile.address}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
                      CRT Student
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-[11px] px-2 py-1 rounded-full bg-[#26ebe5]/15 text-[#00448a] border border-[#26ebe5]/40">
                  CRT Program Access
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-[#fdc377]/20 text-[#6b4a13] border border-[#fdc377]/50">
                  Student Dashboard
                </span>
              </div>
            </div>

            {/* Recent class */}
            <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-md p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-[#00448a]" />
                Recent class
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setRecentClassModal("record")}
                  className="inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl w-full sm:w-auto bg-[#00448a] text-white hover:bg-[#003a76] transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Record class
                </button>
                <button
                  type="button"
                  onClick={() => setRecentClassModal("pdf")}
                  className="inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl w-full sm:w-auto bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#00448a]" />
                  Class PDF
                </button>
                <button
                  type="button"
                  onClick={() => setRecentClassModal("ppt")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <Presentation className="w-4 h-4 text-[#00448a]" />
                  PPT
                </button>
                <button
                  type="button"
                  onClick={() => setRecentClassModal("assignment")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <ClipboardList className="w-4 h-4 text-[#00448a]" />
                  Assignment
                </button>
                <button
                  type="button"
                  onClick={() => setRecentClassModal("feedback")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-[#00448a]" />
                  Feedback
                </button>
                <button
                  type="button"
                  onClick={() => setRecentClassModal("trainer-pdf")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-[#00448a]" />
                  Trainer reference PDF
                </button>
              </div>
            </div>

            {/* Upcoming / Current class */}
            <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-md p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#00448a]" />
                Upcoming / Current class
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setUpcomingClassModal("live")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] transition-colors"
                >
                  <Radio className="w-4 h-4" />
                  Live class
                </button>
                <button
                  type="button"
                  onClick={() => setUpcomingClassModal("pdf")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#00448a]" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setUpcomingClassModal("ppt")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5] transition-colors"
                >
                  <Presentation className="w-4 h-4 text-[#00448a]" />
                  PPT
                </button>
              </div>
            </div>
          </div>

          {/* Right column: CRT programs + courses */}
          <div className="space-y-6">
            {/* CRT Programs heading */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                <GraduationCap className="w-6 h-6 text-[#00448a]" />
                CRT Programs
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mb-4">
                Select a CRT program to view its courses and your progress.
              </p>

              {loadingPrograms ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00448a]" />
                  <span className="ml-2">Loading programs...</span>
                </div>
              ) : displayedPrograms.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                  <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium">No CRT programs found</p>
                  <p className="text-xs mt-1">Programs will appear here when added by admin.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {displayedPrograms.map((crt) => (
                    <button
                      key={crt.id}
                      type="button"
                      onClick={() =>
                        setSelectedCrtId((prev) => (prev === crt.id ? null : crt.id))
                      }
                      className={`group text-left bg-white border rounded-xl shadow-sm hover:shadow-md transition-all p-0 w-full overflow-hidden ${
                        selectedCrtId === crt.id
                          ? "border-[#00448a] ring-1 ring-[#00448a]/40"
                          : "border-gray-100 hover:border-indigo-100"
                      }`}
                    >
                      <div className="bg-gradient-to-r from-[#00448a] to-[#f56c53] p-4 text-white">
                        <h3 className="text-base font-semibold line-clamp-1">
                          {crt.name || crt.title || crt.id}
                        </h3>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <span className="text-xs text-gray-600">Program</span>
                        <span className="text-sm font-semibold text-[#00448a]">
                          {selectedCrtId === crt.id ? "Hide courses ↑" : "View courses ↓"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected CRT courses with progress (real-time) */}
            {selectedCrtId && (
              <div className="bg-white/95 border border-gray-200 rounded-2xl shadow-md p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                  {selectedProgram?.name || selectedProgram?.title || selectedCrtId} Courses
                </h3>
                {loadingCourses ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00448a]" />
                    <span className="ml-2">Loading courses...</span>
                  </div>
                ) : coursesWithProgress.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm font-medium">No courses in this program</p>
                    <p className="text-xs mt-1">Courses will appear when assigned by admin.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {coursesWithProgress.map((course) => {
                      const { openedChapters = 0, totalChapters = 0, percentage = 0 } = course;
                      const title = course.title || course.name || "Untitled";
                      return (
                        <Link
                          key={course.id}
                          href={`/crt/${createSlug(selectedProgram?.name || selectedProgram?.title || selectedCrtId)}/courses/${createSlug(course.title || course.name || course.id)}`}
                          className="block bg-white border border-gray-100 rounded-xl shadow-sm p-4 hover:shadow-md hover:border-[#00448a]/30 transition-all text-left"
                        >
                          <h4 className="text-base font-semibold text-gray-900 line-clamp-2">
                            {title}
                          </h4>
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-gray-600">
                                Progress
                              </span>
                              <span className="text-[11px] font-bold text-emerald-600">
                                {openedChapters} / {totalChapters}
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                              <div
                                className="h-2.5 bg-emerald-500"
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-[#00448a] font-medium mt-2 inline-block">
                            Open course →
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent class popup */}
      {recentClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRecentClassModal(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#00448a] to-[#26ebe5] text-white">
              <div className="flex items-center gap-2">
                {recentClassModal === "record" && <Video className="w-5 h-5" />}
                {recentClassModal === "pdf" && <FileText className="w-5 h-5" />}
                {recentClassModal === "ppt" && <Presentation className="w-5 h-5" />}
                {recentClassModal === "assignment" && <ClipboardList className="w-5 h-5" />}
                {recentClassModal === "feedback" && <MessageSquare className="w-5 h-5" />}
                {recentClassModal === "trainer-pdf" && <BookOpen className="w-5 h-5" />}
                <h2 className="text-base sm:text-lg font-semibold">
                  {recentClassModal === "record" && "Record class"}
                  {recentClassModal === "pdf" && "Class PDF"}
                  {recentClassModal === "ppt" && "PPT"}
                  {recentClassModal === "assignment" && "Assignment"}
                  {recentClassModal === "feedback" && "Feedback"}
                  {recentClassModal === "trainer-pdf" && "Trainer reference PDF"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRecentClassModal(null)}
                className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-5 sm:px-6 pt-3 text-xs sm:text-sm text-gray-600">
              Select a course
            </p>
            <div className="p-5 sm:p-6 grid grid-cols-2 gap-3 sm:gap-4">
              {RECENT_CLASS_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setRecentClassModal(null)}
                  className={`rounded-xl shadow-sm border border-white/20 overflow-hidden text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br ${card.gradient} p-4 text-white`}
                >
                  <span className="text-sm sm:text-base font-semibold line-clamp-1">
                    {card.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming / Current class popup */}
      {upcomingClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setUpcomingClassModal(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#00448a] to-[#26ebe5] text-white">
              <div className="flex items-center gap-2">
                {upcomingClassModal === "live" && <Radio className="w-5 h-5" />}
                {upcomingClassModal === "pdf" && <FileText className="w-5 h-5" />}
                {upcomingClassModal === "ppt" && <Presentation className="w-5 h-5" />}
                <h2 className="text-base sm:text-lg font-semibold">
                  {upcomingClassModal === "live" && "Live class"}
                  {upcomingClassModal === "pdf" && "PDF"}
                  {upcomingClassModal === "ppt" && "PPT"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setUpcomingClassModal(null)}
                className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-5 sm:px-6 pt-3 text-xs sm:text-sm text-gray-600">
              Select a course
            </p>
            <div className="p-5 sm:p-6 grid grid-cols-2 gap-3 sm:gap-4">
              {RECENT_CLASS_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setUpcomingClassModal(null)}
                  className={`rounded-xl shadow-sm border border-white/20 overflow-hidden text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br ${card.gradient} p-4 text-white`}
                >
                  <span className="text-sm sm:text-base font-semibold line-clamp-1">
                    {card.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

