"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ExcelJS from "exceljs";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import {
  fetchMockTestGroup,
  fetchMockTestGroupSubmissions,
  deleteMockTestResultsForCandidate,
  deleteMockTestSubmission,
  getMockTestCompanyLabel,
} from "@/lib/mockTests";
import { ResultsPageSkeleton } from "@/components/PageSkeleton";
import {
  ArrowLeft,
  BarChart3,
  Download,
  Search,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PASS_MARK = 40;

function formatSubmittedAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreTone(percent) {
  if (percent >= 70) return "bg-emerald-100 text-emerald-800";
  if (percent >= PASS_MARK) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

function ScoreBadge({ value }) {
  const num = Number(value) || 0;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreTone(num)}`}>
      {Math.round(num)}%
    </span>
  );
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sectionScoresForRow(row) {
  const map = {};
  (row?.questionBreakdown || []).forEach((q) => {
    const name = String(q.section || "General").trim() || "General";
    if (!map[name]) {
      map[name] = { section: name, correct: 0, total: 0, codingEarned: 0, codingMax: 0 };
    }
    if (q.type === "coding") {
      map[name].codingMax += Number(q.maxScore) || 0;
      map[name].codingEarned += Number(q.score) || 0;
    } else {
      map[name].total += 1;
      if (q.correct) map[name].correct += 1;
    }
  });
  return map;
}

function formatSectionScore(s) {
  if (!s) return "—";
  const parts = [];
  if (s.total) parts.push(`${s.correct}/${s.total}`);
  if (s.codingMax) parts.push(`${Math.round(s.codingEarned)}/${s.codingMax}`);
  if (!parts.length) return "—";
  const earned = (s.correct || 0) + (Number(s.codingEarned) || 0);
  const max = (s.total || 0) + (Number(s.codingMax) || 0);
  const pct = max > 0 ? Math.round((earned / max) * 100) : null;
  return pct == null ? parts.join(" · ") : `${parts.join(" · ")} (${pct}%)`;
}

function ResultsInner() {
  const { companySlug } = useParams();
  const searchParams = useSearchParams();
  const initialTest = searchParams?.get("test") || "all";

  const [groupLabel, setGroupLabel] = useState("");
  const [tests, setTests] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testFilter, setTestFilter] = useState(initialTest);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [detail, setDetail] = useState(null);
  const [deletingKey, setDeletingKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [group, data] = await Promise.all([
          fetchMockTestGroup(companySlug),
          fetchMockTestGroupSubmissions(companySlug),
        ]);
        if (cancelled) return;
        setGroupLabel(group?.label || getMockTestCompanyLabel(companySlug));
        setTests(data.tests || []);
        setSubmissions(data.submissions || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) alert(e?.message || "Failed to load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  const rows = useMemo(() => {
    let list = submissions;
    if (testFilter !== "all") list = list.filter((s) => s.testId === testFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        [s.name, s.email, s.testTitle, s.userId, s.id].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "scoreDesc") return (Number(b.percent) || 0) - (Number(a.percent) || 0);
      if (sortBy === "scoreAsc") return (Number(a.percent) || 0) - (Number(b.percent) || 0);
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
    });
    return sorted;
  }, [submissions, testFilter, search, sortBy]);

  const sectionColumns = useMemo(() => {
    const names = new Set();
    rows.forEach((r) => {
      Object.keys(sectionScoresForRow(r)).forEach((n) => names.add(n));
    });
    const selected = tests.find((t) => t.id === testFilter);
    const sourceTests = testFilter === "all" ? tests : selected ? [selected] : tests;
    sourceTests.forEach((t) => {
      (Array.isArray(t.questions) ? t.questions : []).forEach((q) => {
        const n = String(q?.section || "").trim();
        if (n) names.add(n);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [rows, tests, testFilter]);

  const stats = useMemo(() => {
    const percents = rows.map((r) => Number(r.percent) || 0);
    const uniqueStudents = new Set(rows.map((r) => r.userId || r.email || r.id)).size;
    const passed = percents.filter((p) => p >= PASS_MARK).length;
    const mcqPercents = rows
      .filter((r) => Number(r.mcqTotal) > 0)
      .map((r) => ((Number(r.mcqCorrect) || 0) / Number(r.mcqTotal)) * 100);
    const codingPercents = rows
      .filter((r) => Number(r.codingMax) > 0)
      .map((r) => ((Number(r.codingScore) || 0) / Number(r.codingMax)) * 100);
    return {
      attempts: rows.length,
      uniqueStudents,
      avgScore: avg(percents),
      highest: percents.length ? Math.max(...percents) : 0,
      lowest: percents.length ? Math.min(...percents) : 0,
      passRate: rows.length ? (passed / rows.length) * 100 : 0,
      avgMcq: avg(mcqPercents),
      avgCoding: avg(codingPercents),
    };
  }, [rows]);

  const distribution = useMemo(() => {
    const bands = [
      { key: "0-39", label: "0–39%", min: 0, max: 39, fill: "#e11d48" },
      { key: "40-59", label: "40–59%", min: 40, max: 59, fill: "#f59e0b" },
      { key: "60-79", label: "60–79%", min: 60, max: 79, fill: "#0ea5e9" },
      { key: "80-100", label: "80–100%", min: 80, max: 100, fill: "#059669" },
    ];
    return bands.map((b) => ({
      ...b,
      count: rows.filter((r) => {
        const p = Number(r.percent) || 0;
        return p >= b.min && p <= b.max;
      }).length,
    }));
  }, [rows]);

  const perTest = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const id = r.testId;
      if (!map[id]) {
        map[id] = { testId: id, title: r.testTitle || id, percents: [], count: 0 };
      }
      map[id].count += 1;
      map[id].percents.push(Number(r.percent) || 0);
    });
    return Object.values(map)
      .map((t) => ({
        ...t,
        avg: avg(t.percents),
        high: t.percents.length ? Math.max(...t.percents) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const sectionAnalytics = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      (r.questionBreakdown || []).forEach((q) => {
        const key = q.section || "General";
        if (!map[key]) map[key] = { section: key, correct: 0, total: 0, codingEarned: 0, codingMax: 0 };
        if (q.type === "mcq") {
          map[key].total += 1;
          if (q.correct) map[key].correct += 1;
        } else {
          map[key].codingMax += Number(q.maxScore) || 0;
          map[key].codingEarned += Number(q.score) || 0;
        }
      });
    });
    return Object.values(map)
      .map((s) => ({
        ...s,
        mcqPct: s.total ? Math.round((s.correct / s.total) * 100) : null,
        codingPct: s.codingMax ? Math.round((s.codingEarned / s.codingMax) * 100) : null,
      }))
      .sort((a, b) => (a.mcqPct ?? 999) - (b.mcqPct ?? 999));
  }, [rows]);

  const weakQuestions = useMemo(() => {
    if (testFilter === "all") return [];
    const test = tests.find((t) => t.id === testFilter);
    const qs = Array.isArray(test?.questions) ? test.questions : [];
    const map = {};
    rows.forEach((r) => {
      (r.questionBreakdown || []).forEach((q) => {
        if (q.type !== "mcq") return;
        if (!map[q.i]) map[q.i] = { i: q.i, correct: 0, total: 0 };
        map[q.i].total += 1;
        if (q.correct) map[q.i].correct += 1;
      });
    });
    return Object.values(map)
      .map((q) => ({
        ...q,
        pct: q.total ? Math.round((q.correct / q.total) * 100) : 0,
        text: String(qs[q.i]?.question || qs[q.i]?.title || `Question ${q.i + 1}`).slice(0, 90),
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 8);
  }, [rows, testFilter, tests]);

  async function downloadExcel() {
    if (!rows.length) {
      alert("No results to download.");
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Results");
    ws.addRow([
      "Name",
      "Email",
      "Test",
      "MCQ",
      "Coding",
      ...sectionColumns.map((s) => s),
      "Score %",
      "Submitted",
    ]);
    rows.forEach((r) => {
      const bySection = sectionScoresForRow(r);
      ws.addRow([
        r.name || "",
        r.email || "",
        r.testTitle || r.testId,
        `${r.mcqCorrect ?? 0}/${r.mcqTotal ?? 0}`,
        r.codingMax ? `${Math.round(r.codingScore || 0)}/${r.codingMax}` : "",
        ...sectionColumns.map((s) => formatSectionScore(bySection[s])),
        r.percent ?? 0,
        formatSubmittedAt(r.submittedAt),
      ]);
    });
    const summary = wb.addWorksheet("Summary");
    summary.addRow(["Metric", "Value"]);
    summary.addRow(["Attempts", stats.attempts]);
    summary.addRow(["Students", stats.uniqueStudents]);
    summary.addRow(["Average score", Math.round(stats.avgScore)]);
    summary.addRow(["Pass rate", `${Math.round(stats.passRate)}%`]);
    summary.addRow(["Highest", Math.round(stats.highest)]);
    summary.addRow(["Lowest", Math.round(stats.lowest)]);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mock-test-results-${companySlug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function candidateLabel(row) {
    return row?.name || row?.email || row?.userId || "this candidate";
  }

  async function handleDeleteAttempt(row, e) {
    e?.stopPropagation?.();
    const testId = row?.testId;
    const submissionId = row?.id || row?.userId;
    if (!testId || !submissionId) {
      alert("Cannot delete this result.");
      return;
    }
    const ok = confirm(
      `Delete this result for ${candidateLabel(row)} on "${row.testTitle || testId}"?`
    );
    if (!ok) return;
    const key = `${testId}-${submissionId}`;
    setDeletingKey(key);
    try {
      await deleteMockTestSubmission(companySlug, testId, submissionId);
      setSubmissions((prev) =>
        prev.filter((s) => !(s.testId === testId && (s.id === submissionId || s.userId === submissionId)))
      );
      if (detail && detail.testId === testId && (detail.id === submissionId || detail.userId === submissionId)) {
        setDetail(null);
      }
    } catch (err) {
      alert(err?.message || "Failed to delete result.");
    } finally {
      setDeletingKey("");
    }
  }

  async function handleDeleteCandidate(row, e) {
    e?.stopPropagation?.();
    const ok = confirm(
      `Delete ALL mock-test results for ${candidateLabel(row)} in this group?`
    );
    if (!ok) return;
    const key = `all-${row.userId || row.email || row.id}`;
    setDeletingKey(key);
    try {
      const count = await deleteMockTestResultsForCandidate(companySlug, row);
      const userId = String(row.userId || row.id || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      setSubmissions((prev) =>
        prev.filter((s) => {
          if (userId && (s.userId === userId || s.id === userId)) return false;
          if (email && String(s.email || "").trim().toLowerCase() === email) return false;
          return true;
        })
      );
      setDetail(null);
      alert(count ? `Deleted ${count} result(s).` : "No results found to delete.");
    } catch (err) {
      alert(err?.message || "Failed to delete candidate results.");
    } finally {
      setDeletingKey("");
    }
  }

  const selectedTest = tests.find((t) => t.id === testFilter);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Link
          href={`/Admin/mock-test/${companySlug}`}
          className="inline-flex items-center gap-2 text-sm text-[#00448a] hover:underline mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tests
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#00448a] text-white flex items-center justify-center">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Results & analytics</h1>
              <p className="text-sm text-slate-600">
                {groupLabel || companySlug}
                {selectedTest ? ` · ${selectedTest.title}` : " · all tests"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download Excel
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={testFilter}
            onChange={(e) => setTestFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">All tests</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || t.id}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or test"
              className="w-full border rounded-lg pl-9 pr-9 py-2 text-sm bg-white"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="recent">Newest first</option>
            <option value="scoreDesc">Highest score</option>
            <option value="scoreAsc">Lowest score</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {loading ? (
          <ResultsPageSkeleton />
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border">
            No submissions yet. Results appear after a student finishes and submits.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border">
            No results match “{search || "this filter"}”.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Attempts", value: stats.attempts, icon: Users },
                { label: "Students", value: stats.uniqueStudents, icon: Users },
                { label: "Average score", value: `${Math.round(stats.avgScore)}%`, icon: BarChart3 },
                { label: `Pass rate (≥${PASS_MARK}%)`, value: `${Math.round(stats.passRate)}%`, icon: Trophy },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-900 mb-3">Score distribution</h2>
                <div className="h-[224px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height={224} minWidth={0} minHeight={0}>
                    <BarChart data={distribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {distribution.map((d) => (
                          <Cell key={d.key} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-900 mb-3">Performance snapshot</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500">Highest</dt>
                    <dd className="text-lg font-bold text-emerald-700">{Math.round(stats.highest)}%</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500">Lowest</dt>
                    <dd className="text-lg font-bold text-rose-700">{Math.round(stats.lowest)}%</dd>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3">
                    <dt className="text-slate-500">Avg MCQ</dt>
                    <dd className="text-lg font-bold text-blue-800">{Math.round(stats.avgMcq)}%</dd>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3">
                    <dt className="text-slate-500">Avg coding</dt>
                    <dd className="text-lg font-bold text-violet-800">{Math.round(stats.avgCoding)}%</dd>
                  </div>
                </dl>
                {perTest.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-slate-500 mb-2">By test</p>
                    <div className="space-y-2 max-h-36 overflow-auto">
                      {perTest.map((t) => (
                        <div key={t.testId} className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{t.title}</span>
                          <span className="shrink-0 text-slate-600">
                            {t.count} · {Math.round(t.avg)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {sectionAnalytics.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <h2 className="font-semibold text-slate-900 mb-3">Section-wise accuracy</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">Section</th>
                        <th className="py-2">MCQ</th>
                        <th className="py-2">Coding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionAnalytics.map((s) => (
                        <tr key={s.section} className="border-t">
                          <td className="py-2 font-medium">{s.section}</td>
                          <td className="py-2">{s.mcqPct == null ? "—" : `${s.mcqPct}% (${s.correct}/${s.total})`}</td>
                          <td className="py-2">{s.codingPct == null ? "—" : `${s.codingPct}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {weakQuestions.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <h2 className="font-semibold text-slate-900 mb-1">Hardest MCQs</h2>
                <p className="text-xs text-slate-500 mb-3">Lowest accuracy for the selected test.</p>
                <ol className="space-y-2 text-sm">
                  {weakQuestions.map((q) => (
                    <li key={q.i} className="flex items-start justify-between gap-3">
                      <span className="text-slate-700">
                        Q{q.i + 1}. {q.text}
                      </span>
                      <span className={`shrink-0 ${q.pct < 40 ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
                        {q.pct}% ({q.correct}/{q.total})
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">
                  {rows.length} student{rows.length === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Test</th>
                      {sectionColumns.map((section) => (
                        <th key={section} className="px-4 py-3 font-semibold whitespace-nowrap">
                          {section}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold">MCQ</th>
                      <th className="px-4 py-3 font-semibold">Coding</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const bySection = sectionScoresForRow(row);
                      const submissionId = row.id || row.userId;
                      const rowKey = `${row.testId}-${submissionId}`;
                      return (
                      <tr
                        key={rowKey}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setDetail(row)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{row.testTitle || row.testId}</td>
                        {sectionColumns.map((section) => (
                          <td key={section} className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {formatSectionScore(bySection[section])}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          {row.mcqCorrect ?? 0} / {row.mcqTotal ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {row.codingMax
                            ? `${Math.round(row.codingScore || 0)} / ${row.codingMax}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBadge value={row.percent} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatSubmittedAt(row.submittedAt)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            title="Delete this result"
                            disabled={!!deletingKey}
                            onClick={(e) => handleDeleteAttempt(row, e)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-xs text-slate-500">
                Click a row for question-level detail. Use the trash icon to delete that candidate’s result.
              </p>
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-slate-900">{detail.name || "Student"}</h3>
                <p className="text-sm text-slate-500">{detail.email}</p>
                <p className="text-sm text-slate-600 mt-1">{detail.testTitle}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <ScoreBadge value={detail.percent} />
                <span className="text-sm text-slate-600">
                  MCQ {detail.mcqCorrect ?? 0}/{detail.mcqTotal ?? 0}
                </span>
                {detail.codingMax ? (
                  <span className="text-sm text-slate-600">
                    Coding {Math.round(detail.codingScore || 0)}/{detail.codingMax}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">Submitted {formatSubmittedAt(detail.submittedAt)}</p>
              {Object.keys(sectionScoresForRow(detail)).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Section-wise result</h4>
                  <div className="space-y-2">
                    {Object.values(sectionScoresForRow(detail)).map((s) => (
                      <div
                        key={s.section}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-800">{s.section}</span>
                        <span className="text-slate-700">{formatSectionScore(s)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(detail.questionBreakdown) && detail.questionBreakdown.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {detail.questionBreakdown.map((q) => (
                    <li
                      key={`${q.type}-${q.i}`}
                      className={`rounded-lg px-3 py-2 ${
                        q.type === "mcq"
                          ? q.correct
                            ? "bg-emerald-50 text-emerald-800"
                            : q.unanswered
                              ? "bg-slate-100 text-slate-600"
                              : "bg-rose-50 text-rose-800"
                          : "bg-violet-50 text-violet-800"
                      }`}
                    >
                      {q.type === "mcq"
                        ? `Q${q.i + 1} MCQ · ${q.section}${q.unanswered ? " · skipped" : q.correct ? " · correct" : " · wrong"}`
                        : `Q${q.i + 1} Coding · ${q.section} · ${q.passed || 0}/${q.totalCases || 0} cases`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Question-level detail is available for attempts submitted after this analytics update.
                </p>
              )}
              <div className="pt-2 flex flex-wrap gap-2 border-t">
                <button
                  type="button"
                  disabled={!!deletingKey}
                  onClick={(e) => handleDeleteAttempt(detail, e)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete this result
                </button>
                <button
                  type="button"
                  disabled={!!deletingKey}
                  onClick={(e) => handleDeleteCandidate(detail, e)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete all for this candidate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMockTestResultsPage() {
  return (
    <CheckAdminAuth>
      <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6"><ResultsPageSkeleton /></div>}>
        <ResultsInner />
      </Suspense>
    </CheckAdminAuth>
  );
}
