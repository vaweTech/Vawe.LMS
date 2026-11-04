"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import {
  ASSIGNMENT_PASS_PERCENT,
  assignmentPercent,
  correctOptionIndexes,
  downloadCsv,
  mcqQuestionCredit,
  normalizeMcqSelection,
  resultLabel,
  toDate,
} from "@/lib/assignmentScores";

const STATUS_STYLES = {
  success: { label: "Full marks", cls: "bg-emerald-100 text-emerald-800" },
  pass: { label: "Pass", cls: "bg-emerald-50 text-emerald-700" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-800" },
  fail: { label: `Below ${ASSIGNMENT_PASS_PERCENT}%`, cls: "bg-red-100 text-red-800" },
  submitted: { label: "Submitted", cls: "bg-slate-100 text-slate-700" },
};

function StatCard({ label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "text-slate-800",
    cyan: "text-cyan-700",
    emerald: "text-emerald-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function formatDateTime(d) {
  return d
    ? d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

function McqAnswerReview({ assignment, submission }) {
  const questions = assignment.questions || [];
  if (questions.length === 0) return <p className="text-sm text-gray-500">No questions on this assignment.</p>;
  return (
    <ol className="space-y-3">
      {questions.map((q, i) => {
        const picked = normalizeMcqSelection(submission.mcqAnswers?.[i]);
        const correct = correctOptionIndexes(q);
        const credit = mcqQuestionCredit(q, submission.mcqAnswers?.[i]);
        const options = Array.isArray(q.options) ? q.options : [];
        const verdict =
          picked.length === 0
            ? { text: "Not answered", cls: "text-slate-500" }
            : credit === 1
              ? { text: "Correct", cls: "text-emerald-700" }
              : credit > 0
                ? { text: `Partly correct (${Math.round(credit * 100)}%)`, cls: "text-amber-700" }
                : { text: "Wrong", cls: "text-red-700" };
        return (
          <li key={i} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">
                {i + 1}. {q.question || "Question"}
              </p>
              <span className={`shrink-0 text-xs font-semibold ${verdict.cls}`}>{verdict.text}</span>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {options.map((opt, oi) => {
                const isPicked = picked.includes(oi);
                const isCorrect = correct.includes(oi);
                return (
                  <li
                    key={oi}
                    className={`rounded px-2 py-1 text-xs ${
                      isCorrect
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                        : isPicked
                          ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                          : "text-gray-600"
                    }`}
                  >
                    {String.fromCharCode(65 + oi)}. {String(opt)}
                    {isPicked ? " — student's choice" : ""}
                    {isCorrect ? " ✓" : ""}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function CodingReview({ submission }) {
  const ts = submission.testSummary;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">
        Language: <span className="font-medium">{submission.language || "—"}</span>
        {ts?.totalCount ? (
          <>
            {" "}· Test cases passed:{" "}
            <span className="font-medium">
              {ts.passCount || 0}/{ts.totalCount}
            </span>
          </>
        ) : null}
      </p>
      {submission.codingSolution ? (
        <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">
          {submission.codingSolution}
        </pre>
      ) : (
        <p className="text-sm text-gray-500">No code saved with this submission.</p>
      )}
    </div>
  );
}

export default function AssignmentSubmissionsReport({ submissions, assignment, contextLabel }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("scoreDesc");
  const [expandedId, setExpandedId] = useState(null);

  const rows = useMemo(
    () =>
      submissions.map((s) => ({
        ...s,
        percent: assignmentPercent(s),
        status: resultLabel(s),
        submittedDate: toDate(s.submittedAt),
      })),
    [submissions]
  );

  const stats = useMemo(() => {
    const scored = rows.filter((r) => r.percent != null);
    const passed = scored.filter((r) => r.percent >= ASSIGNMENT_PASS_PERCENT).length;
    return {
      total: rows.length,
      avg: scored.length ? scored.reduce((a, r) => a + r.percent, 0) / scored.length : null,
      passed,
      failed: scored.length - passed,
      highest: scored.length ? Math.max(...scored.map((r) => r.percent)) : null,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q && !String(r.studentName || r.studentId || "").toLowerCase().includes(q)) return false;
      if (statusFilter === "pass") return r.percent != null && r.percent >= ASSIGNMENT_PASS_PERCENT;
      if (statusFilter === "fail") return r.percent != null && r.percent < ASSIGNMENT_PASS_PERCENT;
      return true;
    });
    const byScore = (a, b) => (a.percent ?? -1) - (b.percent ?? -1);
    const byTime = (a, b) => (a.submittedDate?.getTime() || 0) - (b.submittedDate?.getTime() || 0);
    const sorters = {
      scoreDesc: (a, b) => byScore(b, a),
      scoreAsc: byScore,
      latest: (a, b) => byTime(b, a),
      earliest: byTime,
      name: (a, b) => String(a.studentName || "").localeCompare(String(b.studentName || ""), undefined, { sensitivity: "base" }),
    };
    return [...list].sort(sorters[sortBy] || sorters.scoreDesc);
  }, [rows, query, statusFilter, sortBy]);

  const isMcq = assignment.type === "mcq";

  const exportCsv = () => {
    const header = ["#", "Student", "Student ID", "Status", isMcq ? "Marks" : "Test cases passed", "Score %", "Submitted"];
    const body = visible.map((r, i) => {
      const ts = r.testSummary;
      const marks = isMcq
        ? ts?.maxScore
          ? `${Math.round((ts.partialScore || 0) * 100) / 100}/${ts.maxScore}`
          : ""
        : ts?.totalCount
          ? `${ts.passCount || 0}/${ts.totalCount}`
          : "";
      return [
        i + 1,
        r.studentName || "",
        r.studentId || "",
        STATUS_STYLES[r.status]?.label || r.status,
        marks,
        r.percent != null ? Math.round(r.percent * 10) / 10 : "",
        formatDateTime(r.submittedDate),
      ];
    });
    downloadCsv(`${assignment.title || "assignment"}_day${assignment.day || 1}_results.csv`, [header, ...body]);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{assignment.title || "Assignment"}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {contextLabel ? `${contextLabel} · ` : ""}
              {String(assignment.type || "").toUpperCase()} · Day {assignment.day || 1}
              {Array.isArray(assignment.questions) ? ` · ${assignment.questions.length} question(s)` : ""}
            </p>
          </div>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Submissions" value={stats.total} tone="cyan" />
          <StatCard
            label="Average score"
            value={stats.avg != null ? `${Math.round(stats.avg)}%` : "—"}
            hint={stats.highest != null ? `Highest ${Math.round(stats.highest)}%` : undefined}
          />
          <StatCard label={`Passed (≥${ASSIGNMENT_PASS_PERCENT}%)`} value={stats.passed} tone="emerald" />
          <StatCard label={`Below ${ASSIGNMENT_PASS_PERCENT}%`} value={stats.failed} tone="red" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-gray-500">No submissions yet for this assignment.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student…"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              aria-label="Filter by result"
            >
              <option value="all">All results</option>
              <option value="pass">Passed only</option>
              <option value="fail">Below {ASSIGNMENT_PASS_PERCENT}% only</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              aria-label="Sort"
            >
              <option value="scoreDesc">Score (high first)</option>
              <option value="scoreAsc">Score (low first)</option>
              <option value="latest">Latest submitted</option>
              <option value="earliest">Earliest submitted</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 text-center font-semibold">Result</th>
                  <th className="px-4 py-3 text-center font-semibold">{isMcq ? "Marks" : "Test cases"}</th>
                  <th className="px-4 py-3 text-center font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      No submissions match these filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((r, i) => {
                    const open = expandedId === r.id;
                    const style = STATUS_STYLES[r.status] || STATUS_STYLES.submitted;
                    const ts = r.testSummary;
                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedId(open ? null : r.id)}
                          className={`cursor-pointer border-t border-gray-100 transition-colors hover:bg-cyan-50/40 ${open ? "bg-cyan-50/60" : ""}`}
                        >
                          <td className="px-4 py-3 font-medium tabular-nums text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              {open ? (
                                <ChevronDown className="h-4 w-4 text-cyan-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" aria-expanded={open} className="text-left font-medium text-gray-800 hover:text-cyan-700">
                              {r.studentName || r.studentId || "Unknown"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.cls}`}>{style.label}</span>
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                            {isMcq
                              ? ts?.maxScore
                                ? `${Math.round((ts.partialScore || 0) * 100) / 100}/${ts.maxScore}`
                                : "—"
                              : ts?.totalCount
                                ? `${ts.passCount || 0}/${ts.totalCount}`
                                : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.percent != null ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                                  r.percent >= 70
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.percent >= ASSIGNMENT_PASS_PERCENT
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-red-100 text-red-800"
                                }`}
                              >
                                {Math.round(r.percent)}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">Not scored</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDateTime(r.submittedDate)}</td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={6} className="px-4 pb-4 pt-2">
                              {isMcq ? (
                                <McqAnswerReview assignment={assignment} submission={r} />
                              ) : (
                                <CodingReview submission={r} />
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
