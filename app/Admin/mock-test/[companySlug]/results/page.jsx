"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ExcelJS from "exceljs";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { db } from "@/lib/firebase";
import { makeAuthenticatedRequest } from "@/lib/authUtils";
import {
  fetchMockTestGroup,
  fetchMockTestGroupSubmissions,
  deleteMockTestResultsForCandidate,
  deleteMockTestSubmission,
  getMockTestCompanyLabel,
  normalizeMockSectionScores,
  normalizeMockSubSectionScores,
  mockSubSectionScoreKey,
  mockSubSectionScoreLabel,
  getMockQuestionSubSection,
} from "@/lib/mockTests";
import { ResultsPageSkeleton } from "@/components/PageSkeleton";
import {
  ArrowLeft,
  BarChart3,
  Code2,
  Download,
  FileDown,
  MessageCircle,
  Search,
  Target,
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

import {
  MOCK_RESULT_WA_TEMPLATE,
  buildMockExamReportScorecardPayload,
  buildMockResultWhatsAppParams,
} from "@/lib/mockTestResultWhatsApp";
import { downloadMockTestScorecardPdf } from "@/lib/mockTestScorecardPdf";

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
    <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-semibold ${scoreTone(num)}`}>
      {Math.round(num)}%
    </span>
  );
}

function ProgressBar({ value, tone = "bg-[#00448a]" }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sectionScoresForRow(row) {
  return normalizeMockSectionScores(row?.sectionScores, row?.questionBreakdown);
}

function subSectionScoresForRow(row) {
  return normalizeMockSubSectionScores(row?.subSectionScores, row?.questionBreakdown);
}

function formatSectionScore(s) {
  if (!s || !(s.max || s.total || s.codingMax)) return "—";
  const earned = Number(s.earned != null ? s.earned : (s.correct || 0) + (Number(s.codingEarned) || 0));
  const max = Number(s.max != null ? s.max : (s.total || 0) + (Number(s.codingMax) || 0));
  if (max <= 0) return "—";
  const pct = s.percent != null ? Math.round(Number(s.percent) || 0) : Math.round((earned / max) * 100);
  return `${Math.round(earned)}/${max} (${pct}%)`;
}

async function loadStudentDirectory() {
  const byId = new Map();
  const byEmail = new Map();
  if (!db) return { byId, byEmail };

  try {
    const snap = await getDocs(collection(db, "students"));
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      byId.set(d.id, data);
      const email = String(data.email || "").trim().toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, data);
    });
  } catch {
    /* empty directory */
  }
  return { byId, byEmail };
}

async function loadUsersByIds(userIds) {
  const byId = new Map();
  if (!db || !userIds.length) return byId;

  const unique = [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const chunkSize = 40;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) byId.set(uid, snap.data());
        } catch {
          /* skip */
        }
      })
    );
  }
  return byId;
}

function pickContactPhone(data) {
  return String(data?.phone1 || data?.phone || data?.phone2 || data?.mobile || "").trim();
}

function looksLikeMobilePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith("91")) return true;
  if (digits.length === 11 && digits.startsWith("0")) return true;
  return false;
}

/** Phone from the result itself — used when the candidate is not in Student Info. */
function pickSubmissionPhone(row) {
  const direct = pickContactPhone(row);
  if (direct) return direct;
  const uid = String(row?.userId || row?.id || "").trim();
  if (
    looksLikeMobilePhone(uid) &&
    (row?.source === "public_link" || !String(row?.email || "").trim())
  ) {
    return uid.replace(/\D/g, "").slice(-10);
  }
  return "";
}

function collectRoles(data) {
  if (!data) return [];
  const roles = [];
  if (data.role) roles.push(data.role);
  if (Array.isArray(data.roles)) roles.push(...data.roles);
  return roles.map((r) => String(r || "").trim()).filter(Boolean);
}

function isStaffRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return false;
  if (
    value === "admin" ||
    value === "superadmin" ||
    value === "collegeadmin" ||
    value === "trainer" ||
    value === "crttrainer" ||
    value === "dataentry" ||
    value === "manager" ||
    value === "staff"
  ) {
    return true;
  }
  if (value.includes("trainer")) return true;
  if (value.includes("admin") && !value.includes("student")) return true;
  return false;
}

function buildRecipientInfo(studentData, userData, submissionPhone = "") {
  const allRoles = [...collectRoles(userData), ...collectRoles(studentData)];
  // Only treat as staff when they actually exist in Student Info / users.
  const knownInDirectory = Boolean(studentData || userData);
  if (knownInDirectory && allRoles.some(isStaffRole)) {
    return { phone: "", eligible: false, skipReason: "staff" };
  }
  // Prefer Student Info / user profile; fall back to phone on the mock result
  // so public-link / non–Student Info candidates still get WhatsApp.
  const phone =
    pickContactPhone(studentData) ||
    pickContactPhone(userData) ||
    String(submissionPhone || "").trim();
  if (!phone) {
    return { phone: "", eligible: true, skipReason: "no_phone" };
  }
  return { phone, eligible: true, skipReason: "" };
}

/** One directory load + parallel user lookups — fast for large recipient lists. */
async function resolveRecipientsForRows(list) {
  const out = new Map();
  if (!list.length) return out;

  // Skip Firebase user lookups for public-link phones (userId is the mobile number).
  const authUserIds = list
    .map((row) => String(row.userId || row.id || "").trim())
    .filter((uid) => uid && !looksLikeMobilePhone(uid));

  const [{ byId: studentsById, byEmail: studentsByEmail }, usersById] = await Promise.all([
    loadStudentDirectory(),
    loadUsersByIds(authUserIds),
  ]);

  for (const row of list) {
    const key = String(row.userId || row.id || row.email || row.phone || "");
    if (!key || out.has(key)) continue;

    const uid = String(row.userId || row.id || "").trim();
    const mail = String(row.email || "").trim().toLowerCase();
    const submissionPhone = pickSubmissionPhone(row);
    const studentData =
      (!looksLikeMobilePhone(uid) && uid && studentsById.get(uid)) ||
      (mail && studentsByEmail.get(mail)) ||
      null;
    const userData =
      (!looksLikeMobilePhone(uid) && uid && usersById.get(uid)) || null;
    out.set(key, buildRecipientInfo(studentData, userData, submissionPhone));
  }

  return out;
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
  const [waSending, setWaSending] = useState(false);
  const [waSendingRowKey, setWaSendingRowKey] = useState("");
  const [pdfBusyKey, setPdfBusyKey] = useState("");

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

  const subSectionColumns = useMemo(() => {
    const map = new Map();
    const add = (section, subSection) => {
      const sec = String(section || "General").trim() || "General";
      const sub = String(subSection || "General").trim() || "General";
      const key = mockSubSectionScoreKey(sec, sub);
      if (!map.has(key)) {
        map.set(key, {
          key,
          section: sec,
          subSection: sub,
          label: mockSubSectionScoreLabel(sec, sub),
        });
      }
    };
    rows.forEach((r) => {
      Object.values(subSectionScoresForRow(r)).forEach((s) => {
        add(s.section, s.subSection);
      });
    });
    const selected = tests.find((t) => t.id === testFilter);
    const sourceTests = testFilter === "all" ? tests : selected ? [selected] : tests;
    sourceTests.forEach((t) => {
      (Array.isArray(t.questions) ? t.questions : []).forEach((q) => {
        const sec = String(q?.section || "").trim();
        if (!sec) return;
        add(sec, getMockQuestionSubSection(q) || "General");
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const sec = a.section.localeCompare(b.section);
      if (sec !== 0) return sec;
      return a.subSection.localeCompare(b.subSection);
    });
  }, [rows, tests, testFilter]);

  const scoreColumns = useMemo(
    () => (subSectionColumns.length > 0 ? subSectionColumns : sectionColumns.map((s) => ({
      key: s,
      section: s,
      subSection: s,
      label: s,
    }))),
    [subSectionColumns, sectionColumns]
  );

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
      Object.values(sectionScoresForRow(r)).forEach((s) => {
        const key = s.section || "General";
        if (!map[key]) {
          map[key] = {
            section: key,
            correct: 0,
            total: 0,
            codingEarned: 0,
            codingMax: 0,
            earned: 0,
            max: 0,
          };
        }
        map[key].correct += Number(s.correct) || 0;
        map[key].total += Number(s.total) || 0;
        map[key].codingEarned += Number(s.codingEarned) || 0;
        map[key].codingMax += Number(s.codingMax) || 0;
        map[key].earned += Number(s.earned) || 0;
        map[key].max += Number(s.max) || 0;
      });
    });
    return Object.values(map)
      .map((s) => ({
        ...s,
        percent: s.max > 0 ? Math.round((s.earned / s.max) * 100) : 0,
        mcqPct: s.total ? Math.round((s.correct / s.total) * 100) : null,
        codingPct: s.codingMax ? Math.round((s.codingEarned / s.codingMax) * 100) : null,
      }))
      .sort((a, b) => a.section.localeCompare(b.section));
  }, [rows]);

  const subSectionAnalytics = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      Object.values(subSectionScoresForRow(r)).forEach((s) => {
        const key = s.key || mockSubSectionScoreKey(s.section, s.subSection);
        if (!map[key]) {
          map[key] = {
            key,
            section: s.section || "General",
            subSection: s.subSection || "General",
            label: s.label || mockSubSectionScoreLabel(s.section, s.subSection),
            correct: 0,
            total: 0,
            codingEarned: 0,
            codingMax: 0,
            earned: 0,
            max: 0,
          };
        }
        map[key].correct += Number(s.correct) || 0;
        map[key].total += Number(s.total) || 0;
        map[key].codingEarned += Number(s.codingEarned) || 0;
        map[key].codingMax += Number(s.codingMax) || 0;
        map[key].earned += Number(s.earned) || 0;
        map[key].max += Number(s.max) || 0;
      });
    });
    return Object.values(map)
      .map((s) => ({
        ...s,
        percent: s.max > 0 ? Math.round((s.earned / s.max) * 100) : 0,
      }))
      .sort((a, b) => {
        const sec = a.section.localeCompare(b.section);
        if (sec !== 0) return sec;
        return a.subSection.localeCompare(b.subSection);
      });
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
      ...subSectionColumns.map((s) => s.label),
      "Score %",
      "Submitted",
    ]);
    rows.forEach((r) => {
      const bySection = sectionScoresForRow(r);
      const bySub = subSectionScoresForRow(r);
      ws.addRow([
        r.name || "",
        r.email || "",
        r.testTitle || r.testId,
        `${r.mcqCorrect ?? 0}/${r.mcqTotal ?? 0}`,
        r.codingMax ? `${Math.round(r.codingScore || 0)}/${r.codingMax}` : "",
        ...sectionColumns.map((s) => formatSectionScore(bySection[s])),
        ...subSectionColumns.map((s) => formatSectionScore(bySub[s.key])),
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

  async function downloadPdfScorecard(row, e) {
    e?.stopPropagation?.();
    if (!row) return;
    const key = `${row.testId}-${row.id || row.userId || row.email || "row"}`;
    setPdfBusyKey(key);
    try {
      await downloadMockTestScorecardPdf(row, {
        companyLabel: groupLabel || companySlug,
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to download PDF scorecard.");
    } finally {
      setPdfBusyKey("");
    }
  }

  async function downloadAllPdfScorecards() {
    if (!rows.length) {
      alert("No results to download.");
      return;
    }
    if (
      !confirm(
        `Download ${rows.length} scorecard PDF${rows.length === 1 ? "" : "s"}? Your browser may ask to allow multiple downloads.`
      )
    ) {
      return;
    }
    setPdfBusyKey("all");
    try {
      for (const row of rows) {
        await downloadMockTestScorecardPdf(row, {
          companyLabel: groupLabel || companySlug,
        });
        // Brief pause so browsers don't block successive downloads.
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed while downloading scorecards.");
    } finally {
      setPdfBusyKey("");
    }
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

  async function sendWhatsAppResults(targetRows, { single = false } = {}) {
    const list = Array.isArray(targetRows) ? targetRows.filter(Boolean) : [];
    if (!list.length) {
      alert("No results to send.");
      return;
    }

    const ok = confirm(
      single
        ? `Send exam_report WhatsApp to ${candidateLabel(list[0])}?`
        : `Send exam_report WhatsApp to ${list.length} student${list.length === 1 ? "" : "s"} (current filter)?`
    );
    if (!ok) return;

    if (single) {
      setWaSendingRowKey(`${list[0].testId}-${list[0].id || list[0].userId}`);
    } else {
      setWaSending(true);
    }

    try {
      const recipientInfo = await resolveRecipientsForRows(list);
      let skippedNoPhone = 0;
      let skippedStaff = 0;
      const recipients = [];

      for (const row of list) {
        const key = String(row.userId || row.id || row.email || row.phone || "");
        const info = recipientInfo.get(key) || { phone: "", eligible: false, skipReason: "no_phone" };
        if (!info.eligible) {
          if (info.skipReason === "staff") skippedStaff += 1;
          else skippedNoPhone += 1;
          continue;
        }
        if (!info.phone) {
          skippedNoPhone += 1;
          continue;
        }
        recipients.push({
          id: row.userId || row.id || null,
          name: row.name || "Student",
          phone: info.phone,
          bodyParams: buildMockResultWhatsAppParams(row),
          scorecardRow: buildMockExamReportScorecardPayload({
            ...row,
            phone: info.phone || row.phone || "",
          }),
          companyLabel: groupLabel || companySlug || "Mock Test",
        });
      }

      if (!recipients.length) {
        alert(
          [
            "No eligible students to message.",
            skippedStaff ? `Skipped trainer/admin: ${skippedStaff}` : null,
            skippedNoPhone ? `Skipped (no phone): ${skippedNoPhone}` : null,
            "Need a phone in Student Info, or on the result (public-link registration).",
          ]
            .filter(Boolean)
            .join("\n")
        );
        return;
      }

      const parallel = Math.min(8, Math.max(3, recipients.length));
      const res = await makeAuthenticatedRequest("/api/send-whatsapp-bulk", {
        method: "POST",
        body: JSON.stringify({
          template: MOCK_RESULT_WA_TEMPLATE,
          recipients,
          concurrency: parallel,
          companyLabel: groupLabel || companySlug || "Mock Test",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to send WhatsApp messages");
      }

      const sent = Number(data.sent || 0);
      const failed = Number(data.failed || 0);
      const firstErrObj = Array.isArray(data.errors) && data.errors[0] ? data.errors[0] : null;
      const firstError = firstErrObj?.error ? `\nFirst error: ${firstErrObj.error}` : "";
      const isMissingTemplate =
        Number(firstErrObj?.errorCode) === 132001 ||
        /template name does not exist/i.test(String(firstErrObj?.error || ""));
      const templateHint = isMissingTemplate
        ? `\n\nFix in Meta WhatsApp Manager:\n1) Open Message templates for this WABA\n2) Create/approve template named "${MOCK_RESULT_WA_TEMPLATE}" (or set WHATSAPP_MOCK_EXAM_REPORT_TEMPLATE_NAME to your exact approved name)\n3) Language must match (usually en or en_US)\n4) Status must be Approved`
        : "";
      alert(
        [
          `WhatsApp ${MOCK_RESULT_WA_TEMPLATE} sent: ${sent}/${recipients.length}`,
          failed ? `Failed: ${failed}` : null,
          skippedStaff ? `Skipped trainer/admin: ${skippedStaff}` : null,
          skippedNoPhone ? `Skipped (no phone): ${skippedNoPhone}` : null,
          firstError || null,
          templateHint || null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (err) {
      console.error("Send mock test WhatsApp failed:", err);
      alert(err?.message || "Failed to send WhatsApp results.");
    } finally {
      setWaSending(false);
      setWaSendingRowKey("");
    }
  }

  const selectedTest = tests.find((t) => t.id === testFilter);
  const filterSelectClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00448a]/25 focus:border-[#00448a]";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4fb_0%,#f8fafc_28%,#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link
          href={`/Admin/mock-test/${companySlug}`}
          className="mb-5 inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tests
        </Link>

        <Panel className="mb-6 overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#00448a_0%,#0b6bcb_55%,#0891b2_100%)] px-5 py-6 text-white sm:px-7 sm:py-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                  Mock test analytics
                </p>
                <h1 className="mt-2 text-xl font-bold leading-tight sm:text-2xl lg:text-[1.65rem] xl:text-3xl">
                  {groupLabel || companySlug}
                </h1>
                <p className="mt-2 max-w-2xl text-xs text-sky-50/90 sm:text-sm">
                  {selectedTest
                    ? `Showing results for ${selectedTest.title}`
                    : "Showing results across every test in this group"}
                  {" · "}pass mark {PASS_MARK}%
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => sendWhatsAppResults(rows)}
                  disabled={!rows.length || waSending || !!waSendingRowKey}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  {waSending ? "Sending…" : "Send WhatsApp"}
                </button>
                <button
                  type="button"
                  onClick={downloadExcel}
                  disabled={!rows.length}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/40 hover:bg-white/25 disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Download Excel
                </button>
                <button
                  type="button"
                  onClick={downloadAllPdfScorecards}
                  disabled={!rows.length || !!pdfBusyKey}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#00448a] hover:bg-sky-50 disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <FileDown className="h-4 w-4 shrink-0" />
                  {pdfBusyKey === "all" ? "Downloading…" : "Download PDFs"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Test</label>
              <select
                value={testFilter}
                onChange={(e) => setTestFilter(e.target.value)}
                className={`w-full ${filterSelectClass}`}
              >
                <option value="all">All tests</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || t.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-5">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or test"
                  className={`w-full pl-9 pr-9 ${filterSelectClass}`}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`w-full ${filterSelectClass}`}
              >
                <option value="recent">Newest first</option>
                <option value="scoreDesc">Highest score</option>
                <option value="scoreAsc">Lowest score</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
        </Panel>

        {loading ? (
          <ResultsPageSkeleton />
        ) : submissions.length === 0 ? (
          <Panel className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">No submissions yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Results appear here after a student finishes and submits a mock test.
            </p>
          </Panel>
        ) : rows.length === 0 ? (
          <Panel className="px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No matching results</h2>
            <p className="mt-2 text-sm text-slate-500">
              Nothing matches “{search || "this filter"}”. Try another test or clear search.
            </p>
          </Panel>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  label: "Attempts",
                  value: stats.attempts,
                  hint: `${stats.uniqueStudents} unique student${stats.uniqueStudents === 1 ? "" : "s"}`,
                  icon: Users,
                  tone: "text-[#00448a]",
                  bg: "bg-sky-50",
                },
                {
                  label: "Average score",
                  value: `${Math.round(stats.avgScore)}%`,
                  hint: `High ${Math.round(stats.highest)}% · Low ${Math.round(stats.lowest)}%`,
                  icon: Target,
                  tone: "text-cyan-700",
                  bg: "bg-cyan-50",
                },
                {
                  label: `Pass rate`,
                  value: `${Math.round(stats.passRate)}%`,
                  hint: `At or above ${PASS_MARK}%`,
                  icon: Trophy,
                  tone: "text-emerald-700",
                  bg: "bg-emerald-50",
                },
                {
                  label: "MCQ / Coding",
                  value: `${Math.round(stats.avgMcq)}%`,
                  hint: `Coding avg ${Math.round(stats.avgCoding)}%`,
                  icon: Code2,
                  tone: "text-slate-800",
                  bg: "bg-slate-100",
                },
              ].map(({ label, value, hint, icon: Icon, tone, bg }) => (
                <Panel key={label} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
                      <p className="mt-2 text-xs text-slate-500">{hint}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${bg}`}>
                      <Icon className={`h-5 w-5 ${tone}`} />
                    </div>
                  </div>
                </Panel>
              ))}
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Panel>
                <PanelHeader
                  title="Score distribution"
                  subtitle="How many attempts fall in each score band"
                />
                <div className="p-4">
                  <div className="h-[240px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0}>
                      <BarChart data={distribution}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                          {distribution.map((d) => (
                            <Cell key={d.key} fill={d.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {distribution.map((d) => (
                      <div key={d.key} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                        <p className="text-[11px] font-medium text-slate-500">{d.label}</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">{d.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Performance snapshot"
                  subtitle="Range and average by question type"
                />
                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <p className="text-xs font-semibold text-emerald-700">Highest</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-800">
                        {Math.round(stats.highest)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                      <p className="text-xs font-semibold text-rose-700">Lowest</p>
                      <p className="mt-1 text-2xl font-bold text-rose-800">
                        {Math.round(stats.lowest)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                      <p className="text-xs font-semibold text-sky-700">Avg MCQ</p>
                      <p className="mt-1 text-2xl font-bold text-sky-900">
                        {Math.round(stats.avgMcq)}%
                      </p>
                      <div className="mt-3">
                        <ProgressBar value={stats.avgMcq} tone="bg-sky-500" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-600">Avg coding</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {Math.round(stats.avgCoding)}%
                      </p>
                      <div className="mt-3">
                        <ProgressBar value={stats.avgCoding} tone="bg-slate-700" />
                      </div>
                    </div>
                  </div>

                  {perTest.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        By test
                      </p>
                      <div className="max-h-40 space-y-2 overflow-auto pr-1">
                        {perTest.map((t) => (
                          <div
                            key={t.testId}
                            className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                              <span className="truncate font-medium text-slate-800">{t.title}</span>
                              <span className="shrink-0 text-slate-500">
                                {t.count} · {Math.round(t.avg)}%
                              </span>
                            </div>
                            <ProgressBar value={t.avg} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            {sectionAnalytics.length > 0 && (
              <Panel className="mb-6">
                <PanelHeader
                  title="Section-wise scores"
                  subtitle="Average score, total marks, and accuracy by section"
                />
                <div className="p-4">
                  <div className="mb-4 h-[224px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height={224} minWidth={0} minHeight={0}>
                      <BarChart data={sectionAnalytics}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="section" tick={{ fontSize: 12, fill: "#64748b" }} interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
                        <Tooltip formatter={(value) => [`${value}%`, "Avg score"]} />
                        <Bar dataKey="percent" fill="#00448a" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="pb-2 font-semibold">Section</th>
                          <th className="pb-2 text-center font-semibold">Score</th>
                          <th className="pb-2 text-center font-semibold">Total</th>
                          <th className="pb-2 font-semibold">Progress</th>
                          <th className="pb-2 text-right font-semibold">Avg %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionAnalytics.map((s) => (
                          <tr key={s.section} className="border-t border-slate-100">
                            <td className="py-3 font-medium text-slate-900">{s.section}</td>
                            <td className="py-3 text-center text-slate-700">{Math.round(s.earned)}</td>
                            <td className="py-3 text-center text-slate-700">{Math.round(s.max)}</td>
                            <td className="py-3 min-w-[120px]">
                              <ProgressBar value={s.percent} />
                            </td>
                            <td className="py-3 text-right">
                              <ScoreBadge value={s.percent} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>
            )}

            {subSectionAnalytics.length > 0 && (
              <Panel className="mb-6">
                <PanelHeader
                  title="Sub-section-wise scores"
                  subtitle="Score / total / % for each sub-section inside a section"
                />
                <div className="p-4">
                  <div className="mb-4 h-[240px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0}>
                      <BarChart data={subSectionAnalytics}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
                        <Tooltip formatter={(value) => [`${value}%`, "Avg score"]} />
                        <Bar dataKey="percent" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="pb-2 font-semibold">Section</th>
                          <th className="pb-2 font-semibold">Sub-section</th>
                          <th className="pb-2 text-center font-semibold">Score</th>
                          <th className="pb-2 text-center font-semibold">Total</th>
                          <th className="pb-2 font-semibold">Progress</th>
                          <th className="pb-2 text-right font-semibold">Avg %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subSectionAnalytics.map((s) => (
                          <tr key={s.key} className="border-t border-slate-100">
                            <td className="py-3 font-medium text-slate-900">{s.section}</td>
                            <td className="py-3 text-slate-700">{s.subSection}</td>
                            <td className="py-3 text-center text-slate-700">{Math.round(s.earned)}</td>
                            <td className="py-3 text-center text-slate-700">{Math.round(s.max)}</td>
                            <td className="py-3 min-w-[120px]">
                              <ProgressBar value={s.percent} tone="bg-sky-500" />
                            </td>
                            <td className="py-3 text-right">
                              <ScoreBadge value={s.percent} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>
            )}

            {weakQuestions.length > 0 && (
              <Panel className="mb-6">
                <PanelHeader
                  title="Hardest MCQs"
                  subtitle="Lowest accuracy for the selected test"
                />
                <ol className="divide-y divide-slate-100 px-2 py-1">
                  {weakQuestions.map((q, index) => (
                    <li key={q.i} className="flex items-start justify-between gap-4 px-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                            {index + 1}
                          </span>
                          Q{q.i + 1}. {q.text}
                        </p>
                        <div className="mt-2 max-w-md">
                          <ProgressBar
                            value={q.pct}
                            tone={q.pct < 40 ? "bg-rose-500" : "bg-amber-500"}
                          />
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          q.pct < 40
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {q.pct}% · {q.correct}/{q.total}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            <Panel className="overflow-hidden">
              <PanelHeader
                title="Student results"
                subtitle={`${rows.length} attempt${rows.length === 1 ? "" : "s"} · click a row for full breakdown`}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 text-left text-slate-600">
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Test</th>
                      {scoreColumns.map((col) => (
                        <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const bySection = sectionScoresForRow(row);
                      const bySub = subSectionScoresForRow(row);
                      const submissionId = row.id || row.userId;
                      const rowKey = `${row.testId}-${submissionId}`;
                      return (
                        <tr
                          key={rowKey}
                          className="border-t border-slate-100 transition-colors hover:bg-[#00448a]/[0.03] cursor-pointer"
                          onClick={() => setDetail(row)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{row.name || "—"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {row.email ||
                                [row.college, row.branch, row.phone].filter(Boolean).join(" · ") ||
                                "—"}
                            </p>
                            {row.source === "public_link" ? (
                              <span className="mt-1 inline-flex rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                                Public link
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{row.testTitle || row.testId}</td>
                          {scoreColumns.map((col) => {
                            const cell =
                              subSectionColumns.length > 0
                                ? bySub[col.key]
                                : bySection[col.key];
                            return (
                              <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                                {cell ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-700">
                                      {Math.round(cell.earned)}/{cell.max}
                                    </span>
                                    <ScoreBadge value={cell.percent} />
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            <ScoreBadge value={row.percent} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatSubmittedAt(row.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              title="Download PDF scorecard"
                              disabled={!!pdfBusyKey || !!deletingKey}
                              onClick={(e) => downloadPdfScorecard(row, e)}
                              className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#00448a]/25 text-[#00448a] hover:bg-[#00448a]/5 disabled:opacity-50"
                            >
                              <FileDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Send WhatsApp result"
                              disabled={waSending || !!waSendingRowKey || !!deletingKey}
                              onClick={(e) => {
                                e.stopPropagation();
                                sendWhatsAppResults([row], { single: true });
                              }}
                              className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete this result"
                              disabled={!!deletingKey}
                              onClick={(e) => handleDeleteAttempt(row, e)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
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
            </Panel>
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-4 backdrop-blur-[2px] sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {detail.name || "Student"}
                  </h3>
                  <p className="text-sm text-slate-500">{detail.email || "—"}</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">{detail.testTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <div className="mt-1">
                    <ScoreBadge value={detail.percent} />
                  </div>
                </div>
                <div className="rounded-2xl bg-sky-50 p-3">
                  <p className="text-xs text-sky-700">MCQ</p>
                  <p className="mt-1 text-sm font-bold text-sky-900">
                    {detail.mcqCorrect ?? 0}/{detail.mcqTotal ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Coding</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {detail.codingMax
                      ? `${Math.round(detail.codingScore || 0)}/${detail.codingMax}`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Submitted</p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {formatSubmittedAt(detail.submittedAt)}
                  </p>
                </div>
              </div>

              {Object.keys(sectionScoresForRow(detail)).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Section-wise scores</h4>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500">
                          <th className="px-3 py-2 font-semibold">Section</th>
                          <th className="px-3 py-2 text-center font-semibold">Score</th>
                          <th className="px-3 py-2 text-center font-semibold">Total</th>
                          <th className="px-3 py-2 text-right font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(sectionScoresForRow(detail)).map((s) => (
                          <tr key={s.section} className="border-t border-slate-100">
                            <td className="px-3 py-2.5 font-medium text-slate-800">{s.section}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-[#00448a]">
                              {Math.round(s.earned)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600">
                              {Math.round(s.max)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <ScoreBadge value={s.percent} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {Object.keys(subSectionScoresForRow(detail)).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">
                    Sub-section-wise scores
                  </h4>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500">
                          <th className="px-3 py-2 font-semibold">Section</th>
                          <th className="px-3 py-2 font-semibold">Sub-section</th>
                          <th className="px-3 py-2 text-center font-semibold">Score</th>
                          <th className="px-3 py-2 text-center font-semibold">Total</th>
                          <th className="px-3 py-2 text-right font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(subSectionScoresForRow(detail))
                          .sort((a, b) => {
                            const sec = String(a.section).localeCompare(String(b.section));
                            if (sec !== 0) return sec;
                            return String(a.subSection).localeCompare(String(b.subSection));
                          })
                          .map((s) => (
                            <tr
                              key={s.key || `${s.section}-${s.subSection}`}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2.5 font-medium text-slate-800">{s.section}</td>
                              <td className="px-3 py-2.5 text-slate-700">{s.subSection}</td>
                              <td className="px-3 py-2.5 text-center font-semibold text-[#00448a]">
                                {Math.round(s.earned)}
                              </td>
                              <td className="px-3 py-2.5 text-center text-slate-600">
                                {Math.round(s.max)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <ScoreBadge value={s.percent} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {Array.isArray(detail.questionBreakdown) && detail.questionBreakdown.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Question breakdown</h4>
                  <ul className="max-h-56 space-y-1.5 overflow-auto text-sm">
                    {detail.questionBreakdown.map((q) => (
                      <li
                        key={`${q.type}-${q.i}`}
                        className={`rounded-xl px-3 py-2 ${
                          q.type === "mcq"
                            ? q.correct
                              ? "bg-emerald-50 text-emerald-800"
                              : q.unanswered
                                ? "bg-slate-100 text-slate-600"
                                : "bg-rose-50 text-rose-800"
                            : "bg-sky-50 text-sky-900"
                        }`}
                      >
                        {q.type === "mcq"
                          ? `Q${q.i + 1} MCQ · ${q.section}${q.subSection ? ` › ${q.subSection}` : ""}${q.unanswered ? " · skipped" : q.correct ? " · correct" : " · wrong"}`
                          : `Q${q.i + 1} Coding · ${q.section}${q.subSection ? ` › ${q.subSection}` : ""} · ${q.passed || 0}/${q.totalCases || 0} cases`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Question-level detail is available for attempts submitted after this analytics update.
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={!!pdfBusyKey || !!deletingKey}
                  onClick={(e) => downloadPdfScorecard(detail, e)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#00448a]/25 bg-[#00448a]/5 px-3 py-2 text-sm font-medium text-[#00448a] hover:bg-[#00448a]/10 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  {pdfBusyKey && pdfBusyKey !== "all" ? "Downloading…" : "Download PDF scorecard"}
                </button>
                <button
                  type="button"
                  disabled={waSending || !!waSendingRowKey || !!deletingKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    sendWhatsAppResults([detail], { single: true });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {waSendingRowKey ? "Sending…" : "Send WhatsApp"}
                </button>
                <button
                  type="button"
                  disabled={!!deletingKey}
                  onClick={(e) => handleDeleteAttempt(detail, e)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete this result
                </button>
                <button
                  type="button"
                  disabled={!!deletingKey}
                  onClick={(e) => handleDeleteCandidate(detail, e)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
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
