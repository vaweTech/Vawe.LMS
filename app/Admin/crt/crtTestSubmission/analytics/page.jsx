"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { db, firestoreHelpers } from "../../../../../lib/firebase";
import { useAdminAccess } from "../../../AdminAccessContext";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  AcademicCapIcon,
  TrophyIcon,
  DocumentChartBarIcon,
  ArrowPathIcon,
  FunnelIcon,
} from "@heroicons/react/24/solid";

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "examsDesc", label: "Exams attended (high first)" },
  { value: "examsAsc", label: "Exams attended (low first)" },
  { value: "avgDesc", label: "Avg score (high first)" },
  { value: "avgAsc", label: "Avg score (low first)" },
  { value: "highestDesc", label: "Highest score (high first)" },
  { value: "highestAsc", label: "Highest score (low first)" },
];

// Dummy data for demo / development when no submissions exist
const DUMMY_STUDENT_STATS = [
  { userId: "d1", userName: "Priya Sharma", batchName: "Batch A", examsAttended: 5, avgScore: 78, maxPercent: 92, lastSubmittedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d2", userName: "Rahul Kumar", batchName: "Batch A", examsAttended: 4, avgScore: 85, maxPercent: 94, lastSubmittedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d3", userName: "Anita Reddy", batchName: "Batch B", examsAttended: 6, avgScore: 72, maxPercent: 88, lastSubmittedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d4", userName: "Vikram Singh", batchName: "Batch B", examsAttended: 3, avgScore: 65, maxPercent: 76, lastSubmittedAt: Date.now() - 5 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d5", userName: "Sneha Patel", batchName: "Batch A", examsAttended: 5, avgScore: 91, maxPercent: 98, lastSubmittedAt: Date.now() - 0.5 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d6", userName: "Arun Nair", batchName: "Batch C", examsAttended: 2, avgScore: 58, maxPercent: 62, lastSubmittedAt: Date.now() - 7 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d7", userName: "Kavitha Iyer", batchName: "Batch C", examsAttended: 4, avgScore: 82, maxPercent: 90, lastSubmittedAt: Date.now() - 4 * 24 * 60 * 60 * 1000, submissions: [] },
  { userId: "d8", userName: "Rajesh Gupta", batchName: "Batch B", examsAttended: 5, avgScore: 69, maxPercent: 81, lastSubmittedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, submissions: [] },
];

function ScoreBadge({ value, label }) {
  if (value == null || value === "") return <span className="text-gray-400">—</span>;
  const num = typeof value === "number" ? value : parseFloat(value);
  const cls =
    num >= 70
      ? "bg-emerald-100 text-emerald-800"
      : num >= 40
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${cls}`}>
      {typeof num === "number" && !Number.isNaN(num) ? `${Math.round(num)}%` : value}
    </span>
  );
}

export default function CRTTestAnalyticsPage() {
  const access = useAdminAccess();
  const user = access.user;
  const loading = access.loading;
  const isAdmin = access.hasCrtManagerAccess;

  const [crts, setCrts] = useState([]);
  const [selectedCrtId, setSelectedCrtId] = useState("");
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sortBy, setSortBy] = useState("avgDesc");
  const [searchQuery, setSearchQuery] = useState("");
  const [useDummyData, setUseDummyData] = useState(false);

  const fetchCrts = useCallback(async () => {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, "crt")
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCrts(list);
    if (list.length > 0 && !selectedCrtId) setSelectedCrtId(list[0].id);
  }, [selectedCrtId]);

  useEffect(() => {
    if (!user) return;
    fetchCrts();
  }, [user, fetchCrts]);

  const fetchAllSubmissionsForCrt = useCallback(async (crtId) => {
    if (!crtId) {
      setAllSubmissions([]);
      return;
    }
    setLoadingData(true);
    try {
      const testsSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, "crt", crtId, "tests")
      );
      const submissions = [];
      for (const testDoc of testsSnap.docs) {
        const subSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            "crt",
            crtId,
            "tests",
            testDoc.id,
            "submissions"
          )
        );
        const testData = testDoc.data();
        subSnap.docs.forEach((d) => {
          submissions.push({
            id: d.id,
            ...d.data(),
            testId: testDoc.id,
            testName: testData.name || testData.title || testDoc.id,
          });
        });
      }
      setAllSubmissions(submissions);
    } catch (e) {
      console.error(e);
      setAllSubmissions([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCrtId) {
      setAllSubmissions([]);
      return;
    }
    fetchAllSubmissionsForCrt(selectedCrtId);
  }, [selectedCrtId, fetchAllSubmissionsForCrt]);

  // Aggregate by userId: exams attended, avg score %, highest score %
  // When useDummyData is true, use DUMMY_STUDENT_STATS instead of Firestore data
  const studentStats = useMemo(() => {
    if (useDummyData) return [...DUMMY_STUDENT_STATS];
    const byUser = new Map();
    for (const sub of allSubmissions) {
      const uid = sub.userId || "unknown";
      const percent =
        sub.autoScore ??
        (sub.total > 0 ? (sub.score / sub.total) * 100 : null);
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          userId: uid,
          userName: sub.userName || sub.userId || "Unknown",
          batchName: sub.batchName || null,
          examsAttended: 0,
          totalPercent: 0,
          maxPercent: null,
          lastSubmittedAt: null,
          submissions: [],
        });
      }
      const row = byUser.get(uid);
      row.examsAttended += 1;
      if (percent != null && !Number.isNaN(percent)) {
        row.totalPercent += percent;
        row.maxPercent =
          row.maxPercent == null
            ? percent
            : Math.max(row.maxPercent, percent);
      }
      if (sub.submittedAt) {
        const t = new Date(sub.submittedAt).getTime();
        if (!row.lastSubmittedAt || t > row.lastSubmittedAt) {
          row.lastSubmittedAt = t;
        }
      }
      row.submissions.push(sub);
    }
    return Array.from(byUser.values()).map((row) => ({
      ...row,
      avgScore:
        row.examsAttended > 0
          ? row.totalPercent / row.examsAttended
          : null,
    }));
  }, [allSubmissions, useDummyData]);

  const filteredAndSorted = useMemo(() => {
    let list = [...studentStats];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.userName && s.userName.toLowerCase().includes(q)) ||
          (s.userId && s.userId.toLowerCase().includes(q)) ||
          (s.batchName && s.batchName.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case "name":
        list.sort((a, b) =>
          (a.userName || "").localeCompare(b.userName || "", undefined, { sensitivity: "base" })
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
    const totalExams = useDummyData
      ? studentStats.reduce((acc, s) => acc + (s.examsAttended || 0), 0)
      : allSubmissions.length;
    const sumPercent = studentStats.reduce(
      (acc, s) => acc + (s.avgScore != null ? s.avgScore * (s.examsAttended || 0) : 0),
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
    };
  }, [studentStats, allSubmissions.length, useDummyData]);

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
            Student-wise exam attendance, average score, and highest score per CRT program.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CRT Program
            </label>
            <select
              value={selectedCrtId}
              onChange={(e) => setSelectedCrtId(e.target.value)}
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useDummyData}
              onChange={(e) => setUseDummyData(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm font-medium text-gray-700">Use demo data</span>
          </label>
          <button
            type="button"
            onClick={() => fetchAllSubmissionsForCrt(selectedCrtId)}
            disabled={loadingData || !selectedCrtId || useDummyData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700 disabled:opacity-50"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {loadingData ? "Loading…" : "Refresh"}
          </button>
        </div>

        {(selectedCrt || useDummyData) && (
          <div className="mb-6 p-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-gray-800">
              {useDummyData ? "Demo data" : (selectedCrt?.name || selectedCrtId)}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">
              {summary.totalStudents} student{summary.totalStudents !== 1 ? "s" : ""} · {summary.totalExams} exam attempt{summary.totalExams !== 1 ? "s" : ""}
            </span>
            {useDummyData && (
              <span className="ml-auto px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                Demo
              </span>
            )}
          </div>
        )}

        {loadingData && !useDummyData ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-cyan-300 border-t-cyan-600 rounded-full animate-spin" />
          </div>
        ) : !selectedCrtId && !useDummyData ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
            Select a CRT program to view analytics, or enable &quot;Use demo data&quot; to see sample data.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-100">
                    <AcademicCapIcon className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Students attempted</p>
                    <p className="text-2xl font-bold text-gray-800">{summary.totalStudents}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-violet-100">
                    <DocumentChartBarIcon className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total exam attempts</p>
                    <p className="text-2xl font-bold text-gray-800">{summary.totalExams}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100">
                    <ChartBarIcon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Overall avg score</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {summary.overallAvg != null ? `${Math.round(summary.overallAvg)}%` : "—"}
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
                    <p className="text-lg font-bold text-gray-800 truncate" title={summary.topScorer?.userName}>
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

            {/* Filters and table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[180px]">
                  <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or batch…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Sort by</label>
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
                      <th className="px-4 py-3 font-semibold">Student / User</th>
                      <th className="px-4 py-3 font-semibold">Batch</th>
                      <th className="px-4 py-3 font-semibold text-center">Exams attended</th>
                      <th className="px-4 py-3 font-semibold text-center">Avg score</th>
                      <th className="px-4 py-3 font-semibold text-center">Highest score</th>
                      <th className="px-4 py-3 font-semibold">Last attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-gray-500 text-sm"
                        >
                          {searchQuery.trim()
                            ? `No students match "${searchQuery}".`
                            : "No submissions for this CRT yet. Exams will appear here once students submit tests."}
                        </td>
                      </tr>
                    ) : (
                      filteredAndSorted.map((row, i) => (
                        <tr
                          key={row.userId}
                          className="border-t border-gray-100 hover:bg-cyan-50/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-500 tabular-nums font-medium">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-800">
                              {row.userName || row.userId || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">
                            {row.batchName || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold text-sm">
                              {row.examsAttended}
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
                              ? new Date(row.lastSubmittedAt).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
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
      </div>
    </div>
  );
}
