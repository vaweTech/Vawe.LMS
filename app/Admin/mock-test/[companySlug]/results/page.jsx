"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ExcelJS from "exceljs";
import { doc, getDoc } from "firebase/firestore";
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
  Download,
  MessageCircle,
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
const MOCK_RESULT_WA_TEMPLATE = "mock_test_marks_students";

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

function formatWhatsAppDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${now.getFullYear()}`;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
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

function buildSubjectWiseMarksText(row) {
  const bySection = Object.values(sectionScoresForRow(row)).filter((s) => Number(s.max) > 0);
  const source =
    bySection.length > 0
      ? bySection.sort((a, b) => String(a.section).localeCompare(String(b.section)))
      : Object.values(subSectionScoresForRow(row))
          .filter((s) => Number(s.max) > 0)
          .sort((a, b) => {
            const sec = String(a.section).localeCompare(String(b.section));
            if (sec !== 0) return sec;
            return String(a.subSection).localeCompare(String(b.subSection));
          });

  if (!source.length) {
    const parts = [];
    if (Number(row.mcqTotal) > 0) {
      parts.push(`MCQ: ${row.mcqCorrect ?? 0}/${row.mcqTotal} (${Math.round(((row.mcqCorrect || 0) / row.mcqTotal) * 100)}%)`);
    }
    if (Number(row.codingMax) > 0) {
      parts.push(
        `Coding: ${Math.round(row.codingScore || 0)}/${row.codingMax} (${Math.round(((row.codingScore || 0) / row.codingMax) * 100)}%)`
      );
    }
    return parts.join(" ") || "No section scores available";
  }

  return source
    .map((s) => {
      const label = s.label || s.section || s.subSection || "General";
      const earned = Math.round(Number(s.earned) || 0);
      const max = Math.round(Number(s.max) || 0);
      const pct = Number(s.percent) || (max > 0 ? Math.round((earned / max) * 100) : 0);
      return `${label}: ${earned}/${max} (${pct}%)`;
    })
    .join(" ");
}

function buildOverallMarks(row) {
  const bySection = Object.values(sectionScoresForRow(row));
  let earned = bySection.reduce((sum, s) => sum + (Number(s.earned) || 0), 0);
  let max = bySection.reduce((sum, s) => sum + (Number(s.max) || 0), 0);
  if (max <= 0) {
    earned = (Number(row.mcqCorrect) || 0) + (Number(row.codingScore) || 0);
    max = (Number(row.mcqTotal) || 0) + (Number(row.codingMax) || 0);
  }
  return {
    earned: Math.round(earned * 10) / 10,
    max: Math.round(max * 10) / 10,
    percent:
      row.percent != null
        ? Math.round((Number(row.percent) || 0) * 10) / 10
        : max > 0
          ? Math.round((earned / max) * 1000) / 10
          : 0,
  };
}

/** Template: mock_test_marks_students — {{1}} name, {{2}} test, {{3}} date, {{4}} subjects, {{5}} total, {{6}} % */
function buildMockResultWhatsAppParams(row) {
  const overall = buildOverallMarks(row);
  return [
    String(row.name || "Student").trim() || "Student",
    String(row.testTitle || row.testId || "Mock Test").trim() || "Mock Test",
    formatWhatsAppDate(row.submittedAt),
    buildSubjectWiseMarksText(row),
    `${overall.earned}/${overall.max}`,
    String(overall.percent),
  ];
}

async function resolveRecipientForWhatsApp(userId) {
  const uid = String(userId || "").trim();

  const pickPhone = (data) =>
    String(data?.phone1 || data?.phone || data?.phone2 || data?.mobile || "").trim();

  const collectRoles = (data) => {
    if (!data) return [];
    const roles = [];
    if (data.role) roles.push(data.role);
    if (Array.isArray(data.roles)) roles.push(...data.roles);
    return roles.map((r) => String(r || "").trim()).filter(Boolean);
  };

  const isStaffRole = (role) => {
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
  };

  const isStudentLikeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (!value) return false;
    if (isStaffRole(role)) return false;
    if (value === "student" || value === "internship") return true;
    if (value.endsWith("student") || value.endsWith("internship") || value.endsWith("skillwins")) {
      return true;
    }
    return false;
  };

  let studentData = null;
  let userData = null;

  if (uid && db) {
    try {
      const studentSnap = await getDoc(doc(db, "students", uid));
      if (studentSnap.exists()) studentData = studentSnap.data();
    } catch {
      /* continue */
    }
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) userData = userSnap.data();
    } catch {
      /* continue */
    }
  }

  const allRoles = [...collectRoles(userData), ...collectRoles(studentData)];
  if (allRoles.some(isStaffRole)) {
    return { phone: "", eligible: false, skipReason: "staff" };
  }

  const hasStudentProfile = Boolean(studentData);
  const hasStudentRole = allRoles.some(isStudentLikeRole);
  if (!hasStudentProfile && !hasStudentRole) {
    return { phone: "", eligible: false, skipReason: "not_student" };
  }

  const phone = pickPhone(studentData) || pickPhone(userData);
  if (!phone) {
    return { phone: "", eligible: true, skipReason: "no_phone" };
  }

  return { phone, eligible: true, skipReason: "" };
}

async function resolveRecipientsForRows(list) {
  const cache = new Map();
  const out = new Map();
  await Promise.all(
    list.map(async (row) => {
      const key = String(row.userId || row.id || row.email || "");
      if (!key) return;
      if (cache.has(key)) {
        out.set(key, cache.get(key));
        return;
      }
      const info = await resolveRecipientForWhatsApp(row.userId || row.id);
      cache.set(key, info);
      out.set(key, info);
    })
  );
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
        ? `Send WhatsApp result to ${candidateLabel(list[0])}?`
        : `Send WhatsApp results to ${list.length} student${list.length === 1 ? "" : "s"} (current filter)?`
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
      let skippedNotStudent = 0;
      const recipients = [];

      for (const row of list) {
        const key = String(row.userId || row.id || row.email || "");
        const info = recipientInfo.get(key) || { phone: "", eligible: false, skipReason: "not_student" };
        if (!info.eligible) {
          if (info.skipReason === "staff") skippedStaff += 1;
          else skippedNotStudent += 1;
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
        });
      }

      if (!recipients.length) {
        alert(
          [
            "No eligible students to message.",
            skippedStaff ? `Skipped trainer/admin: ${skippedStaff}` : null,
            skippedNotStudent ? `Skipped non-student: ${skippedNotStudent}` : null,
            skippedNoPhone ? `Skipped (no phone): ${skippedNoPhone}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        );
        return;
      }

      const res = await makeAuthenticatedRequest("/api/send-whatsapp-bulk", {
        method: "POST",
        body: JSON.stringify({
          template: MOCK_RESULT_WA_TEMPLATE,
          recipients,
          concurrency: 8,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to send WhatsApp messages");
      }

      const sent = Number(data.sent || 0);
      const failed = Number(data.failed || 0);
      const firstError = Array.isArray(data.errors) && data.errors[0]?.error
        ? `\nFirst error: ${data.errors[0].error}`
        : "";
      alert(
        [
          `WhatsApp sent: ${sent}/${recipients.length}`,
          failed ? `Failed: ${failed}` : null,
          skippedStaff ? `Skipped trainer/admin: ${skippedStaff}` : null,
          skippedNotStudent ? `Skipped non-student: ${skippedNotStudent}` : null,
          skippedNoPhone ? `Skipped (no phone): ${skippedNoPhone}` : null,
          firstError || null,
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => sendWhatsAppResults(rows)}
              disabled={!rows.length || waSending || !!waSendingRowKey}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              {waSending ? "Sending…" : "Send WhatsApp"}
            </button>
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
                <h2 className="font-semibold text-slate-900 mb-1">Section-wise scores</h2>
                <p className="text-xs text-slate-500 mb-3">Average score, total marks, and accuracy by section</p>
                <div className="h-[224px] w-full min-w-0 mb-4">
                  <ResponsiveContainer width="100%" height={224} minWidth={0} minHeight={0}>
                    <BarChart data={sectionAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="section" tick={{ fontSize: 12 }} interval={0} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value}%`, "Avg score"]} />
                      <Bar dataKey="percent" fill="#00448a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">Section</th>
                        <th className="py-2 text-center">Score</th>
                        <th className="py-2 text-center">Total</th>
                        <th className="py-2 text-right">Avg %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionAnalytics.map((s) => (
                        <tr key={s.section} className="border-t">
                          <td className="py-2 font-medium">{s.section}</td>
                          <td className="py-2 text-center">{Math.round(s.earned)}</td>
                          <td className="py-2 text-center">{Math.round(s.max)}</td>
                          <td className="py-2 text-right">
                            <ScoreBadge value={s.percent} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subSectionAnalytics.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <h2 className="font-semibold text-slate-900 mb-1">Sub-section-wise scores</h2>
                <p className="text-xs text-slate-500 mb-3">
                  Score / total / % for each sub-section inside a section
                </p>
                <div className="h-[240px] w-full min-w-0 mb-4">
                  <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0}>
                    <BarChart data={subSectionAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value}%`, "Avg score"]} />
                      <Bar dataKey="percent" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">Section</th>
                        <th className="py-2">Sub-section</th>
                        <th className="py-2 text-center">Score</th>
                        <th className="py-2 text-center">Total</th>
                        <th className="py-2 text-right">Avg %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subSectionAnalytics.map((s) => (
                        <tr key={s.key} className="border-t">
                          <td className="py-2 font-medium">{s.section}</td>
                          <td className="py-2 text-slate-700">{s.subSection}</td>
                          <td className="py-2 text-center">{Math.round(s.earned)}</td>
                          <td className="py-2 text-center">{Math.round(s.max)}</td>
                          <td className="py-2 text-right">
                            <ScoreBadge value={s.percent} />
                          </td>
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
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setDetail(row)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.email || "—"}</td>
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
                        <td className="px-4 py-3 text-slate-600">{formatSubmittedAt(row.submittedAt)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            title="Send WhatsApp result"
                            disabled={waSending || !!waSendingRowKey || !!deletingKey}
                            onClick={(e) => {
                              e.stopPropagation();
                              sendWhatsAppResults([row], { single: true });
                            }}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 mr-1"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
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
              Click a row for section and sub-section scores. Use the trash icon to delete that candidate’s result.
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
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Section-wise scores</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">Section</th>
                        <th className="py-2 text-center">Score</th>
                        <th className="py-2 text-center">Total</th>
                        <th className="py-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(sectionScoresForRow(detail)).map((s) => (
                        <tr key={s.section} className="border-t border-slate-100">
                          <td className="py-2 font-medium text-slate-800">{s.section}</td>
                          <td className="py-2 text-center text-[#00448a] font-semibold">
                            {Math.round(s.earned)}
                          </td>
                          <td className="py-2 text-center text-slate-600">{Math.round(s.max)}</td>
                          <td className="py-2 text-right">
                            <ScoreBadge value={s.percent} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {Object.keys(subSectionScoresForRow(detail)).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Sub-section-wise scores</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">Section</th>
                        <th className="py-2">Sub-section</th>
                        <th className="py-2 text-center">Score</th>
                        <th className="py-2 text-center">Total</th>
                        <th className="py-2 text-right">%</th>
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
                          <tr key={s.key || `${s.section}-${s.subSection}`} className="border-t border-slate-100">
                            <td className="py-2 font-medium text-slate-800">{s.section}</td>
                            <td className="py-2 text-slate-700">{s.subSection}</td>
                            <td className="py-2 text-center text-[#00448a] font-semibold">
                              {Math.round(s.earned)}
                            </td>
                            <td className="py-2 text-center text-slate-600">{Math.round(s.max)}</td>
                            <td className="py-2 text-right">
                              <ScoreBadge value={s.percent} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
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
                        ? `Q${q.i + 1} MCQ · ${q.section}${q.subSection ? ` › ${q.subSection}` : ""}${q.unanswered ? " · skipped" : q.correct ? " · correct" : " · wrong"}`
                        : `Q${q.i + 1} Coding · ${q.section}${q.subSection ? ` › ${q.subSection}` : ""} · ${q.passed || 0}/${q.totalCases || 0} cases`}
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
                  disabled={waSending || !!waSendingRowKey || !!deletingKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    sendWhatsAppResults([detail], { single: true });
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-sm hover:bg-emerald-50 disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {waSendingRowKey ? "Sending…" : "Send WhatsApp"}
                </button>
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
