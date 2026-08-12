"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import CheckAuth from "../../../lib/CheckAuth";
import { firestoreHelpers } from "../../../lib/firebase";
import { createSlug } from "../../../lib/urlUtils";
import { db, auth } from "../../../lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { tenantSegments } from "@/lib/tenantPath";
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  ClockIcon,
  ChartBarIcon,
  CpuChipIcon,
  ChevronRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  BookOpenIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

function slugifyCourse(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function programFromCrtDoc(id, data) {
  if (!data) return null;
  const iconKey = data.iconKey === "cpu" ? "cpu" : "code";
  return {
    id,
    title: data.name || id,
    description: data.description || "",
    duration: data.duration || "12–16 weeks",
    image: data.image || "/LmsImg.jpg",
    iconKey,
    totalHours: typeof data.totalHours === "number" ? data.totalHours : 400,
    commonHours: typeof data.commonHours === "number" ? data.commonHours : 200,
    commonLabel: data.commonLabel || "Non-technical",
    commonCourses: Array.isArray(data.commonCourses) ? data.commonCourses : [],
    technicalHours: typeof data.technicalHours === "number" ? data.technicalHours : 200,
    technicalCourses: Array.isArray(data.technicalCourses) ? data.technicalCourses : [],
  };
}

export default function CRTProgramDetailPage() {
  const params = useParams();
  const slug = params?.slug;
  const [program, setProgram] = useState(null);
  const [programLoading, setProgramLoading] = useState(!!slug);

  useEffect(() => {
    if (!slug) {
      setProgramLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ref = firestoreHelpers.doc(db, ...tenantSegments(null, "crt"), slug);
        const snap = await firestoreHelpers.getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          setProgram(programFromCrtDoc(snap.id, snap.data()));
          return;
        }
        const crtSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, ...tenantSegments(null, "crt"))
        );
        if (cancelled) return;
        const found = crtSnap.docs.find(
          (d) => createSlug(d.data().name || "") === slug
        );
        setProgram(found ? programFromCrtDoc(found.id, found.data()) : null);
      } catch (_) {
        if (!cancelled) setProgram(null);
      } finally {
        if (!cancelled) setProgramLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const [imageError, setImageError] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0, percent: 0 });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsList, setExamsList] = useState([]); // { courseId, courseTitle, assignmentId, title, durationMinutes, questionCount, submission? }
  const [crtCoursesFromFirestore, setCrtCoursesFromFirestore] = useState([]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  // When program is from Firestore, fetch actual courses under this CRT and isNonTechnical from master course
  useEffect(() => {
    if (!program?.id) {
      setCrtCoursesFromFirestore([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const coursesRef = collection(
          db,
          ...tenantSegments(null, "crt"),
          program.id,
          "courses"
        );
        const snap = await getDocs(coursesRef);
        if (cancelled) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        for (const c of list) {
          if (c.sourceCourseId) {
            try {
              const masterSnap = await getDoc(
                doc(db, ...tenantSegments(null, "crtCourses"), c.sourceCourseId)
              );
              if (masterSnap.exists() && !cancelled) {
                c.isNonTechnical = masterSnap.data().isNonTechnical === true;
              }
            } catch (_) {}
          }
        }
        if (!cancelled) setCrtCoursesFromFirestore(list);
      } catch (_) {
        if (!cancelled) setCrtCoursesFromFirestore([]);
      }
    })();
    return () => { cancelled = true; };
  }, [program?.id]);

  useEffect(() => {
    if (!slug || !program || !user?.uid) {
      setAttendanceLoading(false);
      if (!user?.uid) setAttendanceStats({ total: 0, present: 0, percent: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setAttendanceLoading(true);
        const crtSnap = await getDocs(collection(db, ...tenantSegments(null, "crt")));
        let resolvedCrtId = null;
        const coursesList = [];
        for (const crtDoc of crtSnap.docs) {
          const data = crtDoc.data();
          const matchesProgram =
            crtDoc.id === slug ||
            (data.programId && data.programId === slug) ||
            (data.name && createSlug(data.name) === slug) ||
            (data.name && data.name === program.title);
          if (!matchesProgram) continue;
          resolvedCrtId = crtDoc.id;
          const coursesRef = collection(
            db,
            ...tenantSegments(null, "crt"),
            crtDoc.id,
            "courses"
          );
          const coursesSnap = await getDocs(coursesRef);
          coursesSnap.docs.forEach((c) => {
            coursesList.push({ id: c.id, ...c.data() });
          });
          break;
        }
        if (!resolvedCrtId || coursesList.length === 0 || cancelled) {
          if (!cancelled) setAttendanceStats({ total: 0, present: 0, percent: 0 });
          return;
        }
        const uid = user.uid;
        let studentDocId = uid;
        try {
          const directSnap = await getDoc(
            doc(db, ...tenantSegments(null, "students"), uid)
          );
          if (!directSnap.exists()) {
            const sq = query(
              collection(db, ...tenantSegments(null, "students")),
              where("uid", "==", uid)
            );
            const sSnap = await getDocs(sq);
            if (!sSnap.empty) studentDocId = sSnap.docs[0].id;
          }
        } catch (_) {}
        const attCol = collection(db, ...tenantSegments(null, "attendance"));
        let totalSessions = 0;
        let presentSessions = 0;
        for (const course of coursesList) {
          const trainerSnap = await getDocs(
            query(attCol, where("type", "==", "trainer"), where("courseId", "==", course.id))
          );
          const selfSnap = await getDocs(
            query(attCol, where("type", "==", "self"), where("courseId", "==", course.id), where("userId", "==", uid))
          );
          const trainerChapters = new Set();
          const trainerPresentChapters = new Set();
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
          totalSessions += totalChapters.size;
          presentSessions += presentChapters.size;
        }
        const percent = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;
        if (!cancelled) setAttendanceStats({ total: totalSessions, present: presentSessions, percent });
      } catch (e) {
        if (!cancelled) setAttendanceStats({ total: 0, present: 0, percent: 0 });
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, program?.title, program, user?.uid]);

  // Fetch CRT full-length tests from Firestore crt/{crtId}/tests
  useEffect(() => {
    if (!slug || !program) {
      setExamsLoading(false);
      setExamsList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setExamsLoading(true);
        const crtSnap = await getDocs(collection(db, ...tenantSegments(null, "crt")));
        let resolvedCrtId = null;
        for (const crtDoc of crtSnap.docs) {
          const data = crtDoc.data();
          const matchesProgram =
            crtDoc.id === slug ||
            (data.programId && data.programId === slug) ||
            (data.name && createSlug(data.name) === slug) ||
            (data.name && data.name === program.title);
          if (!matchesProgram) continue;
          resolvedCrtId = crtDoc.id;
          break;
        }
        if (!resolvedCrtId || cancelled) {
          setExamsList([]);
          return;
        }
        const testsRef = collection(
          db,
          ...tenantSegments(null, "crt"),
          resolvedCrtId,
          "tests"
        );
        const testsSnap = await getDocs(testsRef);
        if (cancelled) return;
        const uid = user?.uid;
        const flatTests = [];
        for (const testDoc of testsSnap.docs) {
          const t = testDoc.data();
          const title = t.name || t.title || "CRT Full Length Test";
          const durationMinutes = t.durationMinutes ?? t.duration ?? 0;
          const questionCount = typeof t.questionCount === "number"
            ? t.questionCount
            : (Array.isArray(t.sections)
              ? t.sections.reduce((acc, s) => acc + (Array.isArray(s.questions) ? s.questions.length : 0), 0)
              : 0);
          let submission = null;
          if (uid) {
            try {
              const subRef = collection(
                db,
                ...tenantSegments(null, "crt"),
                resolvedCrtId,
                "tests",
                testDoc.id,
                "submissions"
              );
              const q = query(subRef, where("userId", "==", uid));
              const subSnap = await getDocs(q);
              if (!subSnap.empty) {
                const subDoc = subSnap.docs[0];
                submission = { ...subDoc.data(), submittedAt: subDoc.data().submittedAt?.toDate?.() || new Date() };
              }
            } catch (_) {}
          }
          flatTests.push({
            testId: testDoc.id,
            title,
            durationMinutes,
            questionCount,
            submission,
          });
        }
        if (!cancelled) setExamsList(flatTests);
      } catch (_) {
        if (!cancelled) setExamsList([]);
      } finally {
        if (!cancelled) setExamsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, program?.title, program, user?.uid]);

  if (programLoading || (!program && slug)) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          {programLoading ? (
            <p className="text-slate-600">Loading programme...</p>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Programme not found</h1>
              <Link href="/crt" className="text-[#00448a] font-semibold hover:underline">
                ← Back to CRT Programmes
              </Link>
            </>
          )}
        </div>
      </CheckAuth>
    );
  }

  if (!program) return null;

  const totalHours = program.totalHours ?? 400;
  const commonHours = program.commonHours ?? 200;
  const technicalHours = program.technicalHours ?? 200;
  const commonLabel = program.commonLabel || "Non-technical";
  const commonCourseNames = program.commonCourses || [];
  const technicalCourseNames = program.technicalCourses || [];

  // When we have Firestore courses: common = in commonCourses list OR isNonTechnical from master; technical = rest
  const commonCourseDocs = crtCoursesFromFirestore.length > 0
    ? crtCoursesFromFirestore.filter(
        (c) =>
          c.isNonTechnical === true ||
          (program.commonCourses || []).includes(c.title)
      )
    : [];
  const technicalCourseDocs = crtCoursesFromFirestore.length > 0
    ? crtCoursesFromFirestore.filter(
        (c) => !commonCourseDocs.some((x) => x.id === c.id)
      )
    : [];
  const useFirestoreCourses = crtCoursesFromFirestore.length > 0;
  const allTechnicalCourseDocs = technicalCourseDocs;

  return (
    <CheckAuth>
      <div className="min-h-screen bg-slate-50 pt-16">
        {/* Hero – full bleed */}
        <header className="relative w-full mt-[-70px] min-h-[50vh] sm:min-h-[55vh] flex flex-col justify-end overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={imageError ? "/LmsImg.jpg" : program.image}
              alt={program.title}
              fill
              sizes="100vw"
              className="object-cover"
              priority
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
          </div>
          <div className="relative max-w-5xl mx-auto w-full px-4 sm:px-6 pb-12 sm:pb-16 pt-24">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
              <Link
                href="/crt"
                className="inline-flex items-center gap-2 text-white/90 hover:text-white font-medium text-sm transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                All CRT Programmes
              </Link>
              <Link
                href="/crtProgram"
                className="inline-flex items-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-2 text-white font-medium text-sm border border-white/30 transition-colors"
              >
                <ChartBarIcon className="w-4 h-4" />
                Go to Dashboard
              </Link>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white mb-4 border border-white/20">
              <AcademicCapIcon className="w-3.5 h-3.5" />
              {totalHours} hr programme
            </span>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-2"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              {program.title}
            </h1>
            <p className="flex items-center gap-2 text-white/90 text-sm sm:text-base font-medium">
              <ClockIcon className="w-4 h-4" />
              {program.duration}
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 pb-20">
          {/* Intro card */}
          <section className="bg-white rounded-2xl shadow-lg border border-slate-200/60 overflow-hidden mb-8">
            <div className="border-l-4 border-[#00448a] bg-slate-50/50 px-5 py-3 flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-[#00448a]" />
              <span className="text-sm font-semibold text-slate-700 uppercase tracking-wider">About this programme</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-base sm:text-lg p-6 sm:p-8 pt-5">
              {program.description}
            </p>
          </section>

          {/* Attendance summary */}
          <section className="mb-10 rounded-2xl border border-slate-200/60 bg-white shadow-lg overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                <UserGroupIcon className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-800 mb-1">Your attendance</h3>
                {attendanceLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : attendanceStats.total > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-blue-600 text-lg">{attendanceStats.present}</span>
                      <span className="text-slate-500"> / {attendanceStats.total} sessions</span>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {attendanceStats.percent}%
                      </span>
                    </p>
                    <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, attendanceStats.percent)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No attendance recorded yet for this programme</p>
                )}
              </div>
            </div>
          </section>

          {/* 400 hr breakdown – two columns */}
          <h2 className="text-slate-800 font-bold text-lg mb-4 flex items-center gap-2">
            <AcademicCapIcon className="w-5 h-5 text-[#00448a]" />
            Course structure
          </h2>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {/* Non-technical (common) block */}
            <section className="rounded-2xl shadow-lg border border-amber-200/80 bg-white overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-500 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <ChartBarIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-amber-100 text-xs font-semibold uppercase tracking-wider">{commonHours} hours</p>
                  <h2 className="font-bold text-white text-lg leading-tight">
                    {commonLabel}
                  </h2>
                </div>
              </div>
              <div className="p-4 sm:p-5 grid gap-2">
                {useFirestoreCourses
                  ? commonCourseDocs.map((c) => (
                      <Link
                        key={c.id}
                        href={`/crt/${slug}/courses/${createSlug(c.title || c.name || c.id)}`}
                        className="group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-amber-100 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-200 hover:shadow-sm transition-all duration-200"
                      >
                        <span className="font-medium text-slate-800">{c.title || c.name || c.id}</span>
                        <ChevronRightIcon className="w-5 h-5 text-amber-500 group-hover:text-amber-700 group-hover:translate-x-1 transition-all shrink-0" />
                      </Link>
                    ))
                  : commonCourseNames.map((name) => {
                      const courseSlug = slugifyCourse(name);
                      return (
                        <Link
                          key={name}
                          href={`/crt/${slug}/courses/${courseSlug}`}
                          className="group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-amber-100 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-200 hover:shadow-sm transition-all duration-200"
                        >
                          <span className="font-medium text-slate-800">{name}</span>
                          <ChevronRightIcon className="w-5 h-5 text-amber-500 group-hover:text-amber-700 group-hover:translate-x-1 transition-all shrink-0" />
                        </Link>
                      );
                    })}
              </div>
            </section>

            {/* Technical block */}
            <section className="rounded-2xl shadow-lg border border-pink-200/80 bg-white overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-5 bg-gradient-to-r from-pink-600 to-pink-500 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <CpuChipIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-pink-100 text-xs font-semibold uppercase tracking-wider">{technicalHours} hours</p>
                  <h2 className="font-bold text-white text-lg leading-tight">Technical</h2>
                </div>
              </div>
              <div className="p-4 sm:p-5 grid gap-2">
                {useFirestoreCourses
                  ? allTechnicalCourseDocs.map((c) => (
                      <Link
                        key={c.id}
                        href={`/crt/${slug}/courses/${createSlug(c.title || c.name || c.id)}`}
                        className="group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-pink-100 bg-pink-50/70 hover:bg-pink-100 hover:border-pink-200 hover:shadow-sm transition-all duration-200"
                      >
                        <span className="font-medium text-slate-800">{c.title || c.name || c.id}</span>
                        <ChevronRightIcon className="w-5 h-5 text-pink-500 group-hover:text-pink-700 group-hover:translate-x-1 transition-all shrink-0" />
                      </Link>
                    ))
                  : technicalCourseNames.map((name) => {
                      const courseSlug = slugifyCourse(name);
                      return (
                        <Link
                          key={name}
                          href={`/crt/${slug}/courses/${courseSlug}`}
                          className="group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-pink-100 bg-pink-50/70 hover:bg-pink-100 hover:border-pink-200 hover:shadow-sm transition-all duration-200"
                        >
                          <span className="font-medium text-slate-800">{name}</span>
                          <ChevronRightIcon className="w-5 h-5 text-pink-500 group-hover:text-pink-700 group-hover:translate-x-1 transition-all shrink-0" />
                        </Link>
                      );
                    })}
              </div>
            </section>
          </div>

          {/* CRT exams – full-width section */}
          <section className="mt-10 rounded-2xl shadow-lg border border-violet-200/80 bg-white overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="px-6 py-5 bg-gradient-to-r from-violet-700 to-violet-600 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <AcademicCapIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-violet-200 text-xs font-semibold uppercase tracking-wider">Full-length tests</p>
                  <h2 className="font-bold text-white text-lg leading-tight">CRT Exams</h2>
                </div>
              </div>
              <Link
                href={`/crt/${slug}/exams`}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-violet-700 px-4 py-2.5 text-sm font-semibold shadow-md hover:bg-violet-50 hover:shadow-lg transition-all duration-200"
              >
                View exams page
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
            {!examsLoading && examsList.length > 0 && (() => {
              const submittedCount = examsList.filter((t) => !!t.submission).length;
              const pendingCount = examsList.length - submittedCount;
              if (submittedCount === 0 && pendingCount === 0) return null;
              return (
                <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 sm:gap-5 border-b border-violet-100 bg-violet-50/50">
                  {submittedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
                      <CheckBadgeIcon className="w-4 h-4" />
                      {submittedCount} submitted
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 font-medium">
                      <ClockIcon className="w-4 h-4" />
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {examsLoading ? (
                <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-center py-10">
                  <div className="flex items-center gap-2 text-slate-500">
                    <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                    <span className="text-sm">Loading tests…</span>
                  </div>
                </div>
              ) : (() => {
                const pendingList = examsList.filter((t) => !t.submission);
                if (pendingList.length === 0) {
                  return (
                    <div className="sm:col-span-2 lg:col-span-3 py-10 px-4 text-center">
                      <p className="text-slate-600 font-medium">No pending assignments</p>
                      <p className="text-sm text-slate-500 mt-1">View the exams page to see all tests and results.</p>
                      <Link
                        href={`/crt/${slug}/exams`}
                        className="inline-flex items-center gap-2 mt-4 rounded-xl bg-violet-100 text-violet-700 px-4 py-2 text-sm font-semibold hover:bg-violet-200 transition-colors"
                      >
                        View exams page
                        <ChevronRightIcon className="w-4 h-4" />
                      </Link>
                    </div>
                  );
                }
                return pendingList.map((test) => (
                    <Link
                      key={test.testId}
                      href={`/crt/${slug}/exams/${test.testId}`}
                      className="group flex flex-col gap-3 p-5 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white hover:from-violet-100/80 hover:to-violet-50/50 hover:border-violet-200 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1 min-w-0">
                          {test.title}
                        </h3>
                        <ChevronRightIcon className="w-5 h-5 text-violet-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {test.durationMinutes ? `${test.durationMinutes} min` : "—"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100">
                          <DocumentTextIcon className="w-3.5 h-3.5" />
                          {test.questionCount} questions
                        </span>
                      </div>
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-medium">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Pending
                      </span>
                    </Link>
                ));
              })()}
            </div>
          </section>
        </main>
      </div>
    </CheckAuth>
  );
}
