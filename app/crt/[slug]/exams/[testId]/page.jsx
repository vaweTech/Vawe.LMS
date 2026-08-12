"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import CheckAuth from "../../../../../lib/CheckAuth";
import { getProgramBySlug } from "../../../../../lib/crtProgramsData";
import { createSlug } from "../../../../../lib/urlUtils";
import { db, auth, firestoreHelpers } from "../../../../../lib/firebase";
import { isCrtStudentRole } from "../../../../../lib/studentRole";
import { getDoc, getDocs, doc, collection, query, where } from "firebase/firestore";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckBadgeIcon,
  ListBulletIcon,
} from "@heroicons/react/24/solid";

function programFromCrtDoc(id, data) {
  if (!data) return null;
  return { id, title: data.name || id };
}

// Flatten sections into list of { sectionTitle, question, globalIndex }
function flattenQuestions(sections) {
  if (!Array.isArray(sections)) return [];
  const out = [];
  let globalIndex = 0;
  for (const section of sections) {
    const questions = Array.isArray(section.questions) ? section.questions : [];
    const sectionTitle = section.title || section.name || "";
    for (let i = 0; i < questions.length; i++) {
      out.push({
        sectionTitle,
        question: questions[i],
        globalIndex: globalIndex++,
      });
    }
  }
  return out;
}

// Group flattened list by section for sidebar: { sectionTitle, indices: number[] }
function groupBySection(questionsList) {
  const map = new Map();
  for (let i = 0; i < questionsList.length; i++) {
    const title = questionsList[i].sectionTitle || "Questions";
    if (!map.has(title)) map.set(title, []);
    map.get(title).push(i);
  }
  return Array.from(map.entries()).map(([sectionTitle, indices]) => ({ sectionTitle, indices }));
}

// Check if user answer is correct for one question
function isAnswerCorrect(question, userAnswer) {
  const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];
  const isMultiple = question.isMultiple === true;
  if (isMultiple) {
    const userSet = new Set(Array.isArray(userAnswer) ? userAnswer : []);
    const correctSet = new Set(correctAnswers);
    return userSet.size === correctSet.size && [...userSet].every((x) => correctSet.has(x));
  }
  const userSingle = typeof userAnswer === "number" ? userAnswer : (Array.isArray(userAnswer) ? userAnswer[0] : undefined);
  return correctAnswers.includes(userSingle);
}

export default function CRTExamTestPage() {
  const params = useParams();
  const slug = params?.slug;
  const testId = params?.testId;
  const staticProgram = slug ? getProgramBySlug(slug) : null;
  const [firestoreProgram, setFirestoreProgram] = useState(null);
  const program = staticProgram || firestoreProgram;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [test, setTest] = useState(null);
  const [crtId, setCrtId] = useState(null);
  const [answers, setAnswers] = useState({}); // { globalIndex: number | number[] }
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [visitedIndices, setVisitedIndices] = useState(() => new Set([0]));
  const [reviewFlags, setReviewFlags] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { score, total, percent } or existing submission
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(null);
  const [userBatch, setUserBatch] = useState(null); // { id, name } for submission
  const [user, setUser] = useState(null);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [roleCheckDone, setRoleCheckDone] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setHasCourseAccess(false);
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
        let studentData = studentDirectSnap.exists()
          ? studentDirectSnap.data()
          : null;
        if (!studentData) {
          const studentSnap = await getDocs(
            query(collection(db, "students"), where("uid", "==", user.uid))
          );
          if (!studentSnap.empty) studentData = studentSnap.docs[0].data();
        }
        const studentRole = studentData?.role;
        const isSuperAdmin = userRole === "superadmin";
        const isCrtStudent =
          isCrtStudentRole(userRole) ||
          isCrtStudentRole(studentRole) ||
          studentData?.isCrt === true;
        const isCrtTrainer =
          userRole === "crtTrainer" || studentRole === "crtTrainer";
        setHasCourseAccess(Boolean(isSuperAdmin || isCrtStudent || isCrtTrainer));
      } catch (_) {
        if (!cancelled) setHasCourseAccess(false);
      } finally {
        if (!cancelled) setRoleCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    if (!slug || !testId || !program) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const crtSnap = await firestoreHelpers.getDocs(firestoreHelpers.collection(db, "crt"));
        let resolvedCrtId = null;
        for (const crtDoc of crtSnap.docs) {
          const data = crtDoc.data();
          const matchesProgram =
            crtDoc.id === slug ||
            (data.name && createSlug(data.name) === slug) ||
            (data.name && data.name === program.title);
          if (!matchesProgram) continue;
          resolvedCrtId = crtDoc.id;
          break;
        }
        if (!resolvedCrtId || cancelled) {
          setError("Programme not found");
          return;
        }
        setCrtId(resolvedCrtId);
        const testRef = firestoreHelpers.doc(db, "crt", resolvedCrtId, "tests", testId);
        const testSnap = await firestoreHelpers.getDoc(testRef);
        if (cancelled) return;
        if (!testSnap.exists()) {
          setError("Test not found");
          return;
        }
        const t = testSnap.data();
        setTest({
          id: testSnap.id,
          name: t.name || t.title || "CRT Full Length Test",
          title: t.title || t.name || "CRT Full Length Test",
          durationMinutes: t.durationMinutes ?? t.duration ?? 0,
          sections: Array.isArray(t.sections) ? t.sections : [],
        });
        const uid = auth.currentUser?.uid;
        if (uid) {
          const subRef = firestoreHelpers.collection(db, "crt", resolvedCrtId, "tests", testId, "submissions");
          const q = firestoreHelpers.query(subRef, firestoreHelpers.where("userId", "==", uid));
          const subSnap = await firestoreHelpers.getDocs(q);
          if (!subSnap.empty && !cancelled) {
            const subDoc = subSnap.docs[0];
            setExistingSubmission({ id: subDoc.id, ...subDoc.data() });
          }
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load test.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, testId, program?.title, program]);

  // Resolve current user's batch for this CRT (so submission can store batchId/batchName)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!crtId || !uid) {
      setUserBatch(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const batchesSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "crt", crtId, "batches")
        );
        for (const batchDoc of batchesSnap.docs) {
          if (cancelled) return;
          const q = firestoreHelpers.query(
            firestoreHelpers.collection(db, "crt", crtId, "batches", batchDoc.id, "students"),
            firestoreHelpers.where("studentId", "==", uid)
          );
          const studentSnap = await firestoreHelpers.getDocs(q);
          if (!studentSnap.empty) {
            const batchData = batchDoc.data();
            setUserBatch({ id: batchDoc.id, name: batchData.name || batchDoc.id });
            return;
          }
        }
        setUserBatch(null);
      } catch (_) {
        setUserBatch(null);
      }
    })();
    return () => { cancelled = true; };
  }, [crtId]);

  const questionsList = useMemo(
    () => (test ? flattenQuestions(test.sections) : []),
    [test]
  );
  const totalQuestions = questionsList.length;
  const sectionGroups = groupBySection(questionsList);
  const safeIndex = totalQuestions > 0 ? Math.min(currentQuestionIndex, totalQuestions - 1) : 0;

  // Section-wise score breakdown for result dashboard (uses submitted answers or existingSubmission.answers)
  const sectionWiseScores = useMemo(() => {
    const resultAnswers = submitted ? answers : (existingSubmission?.answers ?? {});
    if (!questionsList.length || !sectionGroups.length) return [];
    return sectionGroups.map(({ sectionTitle, indices }) => {
      let correct = 0;
      for (const idx of indices) {
        const item = questionsList[idx];
        if (!item) continue;
        const userAnswer = resultAnswers[idx] ?? resultAnswers[String(idx)];
        if (isAnswerCorrect(item.question, userAnswer)) correct++;
      }
      const total = indices.length;
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { sectionTitle: sectionTitle || "Section", correct, total, percent };
    });
  }, [submitted, existingSubmission, answers, questionsList, sectionGroups]);

  // Overall performance summary for result view
  const performanceSummary = useMemo(() => {
    if (!totalQuestions || !questionsList.length) {
      return { attempted: 0, correct: 0, wrong: 0, notAnswered: totalQuestions || 0 };
    }
    const resultAnswers = submitted ? answers : (existingSubmission?.answers ?? {});
    let attempted = 0;
    let correct = 0;
    for (let i = 0; i < totalQuestions; i++) {
      const item = questionsList[i];
      if (!item) continue;
      const userAnswer = resultAnswers[i] ?? resultAnswers[String(i)];
      const hasAnswer =
        userAnswer !== undefined &&
        userAnswer !== null &&
        (!Array.isArray(userAnswer) || userAnswer.length > 0);
      if (hasAnswer) {
        attempted++;
        if (isAnswerCorrect(item.question, userAnswer)) correct++;
      }
    }
    const wrong = Math.max(0, attempted - correct);
    const notAnswered = Math.max(0, totalQuestions - attempted);
    return { attempted, correct, wrong, notAnswered };
  }, [submitted, existingSubmission, answers, questionsList, totalQuestions]);
  const currentItem = totalQuestions > 0 ? questionsList[safeIndex] : null;
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === totalQuestions - 1;

  const answeredProgress = useMemo(() => {
    let answered = 0;
    for (let i = 0; i < totalQuestions; i++) {
      const a = answers[i];
      if (a !== undefined && a !== null) {
        if (Array.isArray(a)) { if (a.length > 0) answered++; }
        else answered++;
      }
    }
    return { answered, total: totalQuestions };
  }, [totalQuestions, answers]);

  useEffect(() => {
    if (totalQuestions === 0) return;
    if (currentQuestionIndex >= totalQuestions) setCurrentQuestionIndex(totalQuestions - 1);
  }, [totalQuestions, currentQuestionIndex]);

  useEffect(() => {
    const minutes = test?.durationMinutes;
    if (!minutes || Number(minutes) <= 0) return;
    const endAt = Date.now() + Number(minutes) * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(0, endAt - Date.now());
      setTimeLeftMs(remaining);
      return remaining === 0;
    };
    tick();
    const id = setInterval(() => { if (tick()) clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [test?.durationMinutes]);

  const formatTime = (ms) => {
    if (ms == null) return null;
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return { h: pad(h), m: pad(m), s: pad(s) };
  };

  const toggleReview = useCallback((idx) => {
    setReviewFlags((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const clearAnswer = useCallback((idx) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }, []);

  const goToQuestion = useCallback((index) => {
    if (index < 0 || index >= totalQuestions) return;
    setCurrentQuestionIndex(index);
    setVisitedIndices((prev) => new Set([...prev, index]));
    setSidebarOpen(false);
  }, [totalQuestions]);

  const goPrev = useCallback(() => {
    if (!isFirst) goToQuestion(safeIndex - 1);
  }, [isFirst, safeIndex, goToQuestion]);

  const goNext = useCallback(() => {
    if (!isLast) goToQuestion(safeIndex + 1);
  }, [isLast, safeIndex, goToQuestion]);

  const setAnswer = useCallback((globalIndex, value) => {
    setAnswers((prev) => ({ ...prev, [globalIndex]: value }));
  }, []);

  const handleSubmitClick = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setShowConfirmDialog(false);
    if (!test || !crtId || submitting || totalQuestions === 0) return;
    setSubmitting(true);
    try {
      let correct = 0;
      for (let i = 0; i < questionsList.length; i++) {
        const { question } = questionsList[i];
        const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];
        const userAnswer = answers[i];
        const isMultiple = question.isMultiple === true;
        if (isMultiple) {
          const userSet = new Set(Array.isArray(userAnswer) ? userAnswer : []);
          const correctSet = new Set(correctAnswers);
          if (userSet.size === correctSet.size && [...userSet].every((x) => correctSet.has(x))) correct++;
        } else {
          const userSingle = typeof userAnswer === "number" ? userAnswer : (Array.isArray(userAnswer) ? userAnswer[0] : undefined);
          if (correctAnswers.includes(userSingle)) correct++;
        }
      }
      const percent = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
      setSubmitted({ score: correct, total: totalQuestions, percent });
      const uid = auth.currentUser?.uid;
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || "";
      if (uid) {
        const subRef = firestoreHelpers.collection(db, "crt", crtId, "tests", testId, "submissions");
        await firestoreHelpers.addDoc(subRef, {
          userId: uid,
          userName,
          testId,
          testName: test.name || test.title,
          crtId,
          batchId: userBatch?.id || null,
          batchName: userBatch?.name || null,
          answers: { ...answers },
          score: correct,
          total: totalQuestions,
          autoScore: percent,
          submittedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [test, crtId, testId, answers, questionsList, totalQuestions, submitting, userBatch]);

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

  if (loading) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          <div className="flex items-center gap-2 text-slate-600">
            <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
            <span>Loading test…</span>
          </div>
          <Link href={`/crt/${slug}/exams`} className="mt-4 text-[#00448a] text-sm hover:underline">
            Back to exams
          </Link>
        </div>
      </CheckAuth>
    );
  }

  if (error) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          <h1 className="text-xl font-bold text-slate-800 mb-2">{error}</h1>
          <Link href={`/crt/${slug}/exams`} className="text-[#00448a] font-semibold hover:underline">
            ← Back to exams
          </Link>
        </div>
      </CheckAuth>
    );
  }

  if (!roleCheckDone) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          <div className="flex items-center gap-2 text-slate-600">
            <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
            <span>Checking access...</span>
          </div>
        </div>
      </CheckAuth>
    );
  }

  if (!hasCourseAccess) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-slate-50 pt-20 flex flex-col items-center justify-center px-4">
          <h1 className="text-xl font-bold text-red-600 mb-2">Access denied</h1>
          <p className="text-slate-600 mb-4">You do not have access to this CRT exam.</p>
          <Link href={`/crt/${slug}/exams`} className="text-[#00448a] font-semibold hover:underline">
            ← Back to exams
          </Link>
        </div>
      </CheckAuth>
    );
  }

  const showResult = submitted || existingSubmission;
  const resultScore = submitted?.percent ?? existingSubmission?.autoScore ?? existingSubmission?.score;
  const resultLabel = existingSubmission && !submitted ? "Your previous submission" : "Your score";

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 text-gray-800 pt-4 sm:pt-6 pb-8">
        <div className="mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="mb-6">
            <Link
              href={`/crt/${slug}/exams`}
              className="inline-flex items-center gap-2 text-cyan-600 hover:text-cyan-700 font-medium"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to exams
            </Link>
          </div>

          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{test?.name || test?.title}</h1>
            <span className="px-2 py-1 text-xs rounded-full bg-violet-100 text-violet-800 font-medium">
              CRT Full Length Test
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
            <span className="inline-flex items-center gap-1">
              <DocumentTextIcon className="w-4 h-4" />
              {totalQuestions} questions
            </span>
            {test?.durationMinutes > 0 && (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                {test.durationMinutes} min
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!showResult && totalQuestions > 0 && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  Progress: {answeredProgress.answered} of {answeredProgress.total} questions answered
                </span>
                <span className="text-sm text-blue-600">
                  {answeredProgress.total > 0 ? Math.round((answeredProgress.answered / answeredProgress.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${answeredProgress.total > 0 ? (answeredProgress.answered / answeredProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

            <div className={showResult ? "" : "grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6"}>
              {showResult ? (
                <div className="max-w-2xl mx-auto space-y-6">
                  {/* Overall score card */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 sm:p-12 text-center">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-green-100 text-green-800 px-4 py-3 mb-4">
                      <CheckBadgeIcon className="w-6 h-6" />
                      <span className="font-semibold">{resultLabel}</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                      {typeof resultScore === "number" ? `${resultScore}%` : resultScore}
                    </p>
                    {(submitted || existingSubmission) && (
                      <p className="text-gray-600 mt-1">
                        {submitted?.score ?? existingSubmission?.score ?? 0} / {submitted?.total ?? existingSubmission?.total ?? totalQuestions} correct
                      </p>
                    )}
                    {/* Performance summary */}
                    {totalQuestions > 0 && (
                      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                          <p className="text-xs text-slate-500">Attempted</p>
                          <p className="text-base font-semibold text-slate-900">
                            {performanceSummary.attempted}
                          </p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                          <p className="text-xs text-emerald-700">Correct</p>
                          <p className="text-base font-semibold text-emerald-800">
                            {performanceSummary.correct}
                          </p>
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-xs text-red-700">Incorrect</p>
                          <p className="text-base font-semibold text-red-800">
                            {performanceSummary.wrong}
                          </p>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <p className="text-xs text-amber-700">Not Answered</p>
                          <p className="text-base font-semibold text-amber-800">
                            {performanceSummary.notAnswered}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detailed score card – section-wise + total */}
                  {sectionWiseScores.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50/80">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <DocumentTextIcon className="w-5 h-5 text-cyan-600" />
                          Detailed Score by Section
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Section-wise breakdown and total marks</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Section</th>
                              <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Score</th>
                              <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Total</th>
                              <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sectionWiseScores.map((row, i) => (
                              <tr key={row.sectionTitle + i} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="px-4 sm:px-6 py-3 font-medium text-gray-800">{row.sectionTitle}</td>
                                <td className="px-4 sm:px-6 py-3 text-center text-cyan-700 font-semibold">{row.correct}</td>
                                <td className="px-4 sm:px-6 py-3 text-center text-gray-600">{row.total}</td>
                                <td className="px-4 sm:px-6 py-3 text-right">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    row.percent >= 70 ? "bg-green-100 text-green-800" :
                                    row.percent >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                  }`}>
                                    {row.percent}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-cyan-50/80 border-t-2 border-cyan-200 font-semibold">
                              <td className="px-4 sm:px-6 py-3 text-gray-800">Total</td>
                              <td className="px-4 sm:px-6 py-3 text-center text-cyan-700">
                                {sectionWiseScores.reduce((s, r) => s + r.correct, 0)}
                              </td>
                              <td className="px-4 sm:px-6 py-3 text-center text-gray-700">
                                {sectionWiseScores.reduce((s, r) => s + r.total, 0)}
                              </td>
                              <td className="px-4 sm:px-6 py-3 text-right">
                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-800 text-sm font-bold">
                                  {totalQuestions > 0
                                    ? Math.round((sectionWiseScores.reduce((s, r) => s + r.correct, 0) / totalQuestions) * 100)
                                    : 0}%
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <Link
                      href={`/crt/${slug}/exams`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700"
                    >
                      <ArrowLeftIcon className="w-4 h-4" />
                      Back to exams
                    </Link>
                  </div>
                </div>
              ) : totalQuestions === 0 ? (
                <p className="text-gray-500 text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">No questions in this test.</p>
              ) : (
                <>
                  {sidebarOpen && (
                    <div
                      className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                      onClick={() => setSidebarOpen(false)}
                      aria-hidden
                    />
                  )}
                  <aside
                    className={`lg:col-span-1 order-1 lg:order-2 z-50 ${
                      sidebarOpen ? "fixed inset-y-0 right-0 w-72 max-w-[85vw] lg:relative lg:inset-auto lg:w-auto block" : "hidden lg:block"
                    }`}
                  >
                    <div className="sticky top-2 sm:top-24">
                      <div className="w-full bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-lg p-3 sm:p-4">
                        {timeLeftMs !== null && (
                          <div className="mb-4">
                            <div className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">Time Left</div>
                            {(() => {
                              const t = formatTime(timeLeftMs);
                              if (!t) return null;
                              return (
                                <div className="flex items-center gap-1.5 sm:gap-2 text-center">
                                  <div className="flex-1 p-1.5 sm:p-2 rounded bg-gray-100 font-semibold text-xs sm:text-sm">{t.h}</div>
                                  <span className="font-bold">:</span>
                                  <div className="flex-1 p-1.5 sm:p-2 rounded bg-gray-100 font-semibold text-xs sm:text-sm">{t.m}</div>
                                  <span className="font-bold">:</span>
                                  <div className="flex-1 p-1.5 sm:p-2 rounded bg-gray-100 font-semibold text-xs sm:text-sm">{t.s}</div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <div className="mb-3">
                          <div className="text-xs sm:text-sm font-semibold text-gray-800 mb-2 flex items-center justify-between">
                            <span>Questions</span>
                            <button
                              type="button"
                              onClick={() => setSidebarOpen(false)}
                              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                              aria-label="Close"
                            >
                              ×
                            </button>
                          </div>
                          <div className="max-h-[50vh] overflow-y-auto space-y-3">
                            {sectionGroups.map(({ sectionTitle, indices }) => {
                              const sectionLabel = sectionTitle || "Section";
                              const firstIdx = indices[0];
                              const isSectionActive = indices.includes(safeIndex);
                              const sectionAnswered = indices.filter((idx) => {
                                const a = answers[idx];
                                return a !== undefined && a !== null && (Array.isArray(a) ? a.length > 0 : true);
                              }).length;
                              return (
                                <div
                                  key={sectionLabel + firstIdx}
                                  className={`rounded-lg border transition-colors ${
                                    isSectionActive ? "border-cyan-300 bg-cyan-50/60" : "border-gray-200 bg-gray-50/50 hover:border-cyan-200 hover:bg-cyan-50/30"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => { goToQuestion(firstIdx); setSidebarOpen(false); }}
                                    className="w-full text-left px-2.5 py-2 flex items-center justify-between gap-2 rounded-t-lg hover:bg-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-inset"
                                    aria-label={`Go to section: ${sectionLabel}, questions ${indices[0] + 1}–${indices[indices.length - 1] + 1}`}
                                  >
                                    <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider truncate flex-1">
                                      {sectionLabel}
                                    </span>
                                    <span className="text-[10px] sm:text-xs text-gray-500 shrink-0 tabular-nums">
                                      Q{indices[0] + 1}–{indices[indices.length - 1] + 1} · {sectionAnswered}/{indices.length}
                                    </span>
                                  </button>
                                  <div className="px-2 pb-2 pt-0.5">
                                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                                      {indices.map((idx) => {
                                        const isCurrent = idx === safeIndex;
                                        const answered = answers[idx] !== undefined &&
                                          (Array.isArray(answers[idx]) ? answers[idx].length > 0 : true);
                                        const isVisited = visitedIndices.has(idx);
                                        const isMarked = reviewFlags[idx];
                                        let cls = "bg-gray-200 text-gray-800";
                                        if (isVisited && !answered && !isMarked) cls = "bg-red-500 text-white";
                                        if (answered) cls = "bg-green-500 text-white";
                                        if (isMarked) cls = "bg-purple-500 text-white";
                                        if (isCurrent) cls = "bg-cyan-600 text-white";
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => { goToQuestion(idx); setSidebarOpen(false); }}
                                            className={`${cls} rounded-md text-[11px] sm:text-xs font-semibold py-1.5 px-1 flex items-center justify-center hover:ring-2 hover:ring-offset-1 hover:ring-cyan-400 transition-shadow`}
                                            title={`Question ${idx + 1}`}
                                            aria-label={`Go to question ${idx + 1}`}
                                          >
                                            {idx + 1}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-cyan-600 inline-block rounded" /> Current</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-300 inline-block rounded" /> Not Attempted</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 inline-block rounded" /> Answered</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 inline-block rounded" /> Not Answered</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-purple-500 inline-block rounded" /> Marked</div>
                        </div>
                      </div>
                    </div>
                  </aside>

                  <div className="lg:col-span-4 order-2 lg:order-1">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 lg:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <button
                          type="button"
                          onClick={() => setSidebarOpen(true)}
                          className="lg:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                        >
                          <ListBulletIcon className="w-4 h-4" />
                          Questions ({safeIndex + 1} / {totalQuestions})
                        </button>
                        <p className="text-sm text-gray-500 ml-auto">
                          Question <span className="font-semibold text-gray-700">{safeIndex + 1}</span> of{" "}
                          <span className="font-semibold text-gray-700">{totalQuestions}</span>
                        </p>
                      </div>

                      {currentItem && (
                        <div className="mb-6">
                          {currentItem.sectionTitle && (
                            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wider mb-3">
                              {currentItem.sectionTitle}
                            </p>
                          )}
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Question {safeIndex + 1}</h3>
                          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-6">
                            {currentItem.question.text || "Question"}
                          </p>
                          {currentItem.question.isMultiple && (
                            <div className="mb-4 p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-xs sm:text-sm text-amber-800 font-medium flex items-center gap-2">
                                Select all correct answers (multiple choice)
                              </p>
                            </div>
                          )}
                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-800 mb-2 text-sm sm:text-base">Options:</h4>
                            {(Array.isArray(currentItem.question.options) ? currentItem.question.options : []).map((opt, optIdx) => {
                              const label = opt ?? `Option ${optIdx + 1}`;
                              const isMultiple = currentItem.question.isMultiple === true;
                              const value = answers[currentItem.globalIndex];
                              const isSelected = isMultiple
                                ? (Array.isArray(value) && value.includes(optIdx))
                                : value === optIdx;
                              return (
                                <label
                                  key={optIdx}
                                  className={`block p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer ${
                                    isSelected ? "bg-cyan-50 border-cyan-400 shadow-sm" : "bg-white border-gray-300 hover:border-cyan-300 hover:bg-cyan-50"
                                  }`}
                                >
                                  <div className="flex items-center space-x-3 sm:space-x-4">
                                    <input
                                      type={isMultiple ? "checkbox" : "radio"}
                                      name={`q-${currentItem.globalIndex}`}
                                      checked={isSelected}
                                      onChange={() => {
                                        if (isMultiple) {
                                          const next = Array.isArray(value) ? [...value] : [];
                                          const i = next.indexOf(optIdx);
                                          if (i >= 0) next.splice(i, 1);
                                          else next.push(optIdx);
                                          next.sort((a, b) => a - b);
                                          setAnswer(currentItem.globalIndex, next);
                                        } else {
                                          setAnswer(currentItem.globalIndex, optIdx);
                                        }
                                      }}
                                      className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 focus:ring-cyan-500 focus:ring-2"
                                    />
                                    <span className="text-gray-700 font-medium flex-1 text-sm sm:text-base">{String.fromCharCode(65 + optIdx)}. {label || "(empty option)"}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => toggleReview(safeIndex)}
                          className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border shadow ${
                            reviewFlags[safeIndex] ? "bg-purple-600 text-white border-purple-600" : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"
                          }`}
                        >
                          {reviewFlags[safeIndex] ? "Unmark Review" : "Mark for Review"}
                        </button>
                        <button
                          type="button"
                          onClick={() => clearAnswer(safeIndex)}
                          className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border bg-white text-red-700 border-red-300 hover:bg-red-50"
                        >
                          Clear
                        </button>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={goPrev}
                            disabled={isFirst}
                            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${
                              isFirst ? "bg-gray-200 text-gray-500 border-gray-300" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            Previous
                          </button>
                          {!isLast ? (
                            <button
                              type="button"
                              onClick={goNext}
                              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium bg-cyan-600 text-white border border-cyan-600 hover:bg-cyan-700"
                            >
                              Next
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSubmitClick}
                              disabled={submitting}
                              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {submitting ? "Submitting…" : "Submit test"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

          {/* Submit confirmation dialog */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-medium text-gray-900">Confirm Submission</h3>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    Once you submit this test, you cannot edit your answers.
                  </p>
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Questions Answered: {answeredProgress.answered} out of {answeredProgress.total}
                      </span>
                      <span className="text-sm text-gray-600">
                        {answeredProgress.total > 0 ? Math.round((answeredProgress.answered / answeredProgress.total) * 100) : 0}% Complete
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${answeredProgress.total > 0 ? (answeredProgress.answered / answeredProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-4">Are you sure you want to submit your test?</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowConfirmDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-md hover:bg-cyan-700 disabled:bg-gray-400"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </CheckAuth>
  );
}
