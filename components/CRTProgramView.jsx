"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, ArrowLeft, User, BookOpen } from "lucide-react";
import { db } from "../lib/firebase";
import { createSlug } from "../lib/urlUtils";
import { collection, getDocs, getDoc, doc, onSnapshot } from "firebase/firestore";
import MyCrtProgressCard, { useMyCrtEnrollments } from "./crt/MyCrtProgress";
import MyClassPanels from "./crt/MyClassPanels";
import { crtCourseUrlSegment, isCourseVisibleToAnyBatch } from "../lib/crtCourseFork";

export default function CRTProgramView({ user, profile, setProfile, showBackToDashboard, studentDocId }) {
  const [selectedCrtId, setSelectedCrtId] = useState(null);
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

  const { enrollments, loading: loadingEnrollments } = useMyCrtEnrollments(user);

  useEffect(() => {
    setAssignedCrtIds(enrollments.map((e) => e.crtId));
    if (enrollments.length > 0) {
      setSelectedCrtId((prev) => prev ?? enrollments[0].crtId);
    }
  }, [enrollments]);

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
  const classEnrollment = enrollments.find((e) => e.crtId === selectedCrtId) || enrollments[0] || null;
  const selectedBatchIds = (enrollments.find((e) => e.crtId === selectedCrtId)?.batches || []).map((b) => b.batchId);
  const visibleCourses = assignedCrtIds.includes(selectedCrtId)
    ? coursesWithProgress.filter((c) => isCourseVisibleToAnyBatch(c, selectedBatchIds))
    : coursesWithProgress.filter((c) => !c.forkedFromCourseId);

  const displayName =
    profile?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Student";
  const email = profile?.email || user?.email || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdc377]/30 via-[#26ebe5]/20 to-[#00448a]/10 px-3 py-4 sm:p-6 lg:p-8 2xl:p-10">
      <div className="w-full max-w-6xl xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5 sm:mb-8 lg:mb-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">CRT Dashboard</h1>
          {showBackToDashboard && (
            <Link
              href="/dashboard"
              className="inline-flex items-center text-xs sm:text-sm bg-white/90 border border-gray-200 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] items-start">
          {/* Left column: profile + classes (two columns on tablet, sidebar on laptop) */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-1">
            {/* Profile (dashboard theme) */}
            <div className="md:col-span-2 lg:col-span-1 border border-black bg-white/95 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl">
              <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-16 lg:h-16 xl:w-20 xl:h-20 shrink-0 flex items-center justify-center rounded-full border-4 border-black shadow-lg bg-white/20">
                    <User className="w-7 h-7 sm:w-10 sm:h-10 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-black" />
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

            <MyClassPanels user={user} enrollment={classEnrollment} />
          </div>

          {/* Right column: CRT programs + courses */}
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {loadingEnrollments ? (
              <div className="rounded-2xl border border-gray-200 bg-white/90 p-5 text-sm text-gray-500">
                Finding your programme…
              </div>
            ) : enrollments.length > 0 ? (
              enrollments.map((e) => <MyCrtProgressCard key={e.crtId} user={user} enrollment={e} />)
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                You are not assigned to a CRT programme or batch yet. Contact your placement coordinator.
              </div>
            )}

            {/* CRT Programs heading */}
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-[#00448a]" />
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
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3">
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
                      <div className="bg-gradient-to-r from-[#00448a] to-[#f56c53] px-4 py-3 sm:p-4 text-white">
                        <h3 className="text-sm sm:text-base font-semibold line-clamp-2">
                          {crt.name || crt.title || crt.id}
                        </h3>
                      </div>
                      <div className="px-4 py-3 sm:p-4 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-gray-600">
                          {assignedCrtIds.includes(crt.id) ? (
                            <span className="font-semibold text-emerald-700">Your programme</span>
                          ) : (
                            "Program"
                          )}
                        </span>
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
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 break-words">
                  {selectedProgram?.name || selectedProgram?.title || selectedCrtId} Courses
                </h3>
                {loadingCourses ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00448a]" />
                    <span className="ml-2">Loading courses...</span>
                  </div>
                ) : visibleCourses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm font-medium">No courses in this program</p>
                    <p className="text-xs mt-1">Courses will appear when assigned by admin.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleCourses.map((course) => {
                      const { openedChapters = 0, totalChapters = 0, percentage = 0 } = course;
                      const title = course.title || course.name || "Untitled";
                      return (
                        <Link
                          key={course.id}
                          href={`/crt/${createSlug(selectedProgram?.name || selectedProgram?.title || selectedCrtId)}/courses/${crtCourseUrlSegment(course)}`}
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

    </div>
  );
}

