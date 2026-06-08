"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import CheckAuth from "../../../../lib/CheckAuth";
import { getProgramBySlug } from "../../../../lib/crtProgramsData";
import { createSlug } from "../../../../lib/urlUtils";
import { db, auth, firestoreHelpers } from "../../../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";

function programFromCrtDoc(id, data) {
  if (!data) return null;
  return { id, title: data.name || id };
}

export default function CRTExamsPage() {
  const params = useParams();
  const slug = params?.slug;
  const staticProgram = slug ? getProgramBySlug(slug) : null;
  const [firestoreProgram, setFirestoreProgram] = useState(null);
  const program = staticProgram || firestoreProgram;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]); // { courseId, courseTitle, assignmentId, title, durationMinutes, questionCount, submission? }

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!slug || staticProgram) {
      setFirestoreProgram(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ref = firestoreHelpers.doc(db, "crt", slug);
        const snap = await firestoreHelpers.getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          setFirestoreProgram(programFromCrtDoc(snap.id, snap.data()));
          return;
        }
        const crtSnap = await firestoreHelpers.getDocs(firestoreHelpers.collection(db, "crt"));
        if (cancelled) return;
        const found = crtSnap.docs.find((d) => createSlug(d.data().name || "") === slug);
        setFirestoreProgram(found ? programFromCrtDoc(found.id, found.data()) : null);
      } catch (_) {
        if (!cancelled) setFirestoreProgram(null);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, staticProgram]);

  useEffect(() => {
    if (!slug || !program) {
      setLoading(false);
      setTests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const crtSnap = await getDocs(collection(db, "crt"));
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
          setTests([]);
          return;
        }
        const testsRef = collection(db, "crt", resolvedCrtId, "tests");
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
              const subRef = collection(db, "crt", resolvedCrtId, "tests", testDoc.id, "submissions");
              const q = query(subRef, where("userId", "==", uid));
              const subSnap = await getDocs(q);
              if (!subSnap.empty) {
                const subDoc = subSnap.docs[0];
                submission = {
                  id: subDoc.id,
                  ...subDoc.data(),
                  submittedAt: subDoc.data().submittedAt?.toDate?.() || new Date(),
                };
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
        if (!cancelled) setTests(flatTests);
      } catch (e) {
        if (!cancelled) setTests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, program?.title, program, user?.uid]);

  if (!program) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Programme not found
          </h1>
          <Link
            href="/crt"
            className="text-[#00448a] font-semibold hover:underline"
          >
            ← Back to CRT Programmes
          </Link>
        </div>
      </CheckAuth>
    );
  }


  return (
    <CheckAuth>
      <div className="min-h-screen bg-slate-50 pt-16 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-2">
          <Link
            href={`/crt/${slug}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-[#00448a] font-medium text-sm mb-6 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to {program.title}
          </Link>

          <div className="rounded-2xl border border-violet-200/80 bg-white shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-violet-700 to-violet-600 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <AcademicCapIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                  CRT Full Length Tests
                </p>
                <h1 className="font-bold text-white text-lg">
                  {program.title} – Exams
                </h1>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {loading ? (
                <p className="text-slate-500 py-8 text-center">
                  Loading tests…
                </p>
              ) : tests.length === 0 ? (
                <p className="text-slate-500 py-8 text-center">
                  No exams for this programme yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {tests.map((test) => {
                    const isSubmitted = !!test.submission;
                    const score =
                      typeof test.submission?.autoScore === "number"
                        ? test.submission.autoScore
                        : (typeof test.submission?.score === "number" ? test.submission.score : null);
                    const testUrl = `/crt/${slug}/exams/${test.testId}`;

                    return (
                      <li
                        key={test.testId}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 hover:border-slate-300 transition-all duration-200 overflow-hidden"
                      >
                        <Link
                          href={testUrl}
                          className="group flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {test.title}
                              </h3>
                              <span className="inline-flex rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 text-xs font-medium">
                                CRT Full Length Test
                              </span>
                              {isSubmitted && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-medium">
                                  <CheckBadgeIcon className="w-3.5 h-3.5" />
                                  Submitted
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <ClockIcon className="w-4 h-4 text-slate-400" />
                                {test.durationMinutes
                                  ? `${test.durationMinutes} min`
                                  : "—"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <DocumentTextIcon className="w-4 h-4 text-slate-400" />
                                {test.questionCount} questions
                              </span>
                              {isSubmitted && score !== null && (
                                <span className="font-medium text-violet-700">
                                  Marks: {score}%
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 group-hover:text-violet-800 shrink-0">
                            {isSubmitted ? "View result" : "Start test"}
                            <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </CheckAuth>
  );
}
