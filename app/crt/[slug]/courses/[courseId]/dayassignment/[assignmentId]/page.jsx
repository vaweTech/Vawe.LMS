"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CheckAuth from "../../../../../../../lib/CheckAuth";
import { createSlug } from "../../../../../../../lib/urlUtils";
import { db, auth, firestoreHelpers } from "../../../../../../../lib/firebase";
import { mcqDb } from "../../../../../../../lib/firebaseMCQs";
import { isCrtStudentRole } from "../../../../../../../lib/studentRole";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";

function programFromCrtDoc(id, data) {
  if (!data) return null;
  return {
    id,
    title: data.name || id,
  };
}

function getDefaultStarter(language) {
  if (language === "java") {
    return `public class Main {\n  public static void main(String[] args) {\n    // Write your solution here\n    System.out.println("Hello, World!");\n  }\n}`;
  }
  if (language === "python") {
    return `# Write your solution here\nprint("Hello, World!")`;
  }
  if (language === "c") {
    return `#include <stdio.h>\nint main(){\n  // Write your solution here\n  printf("Hello, World!\\n");\n  return 0;\n}`;
  }
  if (language === "cpp") {
    return `#include <iostream>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  cout << "Hello, World!" << endl;\n  return 0;\n}`;
  }
  if (language === "javascript") {
    return `// Write your solution here\nconsole.log("Hello, World!");`;
  }
  return "";
}

function normalizeAnswer(answer) {
  if (Array.isArray(answer)) return [...answer].sort((a, b) => a - b);
  if (typeof answer === "number") return [answer];
  return [];
}

export default function CRTDayAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const programSlug = params?.slug;
  const courseSlug = params?.courseId;
  const assignmentId = params?.assignmentId;

  const [program, setProgram] = useState(null);
  const [course, setCourse] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [user, setUser] = useState(null);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [roleCheckDone, setRoleCheckDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [submission, setSubmission] = useState({
    mcqAnswers: {},
    codingSolution: "",
    language: "cpp",
  });
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [visitedMap, setVisitedMap] = useState({ 0: true });
  const [reviewFlags, setReviewFlags] = useState({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editorDark, setEditorDark] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

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
        const crtSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "crt")
        );
        if (cancelled) return;
        const found = crtSnap.docs.find(
          (d) => createSlug(d.data().name || "") === programSlug
        );
        setProgram(found ? programFromCrtDoc(found.id, found.data()) : null);
      } catch (_) {
        if (!cancelled) setProgram(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programSlug]);

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
    async function loadData() {
      if (!programSlug || !courseSlug || !assignmentId || !program) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let resolvedCourse = null;
        let resolvedCrtId = null;

        const crtSnap = await getDocs(collection(db, "crt"));
        for (const crtDoc of crtSnap.docs) {
          const data = crtDoc.data();
          const matchesProgram =
            crtDoc.id === programSlug ||
            (data.programId && data.programId === programSlug) ||
            (data.name && createSlug(data.name) === programSlug) ||
            (data.name && data.name === program.title);
          if (!matchesProgram) continue;

          resolvedCrtId = crtDoc.id;
          const coursesSnap = await getDocs(
            collection(db, "crt", crtDoc.id, "courses")
          );
          const found = coursesSnap.docs.find(
            (c) =>
              c.id === courseSlug ||
              createSlug(c.data().title || "") === courseSlug
          );
          if (found) {
            resolvedCourse = { id: found.id, ...found.data() };
            break;
          }
        }

        if (!resolvedCourse || !resolvedCrtId) {
          setCourse(null);
          setAssignment(null);
          return;
        }

        setCourse(resolvedCourse);

        const assignmentRef = doc(
          mcqDb,
          "copiedcourses",
          resolvedCourse.id,
          "assignments",
          assignmentId
        );
        const assignmentSnap = await getDoc(assignmentRef);

        if (!assignmentSnap.exists()) {
          setAssignment(null);
          return;
        }

        const assignmentData = { id: assignmentSnap.id, ...assignmentSnap.data() };
        setAssignment(assignmentData);

        if (user?.uid) {
          const submissionSnap = await getDocs(
            query(
              collection(
                mcqDb,
                "copiedcourses",
                resolvedCourse.id,
                "assignments",
                assignmentId,
                "submissions"
              ),
              where("studentId", "==", user.uid)
            )
          );

          if (!submissionSnap.empty) {
            const saved = {
              id: submissionSnap.docs[0].id,
              ...submissionSnap.docs[0].data(),
            };
            setExistingSubmission(saved);
            setSubmission({
              mcqAnswers: saved.mcqAnswers || {},
              codingSolution: saved.codingSolution || "",
              language: saved.language || "cpp",
            });
          } else {
            setExistingSubmission(null);
            setSubmission({
              mcqAnswers: {},
              codingSolution: "",
              language: "cpp",
            });
          }
        }
      } catch (error) {
        console.error("Failed to load CRT day assignment:", error);
        setCourse(null);
        setAssignment(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [programSlug, courseSlug, assignmentId, program, user?.uid]);

  const questions = useMemo(
    () => (Array.isArray(assignment?.questions) ? assignment.questions : []),
    [assignment?.questions]
  );
  const totalQuestions = questions.length;
  const safeActiveQuestion =
    totalQuestions > 0 ? Math.min(activeQuestion, totalQuestions - 1) : 0;
  const currentQuestion = totalQuestions > 0 ? questions[safeActiveQuestion] : null;

  useEffect(() => {
    if (totalQuestions === 0) {
      setActiveQuestion(0);
      return;
    }
    if (activeQuestion >= totalQuestions) {
      setActiveQuestion(totalQuestions - 1);
    }
  }, [activeQuestion, totalQuestions]);

  useEffect(() => {
    if (totalQuestions > 0) {
      setVisitedMap((prev) => ({ ...prev, [safeActiveQuestion]: true }));
    }
  }, [safeActiveQuestion, totalQuestions]);

  const answeredCount = useMemo(() => {
    if (!assignment) return 0;
    if (assignment.type === "coding") {
      return submission.codingSolution?.trim() ? questions.length || 1 : 0;
    }
    let count = 0;
    for (let i = 0; i < questions.length; i += 1) {
      const answer = submission.mcqAnswers?.[i];
      if (Array.isArray(answer) ? answer.length > 0 : answer !== undefined) {
        count += 1;
      }
    }
    return count;
  }, [assignment, questions, submission]);

  const handleOptionChange = (questionIndex, optionIndex, isMultiple) => {
    if (existingSubmission) return;
    setSubmission((prev) => {
      const current = prev.mcqAnswers?.[questionIndex];
      let nextAnswer;

      if (isMultiple) {
        const currentAnswers = Array.isArray(current) ? [...current] : [];
        const exists = currentAnswers.includes(optionIndex);
        nextAnswer = exists
          ? currentAnswers.filter((value) => value !== optionIndex)
          : [...currentAnswers, optionIndex].sort((a, b) => a - b);
      } else {
        nextAnswer = optionIndex;
      }

      return {
        ...prev,
        mcqAnswers: {
          ...prev.mcqAnswers,
          [questionIndex]: nextAnswer,
        },
      };
    });
  };

  const scrollToQuestion = useCallback(
    (index) => {
      if (index < 0 || index >= totalQuestions) return;
      setActiveQuestion(index);
      setVisitedMap((prev) => ({ ...prev, [index]: true }));
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [totalQuestions]
  );

  const toggleReview = useCallback((questionIndex) => {
    setReviewFlags((prev) => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
  }, []);

  const clearAnswer = useCallback(
    (questionIndex) => {
      if (existingSubmission) return;
      setSubmission((prev) => ({
        ...prev,
        mcqAnswers: {
          ...prev.mcqAnswers,
          [questionIndex]: Array.isArray(prev.mcqAnswers?.[questionIndex])
            ? []
            : undefined,
        },
      }));
    },
    [existingSubmission]
  );

  const handleLanguageChange = useCallback(
    (language) => {
      if (existingSubmission) return;
      setSubmission((prev) => ({
        ...prev,
        language,
        codingSolution:
          prev.codingSolution && prev.codingSolution.trim()
            ? prev.codingSolution
            : getDefaultStarter(language),
      }));
    },
    [existingSubmission]
  );

  const handleSubmit = async () => {
    if (!user?.uid || !course?.id || !assignment) return;

    try {
      setShowConfirmDialog(false);
      setSubmitting(true);

      let resultStatus = "submitted";
      let testSummary = null;

      if (assignment.type === "mcq") {
        let passCount = 0;
        for (let i = 0; i < questions.length; i += 1) {
          const question = questions[i] || {};
          const expected = normalizeAnswer(question.correctAnswers);
          const actual = normalizeAnswer(submission.mcqAnswers?.[i]);
          if (
            expected.length === actual.length &&
            expected.every((value, index) => value === actual[index])
          ) {
            passCount += 1;
          }
        }

        const totalCount = questions.length;
        const partialScore = passCount;
        const maxScore = totalCount;

        resultStatus =
          passCount === totalCount
            ? "success"
            : passCount > 0
              ? "partial"
              : "fail";

        testSummary = {
          passCount,
          totalCount,
          partialScore,
          maxScore,
        };
      }

      const baseData = {
        studentId: user.uid,
        studentName: user.displayName || user.email || "Anonymous",
        submittedAt: serverTimestamp(),
        resultStatus,
        testSummary,
        ...submission,
      };

      const autoScore = testSummary?.maxScore
        ? Math.round((testSummary.partialScore / testSummary.maxScore) * 100)
        : null;

      const submissionData =
        autoScore !== null ? { ...baseData, autoScore } : baseData;

      const submissionsCol = collection(
        mcqDb,
        "copiedcourses",
        course.id,
        "assignments",
        assignment.id,
        "submissions"
      );

      if (existingSubmission?.id) {
        await updateDoc(
          doc(
            mcqDb,
            "copiedcourses",
            course.id,
            "assignments",
            assignment.id,
            "submissions",
            existingSubmission.id
          ),
          submissionData
        );
      } else {
        await addDoc(submissionsCol, submissionData);
      }

      setExistingSubmission((prev) =>
        prev?.id ? { ...prev, ...submissionData } : { id: "saved", ...submissionData }
      );

      if (assignment.type === "mcq") {
        alert(`Assignment submitted. Score: ${autoScore ?? 0}%`);
      } else {
        alert("Assignment submitted.");
      }
    } catch (error) {
      console.error("Failed to submit CRT day assignment:", error);
      alert("Failed to submit assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const backHref = `/crt/${programSlug}/courses/${courseSlug}`;

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

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-2 text-cyan-700 hover:text-cyan-800 font-medium mb-6"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to course
          </button>

          {loading ? (
            <div className="rounded-2xl bg-white shadow border border-slate-200 p-8 text-slate-600">
              Loading assignment...
            </div>
          ) : !assignment ? (
            <div className="rounded-2xl bg-white shadow border border-slate-200 p-8 text-slate-600">
              Assignment not found.
            </div>
          ) : !roleCheckDone ? (
            <div className="rounded-2xl bg-white shadow border border-slate-200 p-8 text-slate-600">
              Checking access...
            </div>
          ) : !hasCourseAccess ? (
            <div className="rounded-2xl bg-white shadow border border-slate-200 p-8">
              <h1 className="text-xl font-bold text-red-600 mb-2">Access denied</h1>
              <p className="text-slate-600">
                You do not have access to this CRT assignment.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mb-2">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                    {assignment.title || "Day Assignment"}
                  </h1>
                  <span className="px-2 py-1 text-xs rounded-full bg-cyan-100 text-cyan-800">
                    {assignment.type === "coding" ? "Coding" : "MCQ"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    Day {assignment.day || 1}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DocumentTextIcon className="w-4 h-4" />
                    {totalQuestions} questions
                  </span>
                  <span>Course: {course?.title || courseSlug}</span>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      Progress: {answeredCount} of {totalQuestions} questions answered
                    </span>
                    <span className="text-sm text-blue-600">
                      {totalQuestions > 0
                        ? Math.round((answeredCount / totalQuestions) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          totalQuestions > 0
                            ? (answeredCount / totalQuestions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {existingSubmission && (
                  <div className="mt-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                      <p className="font-medium text-emerald-800">
                        Submitted successfully
                      </p>
                    </div>
                    {typeof existingSubmission.autoScore === "number" && (
                      <div className="text-sm font-semibold text-emerald-800">
                        Score: {existingSubmission.autoScore}%
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                  <div className="lg:col-span-4 order-2 lg:order-1">
                    {assignment.type === "mcq" ? (
                      <div>
                        <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6 text-cyan-600">
                          Multiple Choice Questions
                        </h2>

                        {currentQuestion && (
                          <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div>
                                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                                  Question {safeActiveQuestion + 1}
                                </h3>
                                <p className="text-sm sm:text-base text-gray-700 leading-6 sm:leading-relaxed">
                                  {currentQuestion.text ||
                                    currentQuestion.question ||
                                    "Question"}
                                </p>
                              </div>
                              {currentQuestion.isMultiple === true && (
                                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                                  Multiple answers
                                </span>
                              )}
                            </div>

                            <div className="space-y-3">
                              {(Array.isArray(currentQuestion.options)
                                ? currentQuestion.options
                                : []
                              ).map((option, optionIndex) => {
                                const currentAnswer =
                                  submission.mcqAnswers?.[safeActiveQuestion];
                                const isMultiple = currentQuestion.isMultiple === true;
                                const isSelected = isMultiple
                                  ? Array.isArray(currentAnswer) &&
                                    currentAnswer.includes(optionIndex)
                                  : currentAnswer === optionIndex;

                                const correctAnswers = Array.isArray(
                                  currentQuestion.correctAnswers
                                )
                                  ? currentQuestion.correctAnswers
                                  : [];
                                const isCorrectOption =
                                  correctAnswers.includes(optionIndex) ||
                                  currentQuestion.correctAnswer === optionIndex;

                                let optionStyle =
                                  "bg-white border-gray-300 hover:border-cyan-300";
                                if (existingSubmission) {
                                  if (isCorrectOption && isSelected) {
                                    optionStyle = "bg-green-50 border-green-400";
                                  } else if (isCorrectOption) {
                                    optionStyle = "bg-green-100 border-green-300";
                                  } else if (isSelected) {
                                    optionStyle = "bg-red-50 border-red-300";
                                  } else {
                                    optionStyle = "bg-gray-50 border-gray-200";
                                  }
                                } else if (isSelected) {
                                  optionStyle =
                                    "bg-cyan-50 border-cyan-400 shadow-sm";
                                }

                                return (
                                  <label
                                    key={optionIndex}
                                    className={`block p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer ${optionStyle}`}
                                  >
                                    <div className="flex items-center space-x-3 sm:space-x-4">
                                      <input
                                        type={isMultiple ? "checkbox" : "radio"}
                                        name={`question-${safeActiveQuestion}`}
                                        checked={Boolean(isSelected)}
                                        onChange={() =>
                                          handleOptionChange(
                                            safeActiveQuestion,
                                            optionIndex,
                                            isMultiple
                                          )
                                        }
                                        disabled={Boolean(existingSubmission)}
                                        className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600"
                                      />
                                      <span className="text-gray-700 font-medium flex-1 text-sm sm:text-base">
                                        {String.fromCharCode(65 + optionIndex)}.{" "}
                                        {option || "(empty option)"}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                            {existingSubmission &&
                              ((Array.isArray(currentQuestion.correctAnswers) &&
                                currentQuestion.correctAnswers.length > 0) ||
                                typeof currentQuestion.correctAnswer === "number") && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                  <h4 className="font-semibold text-green-800 mb-2">
                                    Correct Answer
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {(
                                      Array.isArray(currentQuestion.correctAnswers)
                                        ? currentQuestion.correctAnswers
                                        : [currentQuestion.correctAnswer]
                                    ).map((answerIndex) => (
                                      <span
                                        key={answerIndex}
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-200 text-green-800"
                                      >
                                        {String.fromCharCode(65 + answerIndex)}.{" "}
                                        {currentQuestion.options?.[answerIndex]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                            <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleReview(safeActiveQuestion)}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium shadow border ${
                                  reviewFlags[safeActiveQuestion]
                                    ? "bg-purple-600 text-white border-purple-600"
                                    : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"
                                }`}
                              >
                                {reviewFlags[safeActiveQuestion]
                                  ? "Unmark Review"
                                  : "Mark for Review"}
                              </button>
                              {!existingSubmission && (
                                <button
                                  type="button"
                                  onClick={() => clearAnswer(safeActiveQuestion)}
                                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border bg-white text-red-700 border-red-300 hover:bg-red-50"
                                >
                                  Clear
                                </button>
                              )}
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    scrollToQuestion(
                                      Math.max(0, safeActiveQuestion - 1)
                                    )
                                  }
                                  disabled={safeActiveQuestion === 0}
                                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${
                                    safeActiveQuestion === 0
                                      ? "bg-gray-200 text-gray-500 border-gray-300"
                                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    scrollToQuestion(
                                      Math.min(totalQuestions - 1, safeActiveQuestion + 1)
                                    )
                                  }
                                  disabled={safeActiveQuestion === totalQuestions - 1}
                                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${
                                    safeActiveQuestion === totalQuestions - 1
                                      ? "bg-gray-200 text-gray-500 border-gray-300"
                                      : "bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700"
                                  }`}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                          <h2 className="text-lg sm:text-2xl font-semibold text-cyan-600">
                            Coding Assignment
                          </h2>
                          <div className="flex items-center gap-3">
                            <span className="text-xs sm:text-sm font-medium text-slate-700">
                              {editorDark ? "Dark" : "Light"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditorDark((prev) => !prev)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                editorDark ? "bg-slate-800" : "bg-slate-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                  editorDark ? "translate-x-5" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                          <div className="p-4 sm:p-5 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                                Question {safeActiveQuestion + 1}
                              </h3>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    scrollToQuestion(
                                      Math.max(0, safeActiveQuestion - 1)
                                    )
                                  }
                                  disabled={safeActiveQuestion === 0}
                                  className="px-2.5 py-1 text-xs rounded-md border bg-white disabled:opacity-50"
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    scrollToQuestion(
                                      Math.min(totalQuestions - 1, safeActiveQuestion + 1)
                                    )
                                  }
                                  disabled={safeActiveQuestion === totalQuestions - 1}
                                  className="px-2.5 py-1 text-xs rounded-md border bg-cyan-600 text-white disabled:opacity-50"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                            <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-6">
                              {currentQuestion?.text ||
                                currentQuestion?.question ||
                                "Coding question"}
                            </p>
                          </div>

                          <div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Programming Language
                              </label>
                              <select
                                value={submission.language}
                                onChange={(e) => handleLanguageChange(e.target.value)}
                                disabled={Boolean(existingSubmission)}
                                className={`w-full p-2 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500 ${
                                  existingSubmission ? "bg-gray-100 opacity-75" : ""
                                }`}
                              >
                                <option value="cpp">C++</option>
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="c">C</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {existingSubmission
                                  ? "Your Submitted Solution"
                                  : "Your Solution"}
                              </label>
                              <textarea
                                value={
                                  submission.codingSolution ||
                                  getDefaultStarter(submission.language)
                                }
                                onChange={(e) =>
                                  setSubmission((prev) => ({
                                    ...prev,
                                    codingSolution: e.target.value,
                                  }))
                                }
                                disabled={Boolean(existingSubmission)}
                                rows={18}
                                className={`w-full rounded-lg border px-3 py-3 font-mono text-sm ${
                                  editorDark
                                    ? "border-slate-700 bg-slate-900 text-slate-100"
                                    : "border-slate-300 bg-white text-slate-900"
                                } ${existingSubmission ? "opacity-80" : ""}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-1 order-1 lg:order-2">
                    <div className="sticky top-24 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">
                        Questions
                      </h3>
                      <div className="grid grid-cols-5 lg:grid-cols-3 gap-2">
                        {questions.map((_, index) => {
                          const answer = submission.mcqAnswers?.[index];
                          const answered =
                            assignment.type === "coding"
                              ? Boolean(
                                  submission.codingSolution &&
                                    submission.codingSolution.trim()
                                )
                              : Array.isArray(answer)
                                ? answer.length > 0
                                : answer !== undefined;
                          const isCurrent = index === safeActiveQuestion;
                          const isMarked = reviewFlags[index];
                          const wasVisited = visitedMap[index];

                          let itemClass =
                            "bg-gray-200 text-gray-800 border-gray-300";
                          if (wasVisited && !answered) {
                            itemClass = "bg-red-500 text-white border-red-500";
                          }
                          if (answered) {
                            itemClass = "bg-green-500 text-white border-green-500";
                          }
                          if (isMarked) {
                            itemClass = "bg-purple-500 text-white border-purple-500";
                          }
                          if (isCurrent) {
                            itemClass = "bg-cyan-600 text-white border-cyan-600";
                          }

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => scrollToQuestion(index)}
                              className={`h-10 rounded-md text-sm font-semibold border ${itemClass}`}
                            >
                              {index + 1}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded bg-cyan-600 inline-block" />
                          Current
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded bg-green-500 inline-block" />
                          Answered
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded bg-red-500 inline-block" />
                          Visited
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded bg-purple-500 inline-block" />
                          Review
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!existingSubmission && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-white font-semibold hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit assignment"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showConfirmDialog && !existingSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Submission
            </h3>
            <p className="text-sm text-gray-600">
              You answered {answeredCount} out of {totalQuestions} questions.
            </p>
            <p className="text-sm text-gray-600 mt-3">
              Are you sure you want to submit this assignment?
            </p>
            <div className="flex gap-3 justify-end mt-6">
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
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CheckAuth>
  );
}
