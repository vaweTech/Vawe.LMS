"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { db, firestoreHelpers } from "../../../../../lib/firebase";
import { useAdminAccess } from "../../../AdminAccessContext";
import AttendanceDetailModal from "@/components/crt/AttendanceDetailModal";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  AcademicCapIcon,
  TrophyIcon,
  DocumentChartBarIcon,
  ArrowPathIcon,
  FunnelIcon,
} from "@heroicons/react/24/solid";
import { tenantSegments } from "@/lib/tenantPath";
import {
  fetchAllSubmissionsForCrt,
  fetchAllTestOptions,
  fetchBatchRoster,
  partitionAttendance,
  submissionMatchesStudent,
  submissionPercent,
  invalidateCrtProgramCache,
  NO_BATCH_KEY,
} from "@/lib/crtTestSubmissions";

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "examsDesc", label: "Tests attended (high first)" },
  { value: "examsAsc", label: "Tests attended (low first)" },
  { value: "avgDesc", label: "Avg score (high first)" },
  { value: "avgAsc", label: "Avg score (low first)" },
  { value: "highestDesc", label: "Highest score (high first)" },
  { value: "highestAsc", label: "Highest score (low first)" },
];

function ScoreBadge({ value }) {
  if (value == null || value === "") return <span className="text-gray-400">—</span>;
  const num = typeof value === "number" ? value : parseFloat(value);
  const cls =
    num >= 70
      ? "bg-emerald-100 text-emerald-800"
      : num >= 40
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${cls}`}
    >
      {typeof num === "number" && !Number.isNaN(num)
        ? `${Math.round(num)}%`
        : value}
    </span>
  );
}

export default function CRTTestAnalyticsPage() {
  const {
    user,
    loading,
    hasCrtManagerAccess: isAdmin,
    collegeSubdomain,
  } = useAdminAccess();

  const [crts, setCrts] = useState([]);
  const [selectedCrtId, setSelectedCrtId] = useState("");
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [batchRoster, setBatchRoster] = useState([]);
  const [testOptions, setTestOptions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sortBy, setSortBy] = useState("avgDesc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchKey, setSelectedBatchKey] = useState("all");
  const [detailModal, setDetailModal] = useState(null);
  const [cacheHint, setCacheHint] = useState("");

  const fetchCrts = useCallback(async () => {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crt"))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCrts(list);
    if (list.length > 0 && !selectedCrtId) setSelectedCrtId(list[0].id);
  }, [selectedCrtId, collegeSubdomain]);

  useEffect(() => {
    if (!user) return;
    fetchCrts();
  }, [user, fetchCrts]);

  const fetchAllSubmissionsForCrtProgram = useCallback(
    async (crtId, forceRefresh = false) => {
      if (!crtId) {
        setAllSubmissions([]);
        setBatchRoster([]);
        setTestOptions([]);
        return;
      }
      if (forceRefresh) {
        invalidateCrtProgramCache(collegeSubdomain, crtId);
      }
      setLoadingData(true);
      try {
        const cacheOptions = { forceRefresh };
        const [submissions, roster, tests] = await Promise.all([
          fetchAllSubmissionsForCrt(
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
          fetchAllTestOptions(
            db,
            firestoreHelpers,
            collegeSubdomain,
            crtId,
            cacheOptions
          ),
        ]);
        setAllSubmissions(submissions);
        setBatchRoster(roster);
        setTestOptions(tests);
        setCacheHint(
          forceRefresh
            ? "Loaded fresh from Firebase"
            : "Session cache used (5 min TTL) — click Refresh for latest"
        );
      } catch (e) {
        console.error(e);
        setAllSubmissions([]);
        setBatchRoster([]);
        setTestOptions([]);
      } finally {
        setLoadingData(false);
      }
    },
    [collegeSubdomain]
  );

  useEffect(() => {
    if (!selectedCrtId) {
      setAllSubmissions([]);
      setBatchRoster([]);
      setTestOptions([]);
      return;
    }
    fetchAllSubmissionsForCrtProgram(selectedCrtId);
  }, [selectedCrtId, fetchAllSubmissionsForCrtProgram]);

  const filteredRoster = useMemo(() => {
    if (selectedBatchKey === "all") return batchRoster;
    return batchRoster.filter(
      (s) => (s.batchId || NO_BATCH_KEY) === selectedBatchKey
    );
  }, [batchRoster, selectedBatchKey]);

  const batchOptions = useMemo(() => {
    const map = new Map();
    for (const student of batchRoster) {
      const key = student.batchId || NO_BATCH_KEY;
      const label = student.batchName || "No batch";
      if (!map.has(key)) map.set(key, label);
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [batchRoster]);

  const filteredSubmissions = useMemo(() => {
    if (selectedBatchKey === "all") return allSubmissions;
    return allSubmissions.filter(
      (sub) => (sub.batchId || NO_BATCH_KEY) === selectedBatchKey
    );
  }, [allSubmissions, selectedBatchKey]);

  const studentStats = useMemo(() => {
    const rows = new Map();

    for (const student of filteredRoster) {
      rows.set(student.rosterDocId, {
        key: student.rosterDocId,
        userId: student.uid || student.studentId,
        userName: student.userName,
        phone: student.phone,
        regdNo: student.regdNo,
        batchName: student.batchName || null,
        batchId: student.batchId || null,
        examsAttended: 0,
        totalPercent: 0,
        maxPercent: null,
        lastSubmittedAt: null,
        submissions: [],
        testNames: new Set(),
        matchIds: student.matchIds,
      });
    }

    const matchedSubIds = new Set();
    for (const sub of filteredSubmissions) {
      const rosterStudent = filteredRoster.find((s) =>
        submissionMatchesStudent(sub, s)
      );
      const percent = submissionPercent(sub);
      const testLabel =
        sub.testLabel ||
        (sub.sourceType === "day_test" && sub.day
          ? `Day ${sub.day}: ${sub.testName}`
          : sub.testName);

      if (rosterStudent) {
        const row = rows.get(rosterStudent.rosterDocId);
        if (!row) continue;
        matchedSubIds.add(sub.id);
        row.examsAttended += 1;
        if (percent != null && !Number.isNaN(percent)) {
          row.totalPercent += percent;
          row.maxPercent =
            row.maxPercent == null ? percent : Math.max(row.maxPercent, percent);
        }
        if (sub.submittedAt) {
          const t = new Date(sub.submittedAt).getTime();
          if (!row.lastSubmittedAt || t > row.lastSubmittedAt) {
            row.lastSubmittedAt = t;
          }
        }
        if (testLabel) row.testNames.add(testLabel);
        row.submissions.push(sub);
        if (!row.phone && sub.phone) row.phone = sub.phone;
      }
    }

    for (const sub of filteredSubmissions) {
      if (matchedSubIds.has(sub.id)) continue;
      const uid = sub.userId || sub.studentId || `orphan-${sub.id}`;
      rows.set(`orphan:${sub.id}`, {
        key: `orphan:${sub.id}`,
        userId: uid,
        userName: sub.userName || uid,
        phone: sub.phone || "",
        regdNo: sub.regdNo || "",
        batchName: sub.batchName || null,
        batchId: sub.batchId || null,
        examsAttended: 1,
        totalPercent: submissionPercent(sub) ?? 0,
        maxPercent: submissionPercent(sub),
        lastSubmittedAt: sub.submittedAt
          ? new Date(sub.submittedAt).getTime()
          : null,
        submissions: [sub],
        testNames: new Set([
          sub.testLabel ||
            (sub.sourceType === "day_test" && sub.day
              ? `Day ${sub.day}: ${sub.testName}`
              : sub.testName),
        ].filter(Boolean)),
      });
    }

    return Array.from(rows.values()).map((row) => ({
      ...row,
      avgScore:
        row.examsAttended > 0 ? row.totalPercent / row.examsAttended : null,
      testNames: Array.from(row.testNames).sort(),
    }));
  }, [filteredSubmissions, filteredRoster]);

  const testSummaryByName = useMemo(() => {
    return testOptions
      .map((test) => {
        const testSubs = filteredSubmissions.filter(
          (s) => s.testKey === test.key
        );
        const { attended, notAttended } = partitionAttendance(
          filteredRoster,
          testSubs
        );
        const attendedRows = attended.map(({ student, submission }) => ({
          rosterDocId: student.rosterDocId,
          userName: submission.userName || student.userName,
          phone: submission.phone || student.phone,
          batchName: student.batchName,
          regdNo: student.regdNo,
          score: submission.score,
          total: submission.total,
          percent: submissionPercent(submission),
        }));
        const totalPercent = testSubs.reduce((sum, sub) => {
          const pct = submissionPercent(sub);
          return pct != null ? sum + pct : sum;
        }, 0);
        const scoredCount = testSubs.filter(
          (s) => submissionPercent(s) != null
        ).length;

        return {
          testKey: test.key,
          testName: test.label,
          sourceType: test.sourceType,
          attempts: testSubs.length,
          attendedCount: attended.length,
          notAttendedCount: notAttended.length,
          notAttended,
          attendedRows,
          avgPercent:
            scoredCount > 0 ? Math.round(totalPercent / scoredCount) : null,
        };
      })
      .sort((a, b) => a.testName.localeCompare(b.testName));
  }, [testOptions, filteredSubmissions, filteredRoster]);

  const filteredAndSorted = useMemo(() => {
    let list = [...studentStats];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.userName && s.userName.toLowerCase().includes(q)) ||
          (s.userId && s.userId.toLowerCase().includes(q)) ||
          (s.batchName && s.batchName.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          s.testNames.some((name) => name.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case "name":
        list.sort((a, b) =>
          (a.userName || "").localeCompare(b.userName || "", undefined, {
            sensitivity: "base",
          })
        );
        break;
      case "examsDesc":
        list.sort((a, b) => b.examsAttended - a.examsAttended);
        break;
      case "examsAsc":
        list.sort((a, b) => a.examsAttended - b.examsAttended);
        break;
      case "avgDesc":
        list.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
        break;
      case "avgAsc":
        list.sort((a, b) => (a.avgScore ?? -1) - (b.avgScore ?? -1));
        break;
      case "highestDesc":
        list.sort((a, b) => (b.maxPercent ?? -1) - (a.maxPercent ?? -1));
        break;
      case "highestAsc":
        list.sort((a, b) => (a.maxPercent ?? -1) - (b.maxPercent ?? -1));
        break;
      default:
        list.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
    }
    return list;
  }, [studentStats, sortBy, searchQuery]);

  const summary = useMemo(() => {
    const totalStudents = studentStats.length;
    const totalExams = filteredSubmissions.length;
    const notAttendedTotal = studentStats.filter(
      (s) => s.examsAttended === 0
    ).length;
    const sumPercent = studentStats.reduce(
      (acc, s) =>
        acc + (s.avgScore != null ? s.avgScore * (s.examsAttended || 0) : 0),
      0
    );
    const overallAvg = totalExams > 0 ? sumPercent / totalExams : null;
    const topScorer = studentStats.reduce(
      (best, s) =>
        (s.maxPercent ?? -1) > (best?.maxPercent ?? -1) ? s : best,
      null
    );
    return {
      totalStudents,
      totalExams,
      overallAvg,
      topScorer,
      notAttendedTotal,
    };
  }, [studentStats, filteredSubmissions.length]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/Admin/crt/crtTestSubmission"
            className="inline-flex items-center gap-2 text-cyan-600 hover:text-cyan-700 font-medium"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to submissions
          </Link>
          <Link
            href="/Admin/crt"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            CRT Admin
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1 flex items-center gap-2">
            <ChartBarIcon className="w-8 h-8 text-cyan-600" />
            CRT Test Analytics
          </h1>
          <p className="text-gray-600 text-sm">
            Student-wise and test-wise reports from CRT exams and day progress
            tests, grouped by batch.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CRT Program
            </label>
            <select
              value={selectedCrtId}
              onChange={(e) => {
                setSelectedCrtId(e.target.value);
                setSelectedBatchKey("all");
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">-- Select CRT --</option>
              {crts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch
            </label>
            <select
              value={selectedBatchKey}
              onChange={(e) => setSelectedBatchKey(e.target.value)}
              disabled={!selectedCrtId || batchOptions.length === 0}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
            >
              <option value="all">All batches</option>
              {batchOptions.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => fetchAllSubmissionsForCrtProgram(selectedCrtId, true)}
            disabled={loadingData || !selectedCrtId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700 disabled:opacity-50"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {loadingData ? "Loading…" : "Refresh"}
          </button>
        </div>

        {cacheHint ? (
          <p className="text-xs text-gray-500 mb-4">{cacheHint}</p>
        ) : null}

        {selectedCrt && (
          <div className="mb-6 p-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-gray-800">
              {selectedCrt?.name || selectedCrtId}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">
              {summary.totalStudents} student
              {summary.totalStudents !== 1 ? "s" : ""} · {summary.totalExams}{" "}
              attempt{summary.totalExams !== 1 ? "s" : ""}
            </span>
            {selectedBatchKey !== "all" && (
              <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-xs font-medium">
                {batchOptions.find((b) => b.key === selectedBatchKey)?.label}
              </span>
            )}
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-cyan-300 border-t-cyan-600 rounded-full animate-spin" />
          </div>
        ) : !selectedCrtId ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
            Select a CRT program to view analytics.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-100">
                    <AcademicCapIcon className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Batch students
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {summary.totalStudents}
                    </p>
                    {summary.notAttendedTotal > 0 && (
                      <p className="text-xs text-red-600 font-medium">
                        {summary.notAttendedTotal} with no attempts
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-violet-100">
                    <DocumentChartBarIcon className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Total attempts
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {summary.totalExams}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100">
                    <ChartBarIcon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Overall avg score
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                      {summary.overallAvg != null
                        ? `${Math.round(summary.overallAvg)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-100">
                    <TrophyIcon className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Top scorer</p>
                    <p
                      className="text-lg font-bold text-gray-800 truncate"
                      title={summary.topScorer?.userName}
                    >
                      {summary.topScorer?.userName || "—"}
                    </p>
                    {summary.topScorer?.maxPercent != null && (
                      <p className="text-sm text-amber-700 font-medium">
                        {Math.round(summary.topScorer.maxPercent)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {testSummaryByName.length > 0 && (
              <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-cyan-50">
                  <h2 className="font-semibold text-gray-800">
                    Reports by test name
                  </h2>
                  <p className="text-sm text-gray-500">
                    Attended vs not attended per test (batch students)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        <th className="px-4 py-3 font-semibold">Test</th>
                        <th className="px-4 py-3 font-semibold text-center">Type</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Attended
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Not attended
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Avg %
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {testSummaryByName.map((row) => (
                          <tr
                            key={row.testKey}
                            className="border-t border-gray-100 hover:bg-gray-50/50"
                          >
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {row.testName}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  row.sourceType === "day_test"
                                    ? "bg-violet-100 text-violet-800"
                                    : "bg-cyan-100 text-cyan-800"
                                }`}
                              >
                                {row.sourceType === "day_test"
                                  ? "Day test"
                                  : "CRT exam"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-700 font-medium">
                              {row.attendedCount}
                            </td>
                            <td className="px-4 py-3 text-center text-red-700 font-medium">
                              {row.notAttendedCount}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.avgPercent != null ? (
                                <span className="font-semibold text-gray-800">
                                  {row.avgPercent}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {row.attendedCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailModal({
                                        variant: "attended",
                                        title: `Attended — ${row.testName}`,
                                        subtitle: selectedCrt?.name || selectedCrtId,
                                        rows: row.attendedRows,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                                  >
                                    Attended ({row.attendedCount})
                                  </button>
                                )}
                                {row.notAttendedCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailModal({
                                        variant: "not_attended",
                                        title: `Not attended — ${row.testName}`,
                                        subtitle: selectedCrt?.name || selectedCrtId,
                                        rows: row.notAttended,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                                  >
                                    Not attended ({row.notAttendedCount})
                                  </button>
                                )}
                                {row.attendedCount === 0 &&
                                  row.notAttendedCount === 0 && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
                {summary.notAttendedTotal > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        variant: "not_attended",
                        title: "Students with no test attempts",
                        subtitle: selectedCrt?.name || selectedCrtId,
                        rows: studentStats
                          .filter((s) => s.examsAttended === 0)
                          .map((s) => ({
                            rosterDocId: s.key,
                            userName: s.userName,
                            phone: s.phone,
                            batchName: s.batchName,
                            regdNo: s.regdNo,
                          })),
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    View no attempts ({summary.notAttendedTotal})
                  </button>
                )}
                <div className="relative flex-1 min-w-[180px]">
                  <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, mobile, batch, or test…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">
                    Sort by
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Mobile</th>
                      <th className="px-4 py-3 font-semibold">Batch</th>
                      <th className="px-4 py-3 font-semibold text-center">
                        Tests attended
                      </th>
                      <th className="px-4 py-3 font-semibold">Tests taken</th>
                      <th className="px-4 py-3 font-semibold text-center">
                        Avg score
                      </th>
                      <th className="px-4 py-3 font-semibold text-center">
                        Highest
                      </th>
                      <th className="px-4 py-3 font-semibold">Last attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-12 text-center text-gray-500 text-sm"
                        >
                          {searchQuery.trim()
                            ? `No students match "${searchQuery}".`
                            : "No batch students found for this CRT."}
                        </td>
                      </tr>
                    ) : (
                      filteredAndSorted.map((row, i) => (
                        <tr
                          key={row.key || row.userId}
                          className={`border-t border-gray-100 hover:bg-cyan-50/30 transition-colors ${
                            row.examsAttended === 0 ? "bg-red-50/20" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-500 tabular-nums font-medium">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-800">
                              {row.userName || row.userId || "—"}
                            </span>
                            {row.examsAttended === 0 && (
                              <span className="ml-2 text-[10px] font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                                Not attended
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums text-sm">
                            {row.phone || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">
                            {row.batchName || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold text-sm">
                              {row.examsAttended}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[240px]">
                            <span className="line-clamp-2" title={row.testNames.join(", ")}>
                              {row.testNames.join(", ") || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ScoreBadge value={row.avgScore} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ScoreBadge value={row.maxPercent} />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {row.lastSubmittedAt
                              ? new Date(row.lastSubmittedAt).toLocaleDateString(
                                  undefined,
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <AttendanceDetailModal
          open={Boolean(detailModal)}
          onClose={() => setDetailModal(null)}
          title={detailModal?.title || ""}
          subtitle={detailModal?.subtitle}
          variant={detailModal?.variant || "not_attended"}
          rows={detailModal?.rows || []}
        />
      </div>
    </div>
  );
}
