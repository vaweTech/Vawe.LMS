"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { db, firestoreHelpers } from "../../../../lib/firebase";
import { useAdminAccess } from "../../AdminAccessContext";
import {
  ArrowLeftIcon,
  UserGroupIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";
import { tenantSegments } from "@/lib/tenantPath";
import {
  buildStudentBatchMap,
  fetchAllTestOptions,
  fetchAllSubmissionsForCrt,
  fetchSubmissionsForTestOption,
  fetchBatchRoster,
  fetchCrtBatches,
  buildBatchAttendanceGroups,
  buildDayOptions,
  buildSubjectOptions,
  resolveFilteredTests,
  buildBatchStudentOverview,
  partitionAttendance,
  submissionPercent,
  invalidateCrtProgramCache,
} from "@/lib/crtTestSubmissions";
import AttendanceDetailModal from "@/components/crt/AttendanceDetailModal";

function flattenQuestions(sections) {
  if (!Array.isArray(sections)) return [];
  const out = [];
  let globalIndex = 0;
  for (const section of sections) {
    const questions = Array.isArray(section.questions) ? section.questions : [];
    const sectionTitle = section.title || section.name || "";
    for (let i = 0; i < questions.length; i++) {
      out.push({ sectionTitle, question: questions[i], globalIndex: globalIndex++ });
    }
  }
  return out;
}

function groupBySection(questionsList) {
  const map = new Map();
  for (let i = 0; i < questionsList.length; i++) {
    const title = questionsList[i].sectionTitle || "Questions";
    if (!map.has(title)) map.set(title, []);
    map.get(title).push(i);
  }
  return Array.from(map.entries()).map(([sectionTitle, indices]) => ({
    sectionTitle,
    indices,
  }));
}

function isAnswerCorrect(question, userAnswer) {
  const correctAnswers = Array.isArray(question.correctAnswers)
    ? question.correctAnswers
    : [];
  const isMultiple = question.isMultiple === true;
  if (isMultiple) {
    const userSet = new Set(Array.isArray(userAnswer) ? userAnswer : []);
    const correctSet = new Set(correctAnswers);
    return (
      userSet.size === correctSet.size &&
      [...userSet].every((x) => correctSet.has(x))
    );
  }
  const userSingle =
    typeof userAnswer === "number"
      ? userAnswer
      : Array.isArray(userAnswer)
        ? userAnswer[0]
        : undefined;
  return correctAnswers.includes(userSingle);
}

export default function CRTTestSubmissionPage() {
  const { user, loading, hasCrtManagerAccess: isAdmin, collegeSubdomain } =
    useAdminAccess();

  const [crts, setCrts] = useState([]);
  const [selectedCrtId, setSelectedCrtId] = useState("");
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [tests, setTests] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [batchRoster, setBatchRoster] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [cacheHint, setCacheHint] = useState("");

  const isBatchOverview = Boolean(
    selectedBatchId && !selectedDayKey && !selectedSubjectId
  );
  const needsSubjectSelection = Boolean(
    selectedDayKey &&
      selectedDayKey !== "crt_exams" &&
      !selectedSubjectId
  );
  const isDetailView = Boolean(
    selectedBatchId &&
      ((selectedDayKey && selectedSubjectId) || selectedDayKey === "crt_exams")
  );

  const activeTests = useMemo(
    () =>
      resolveFilteredTests(tests, {
        dayKey: selectedDayKey,
        subjectId: selectedSubjectId,
      }),
    [tests, selectedDayKey, selectedSubjectId]
  );

  const fetchCrts = useCallback(async () => {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crt"))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCrts(list);
    if (list.length > 0 && !selectedCrtId) {
      setSelectedCrtId(list[0].id);
    }
  }, [selectedCrtId, collegeSubdomain]);

  useEffect(() => {
    if (!user) return;
    fetchCrts();
  }, [user, fetchCrts]);

  const loadProgramMeta = useCallback(
    async (crtId, forceRefresh = false) => {
      if (!crtId) {
        setBatches([]);
        setTests([]);
        setBatchRoster([]);
        setSelectedBatchId("");
        setSelectedDayKey("");
        setSelectedSubjectId("");
        return;
      }
      if (forceRefresh) {
        invalidateCrtProgramCache(collegeSubdomain, crtId);
      }
      setLoadingProgram(true);
      try {
        const cacheOptions = { forceRefresh };
        const [batchList, testList, roster] = await Promise.all([
          fetchCrtBatches(
            db,
            firestoreHelpers,
            collegeSubdomain,
            crtId,
            cacheOptions
          ),
          fetchAllTestOptions(
            db,
            firestoreHelpers,
            collegeSubdomain,
            crtId,
            cacheOptions
          ),
          fetchBatchRoster(
            db,
            firestoreHelpers,
            collegeSubdomain,
            crtId,
            cacheOptions
          ),
        ]);
        setBatches(batchList);
        setTests(testList);
        setBatchRoster(roster);
        setSelectedBatchId(batchList.length > 0 ? batchList[0].id : "");
        setSelectedDayKey("");
        setSelectedSubjectId("");
        setCacheHint(forceRefresh ? "Loaded fresh from Firebase" : "Using session cache when available");
      } catch (e) {
        console.error(e);
        setBatches([]);
        setTests([]);
        setBatchRoster([]);
      } finally {
        setLoadingProgram(false);
      }
    },
    [collegeSubdomain]
  );

  useEffect(() => {
    loadProgramMeta(selectedCrtId);
  }, [selectedCrtId, loadProgramMeta]);

  const dayOptions = useMemo(() => buildDayOptions(tests), [tests]);

  const subjectOptions = useMemo(
    () => buildSubjectOptions(tests, selectedDayKey),
    [tests, selectedDayKey]
  );

  const selectedSubject = useMemo(
    () => subjectOptions.find((s) => s.courseId === selectedSubjectId) || null,
    [subjectOptions, selectedSubjectId]
  );

  useEffect(() => {
    setSelectedSubjectId("");
    if (selectedDayKey === "crt_exams") {
      setSelectedSubjectId("crt_exams");
    }
  }, [selectedDayKey]);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const rosterInBatch = useMemo(
    () => batchRoster.filter((s) => s.batchId === selectedBatchId),
    [batchRoster, selectedBatchId]
  );

  const loadReportData = useCallback(
    async (forceRefresh = false) => {
      if (!selectedCrtId || !selectedBatchId) {
        setAllSubmissions([]);
        setSubmissions([]);
        return;
      }
      if (forceRefresh) {
        invalidateCrtProgramCache(collegeSubdomain, selectedCrtId);
      }
      setLoadingData(true);
      try {
        const cacheOptions = { forceRefresh };
        const batchMap = await buildStudentBatchMap(
          db,
          firestoreHelpers,
          collegeSubdomain,
          selectedCrtId,
          cacheOptions
        );

        const allSubs = await fetchAllSubmissionsForCrt(
          db,
          firestoreHelpers,
          collegeSubdomain,
          selectedCrtId,
          cacheOptions
        );
        setAllSubmissions(allSubs);

        if (!isDetailView) {
          setSubmissions([]);
          setCacheHint(
            forceRefresh
              ? "Loaded fresh from Firebase"
              : "Session cache used (5 min TTL) — click Refresh for latest"
          );
          return;
        }

        const testsToLoad = activeTests;
        const combined = [];
        for (const test of testsToLoad) {
          const rows = await fetchSubmissionsForTestOption(
            db,
            firestoreHelpers,
            collegeSubdomain,
            selectedCrtId,
            test,
            batchMap,
            cacheOptions
          );
          combined.push(
            ...rows.map((row) => ({
              ...row,
              testKey: test.key,
              testLabel: test.label,
            }))
          );
        }
        setSubmissions(combined);
        setCacheHint(
          forceRefresh
            ? "Loaded fresh from Firebase"
            : "Session cache used (5 min TTL) — click Refresh for latest"
        );
      } catch (e) {
        console.error(e);
        setAllSubmissions([]);
        setSubmissions([]);
      } finally {
        setLoadingData(false);
      }
    },
    [
      selectedCrtId,
      selectedBatchId,
      isDetailView,
      activeTests,
      collegeSubdomain,
    ]
  );

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const batchStudentOverview = useMemo(() => {
    if (!isBatchOverview || !selectedBatchId) return [];
    return buildBatchStudentOverview(
      batchRoster,
      activeTests.length > 0 && selectedSubjectId ? activeTests : tests,
      allSubmissions,
      selectedBatchId
    );
  }, [
    isBatchOverview,
    selectedBatchId,
    batchRoster,
    tests,
    activeTests,
    selectedSubjectId,
    allSubmissions,
  ]);

  const singleTestAttendance = useMemo(() => {
    if (!isDetailView || rosterInBatch.length === 0) {
      return { attended: [], notAttended: [] };
    }
    return partitionAttendance(rosterInBatch, submissions);
  }, [isDetailView, rosterInBatch, submissions]);

  const primaryTest = activeTests[0] || null;

  const sectionAnalytics = useMemo(() => {
    if (!isDetailView || primaryTest?.sourceType !== "crt_exam") return [];
    const sections = primaryTest?.sections;
    if (!Array.isArray(sections) || sections.length === 0) return [];
    const questionsList = flattenQuestions(sections);
    const sectionGroups = groupBySection(questionsList);
    const subsWithAnswers = submissions.filter(
      (s) => s.answers && typeof s.answers === "object"
    );
    if (subsWithAnswers.length === 0) return [];

    return sectionGroups.map(({ sectionTitle, indices }) => {
      const totalQuestions = indices.length;
      const aggregateCorrect = subsWithAnswers.reduce((sum, sub) => {
        const answers = sub.answers ?? {};
        let c = 0;
        for (const idx of indices) {
          const item = questionsList[idx];
          if (!item) continue;
          const userAnswer = answers[idx] ?? answers[String(idx)];
          if (isAnswerCorrect(item.question, userAnswer)) c++;
        }
        return sum + c;
      }, 0);
      const avgPercent =
        totalQuestions > 0 && subsWithAnswers.length > 0
          ? Math.round(
              (aggregateCorrect / (totalQuestions * subsWithAnswers.length)) *
                100
            )
          : 0;
      return {
        sectionTitle: sectionTitle || "Section",
        totalQuestions,
        totalCorrect: aggregateCorrect,
        studentCount: subsWithAnswers.length,
        avgPercent,
      };
    });
  }, [isDetailView, primaryTest, submissions]);

  const selectedCrt = useMemo(
    () => crts.find((c) => c.id === selectedCrtId) || null,
    [crts, selectedCrtId]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-600">
          <div className="w-5 h-5 border-2 border-cyan-300 border-t-cyan-600 rounded-full animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Access denied</h1>
        <p className="text-slate-600 mb-4">Admin access required.</p>
        <Link href="/" className="text-cyan-600 font-medium hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  const dayLabel =
    dayOptions.find((d) => d.key === selectedDayKey)?.label ||
    "All days (batch summary)";
  const subjectLabel = selectedSubject?.courseTitle || "";

  const breadcrumbLabel = selectedDayKey
    ? subjectLabel
      ? `${dayLabel} → ${subjectLabel}`
      : dayLabel
    : "All tests (batch summary)";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-gray-800">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/Admin/crt"
            className="inline-flex items-center gap-2 text-cyan-600 hover:text-cyan-700 font-medium"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to CRT Admin
          </Link>
          <Link
            href="/Admin/crt/crtTestSubmission/analytics"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700"
          >
            <ChartBarIcon className="w-5 h-5" />
            Analytics
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
            CRT Test Submissions
          </h1>
          <p className="text-gray-600 text-sm">
            Select program → batch → day → subject. Batch only shows all
            students with tests attended vs total.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1. Select CRT Program
            </label>
            <select
              value={selectedCrtId}
              onChange={(e) => setSelectedCrtId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">-- Select CRT --</option>
              {crts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. Select Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={!selectedCrtId || loadingProgram || batches.length === 0}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="">-- Select Batch --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              3. Select Day
            </label>
            <select
              value={selectedDayKey}
              onChange={(e) => setSelectedDayKey(e.target.value)}
              disabled={!selectedBatchId || loadingProgram || tests.length === 0}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              {dayOptions.map((opt) => (
                <option key={opt.key || "all"} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              4. Select Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={
                !selectedBatchId ||
                !selectedDayKey ||
                selectedDayKey === "crt_exams" ||
                subjectOptions.length <= 1
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              {subjectOptions.map((s) => (
                <option key={s.courseId || "none"} value={s.courseId}>
                  {s.courseTitle}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                loadProgramMeta(selectedCrtId, true);
                loadReportData(true);
              }}
              disabled={loadingData || !selectedBatchId}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700 disabled:opacity-50"
            >
              {loadingData ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {cacheHint ? (
          <p className="text-xs text-gray-500 mb-4 -mt-4">{cacheHint}</p>
        ) : null}

        {selectedCrt && selectedBatch ? (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-gray-700">
              {selectedCrt.name || selectedCrtId}
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700">{selectedBatch.name}</span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700">{breadcrumbLabel}</span>
            {isBatchOverview && (
              <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 text-xs font-medium">
                Batch summary · {tests.length} total tests
              </span>
            )}
            {needsSubjectSelection && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                Select a subject to view day report
              </span>
            )}
          </div>
        ) : null}

        {sectionAnalytics.length > 0 && !loadingData && (
          <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-cyan-600" />
                Analytics by Section
              </h2>
            </div>
            <div className="p-4 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sectionAnalytics.map((section, i) => (
                <div
                  key={section.sectionTitle + i}
                  className="rounded-xl border border-gray-200 bg-gray-50/50 p-4"
                >
                  <h3 className="font-semibold text-gray-800 text-sm mb-2">
                    {section.sectionTitle}
                  </h3>
                  <p className="text-2xl font-bold text-cyan-700">
                    {section.avgPercent}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-cyan-300 border-t-cyan-600 rounded-full animate-spin" />
          </div>
        ) : !selectedBatchId ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
            Select a CRT program and batch to view reports.
          </div>
        ) : isBatchOverview ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-cyan-50 border-b border-gray-200 flex flex-wrap items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-violet-600" />
              <h2 className="font-semibold text-gray-800">
                {selectedBatch.name} — all students
              </h2>
              <span className="text-sm text-gray-500">
                Tests attended / total tests
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Mobile</th>
                    <th className="px-4 py-3 font-medium text-center">
                      Tests attended
                    </th>
                    <th className="px-4 py-3 font-medium text-center">
                      Avg %
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batchStudentOverview.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        No students in this batch.
                      </td>
                    </tr>
                  ) : (
                    batchStudentOverview.map((row, i) => (
                      <tr
                        key={row.rosterDocId}
                        className={`border-t border-gray-100 hover:bg-gray-50/50 ${
                          row.attendedCount === 0 ? "bg-red-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-500 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {row.userName}
                        </td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums">
                          {row.phone || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full font-semibold text-sm ${
                              row.attendedCount === row.totalTests
                                ? "bg-emerald-100 text-emerald-800"
                                : row.attendedCount > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {row.attendedCount} / {row.totalTests}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {row.avgPercent != null ? `${row.avgPercent}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setDetailModal({
                                variant: "student_overview",
                                title: `${row.userName} — test report`,
                                subtitle: `${selectedBatch.name} · ${row.attendedCount}/${row.totalTests} tests`,
                                studentOverview: row,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-700"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : needsSubjectSelection ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
            Select a <strong>subject</strong> for {dayLabel} to view attendance
            and scores for that course.
          </div>
        ) : isDetailView ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-gray-200 flex flex-wrap items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-cyan-600" />
              <h2 className="font-semibold text-gray-800">
                {selectedBatch.name}
              </h2>
              <span className="text-sm text-gray-500">
                {singleTestAttendance.attended.length} attended ·{" "}
                {singleTestAttendance.notAttended.length} not attended
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                {singleTestAttendance.attended.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        variant: "attended",
                        title: `Attended — ${selectedBatch.name}`,
                        subtitle: breadcrumbLabel,
                        rows: singleTestAttendance.attended.map(
                          ({ submission }) => ({
                            id: submission.id,
                            userName:
                              submission.userName || submission.userId,
                            phone: submission.phone,
                            batchName: selectedBatch.name,
                            score: submission.score,
                            total: submission.total,
                            percent: submissionPercent(submission),
                          })
                        ),
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                  >
                    View attended ({singleTestAttendance.attended.length})
                  </button>
                )}
                {singleTestAttendance.notAttended.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        variant: "not_attended",
                        title: `Not attended — ${selectedBatch.name}`,
                        subtitle: breadcrumbLabel,
                        rows: singleTestAttendance.notAttended,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                  >
                    View not attended (
                    {singleTestAttendance.notAttended.length})
                  </button>
                )}
              </div>
            </div>

            {singleTestAttendance.attended.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Mobile</th>
                      <th className="px-4 py-3 font-medium">Test</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">%</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleTestAttendance.attended.map(
                      ({ submission }, i) => {
                        const percent = submissionPercent(submission);
                        return (
                          <tr
                            key={submission.id}
                            className="border-t border-gray-100 hover:bg-gray-50/50"
                          >
                            <td className="px-4 py-3 text-gray-500 tabular-nums">
                              {i + 1}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {submission.userName || submission.userId}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {submission.phone || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {submission.testLabel || breadcrumbLabel}
                            </td>
                            <td className="px-4 py-3">
                              {submission.score != null &&
                              submission.total != null
                                ? `${submission.score} / ${submission.total}`
                                : "—"}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {percent != null ? `${percent}%` : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {submission.submittedAt
                                ? new Date(
                                    submission.submittedAt
                                  ).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        <AttendanceDetailModal
          open={Boolean(detailModal)}
          onClose={() => setDetailModal(null)}
          title={detailModal?.title || ""}
          subtitle={detailModal?.subtitle}
          variant={detailModal?.variant || "not_attended"}
          rows={detailModal?.rows || []}
          studentOverview={detailModal?.studentOverview}
        />
      </div>
    </div>
  );
}
