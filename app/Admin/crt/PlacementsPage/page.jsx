"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  FlagIcon,
  ChartBarIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAdminAccess } from "../../AdminAccessContext";
import {
  ALL_DEPARTMENTS,
  DEFAULT_DEPARTMENTS,
  LIMITS,
  academicYearEnd,
  checkCandidateEligibility,
  companyKey,
  csvEscape,
  deleteDrive,
  driveParticipants,
  maxRoundsClearedForDrive,
  removeCandidate,
  saveDrive,
  setCandidateRounds,
  subscribeCrtStudents,
  subscribeDrives,
  validateDrive,
  validateRoundsCleared,
} from "@/lib/crtPlacementData";

const EMPTY_DRIVE_FORM = {
  companyName: "",
  role: "",
  packageLpa: "",
  driveDate: "",
  departments: [],
  openings: "",
  rounds: "",
  maxBacklogs: "",
};

const PIE_COLORS = ["#10b981", "#ef4444"];

const inputClass =
  "w-full border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition";

function friendlyError(err, fallback) {
  const code = err?.code || "";
  if (code === "permission-denied") return "You do not have permission for this action. Ask the admin to check your role.";
  if (code === "unavailable") return "Network problem. Check your internet connection and try again.";
  return err?.message || fallback;
}

function StatCard({ title, value, color, Icon, iconBg }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <h2 className={`text-3xl font-bold mt-2 ${color}`}>{value}</h2>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ring-1 ring-black/[0.04] ${iconBg}`}>
          <Icon className={`h-6 w-6 ${color}`} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function QuickButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold shadow-sm hover:shadow transition-all"
    >
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function RoundStatsCell({ row }) {
  const entries = Object.entries(row.roundStats || {});
  if (entries.length === 0) return <span className="text-slate-400">No data</span>;
  return (
    <div className="space-y-1.5 text-xs text-slate-700 max-h-40 overflow-y-auto pr-1">
      {entries.map(([round, breakdown]) => (
        <div key={round} className="leading-snug">
          <span className="font-semibold text-slate-800">{round}</span>
          <span className="text-slate-600"> {" --> "} </span>
          <span>
            {Object.entries(breakdown || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([label, count]) => `${label}-${count}`)
              .join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function sortRoundStats(roundStats) {
  const entries = Object.entries(roundStats);
  entries.sort(([a], [b]) => {
    if (a === "Final Round") return 1;
    if (b === "Final Round") return -1;
    return Number(a.replace("Round ", "")) - Number(b.replace("Round ", ""));
  });
  return Object.fromEntries(entries);
}

function buildAnalytics(rows, groupKey, breakdownKey) {
  const map = {};
  rows.forEach((row) => {
    const name = row[groupKey] || "Unknown";
    const label = row[breakdownKey] || "Unknown";
    if (!map[name]) {
      map[name] = { name, total: 0, placed: 0, unplaced: 0, roundsCleared: 0, finalRoundPlaced: 0, roundStats: {} };
    }
    const item = map[name];
    item.total += 1;
    item.roundsCleared += row.roundsCleared;
    if (row.placed) item.placed += 1;
    else item.unplaced += 1;
    if (row.finalRoundPlaced) item.finalRoundPlaced += 1;
    for (let r = 1; r <= row.roundsCleared; r++) {
      const key = `Round ${r}`;
      item.roundStats[key] = item.roundStats[key] || {};
      item.roundStats[key][label] = (item.roundStats[key][label] || 0) + 1;
    }
    if (row.finalRoundPlaced) {
      item.roundStats["Final Round"] = item.roundStats["Final Round"] || {};
      item.roundStats["Final Round"][label] = (item.roundStats["Final Round"][label] || 0) + 1;
    }
  });
  return Object.values(map)
    .map((item) => ({ ...item, roundStats: sortRoundStats(item.roundStats) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function AnalyticsTable({ title, description, firstColumn, rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-slate-50">
            <tr>
              {[firstColumn, "Total Attended", "Placed", "Unplaced", "Rounds Cleared", "Final Round Placed", "Round Stats"].map((h) => (
                <th key={h} className="p-4 text-left text-slate-600 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="p-4 font-semibold text-slate-800">{row.name}</td>
                <td className="p-4 text-slate-700">{row.total}</td>
                <td className="p-4 text-emerald-600 font-semibold">{row.placed}</td>
                <td className="p-4 text-rose-600 font-semibold">{row.unplaced}</td>
                <td className="p-4 text-slate-700">{row.roundsCleared}</td>
                <td className="p-4 text-blue-600 font-semibold">{row.finalRoundPlaced}</td>
                <td className="p-4 align-top">
                  <RoundStatsCell row={row} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  No analytics data for this year yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SingleCollegePlacementERP() {
  const access = useAdminAccess();
  const collegeLabel = access?.collegeSubdomain
    ? String(access.collegeSubdomain).toUpperCase()
    : "CRT Placements";
  const today = new Date().toISOString().split("T")[0];
  const currentYear = String(new Date().getFullYear());

  const [students, setStudents] = useState([]);
  const [drives, setDrives] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [lastSynced, setLastSynced] = useState(null);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [placementSearch, setPlacementSearch] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);

  const [showDriveModal, setShowDriveModal] = useState(false);
  const [editingDriveId, setEditingDriveId] = useState(null);
  const [driveForm, setDriveForm] = useState(EMPTY_DRIVE_FORM);
  const [driveErrors, setDriveErrors] = useState({});
  const [driveSubmitError, setDriveSubmitError] = useState("");
  const [driveSaving, setDriveSaving] = useState(false);

  const [candidateDraft, setCandidateDraft] = useState({ driveId: null, studentId: "", rounds: "0", search: "" });
  const [candidateError, setCandidateError] = useState("");
  const [roundEdits, setRoundEdits] = useState({});
  const [busyKey, setBusyKey] = useState("");

  const dashboardRef = useRef(null);
  const placementsRef = useRef(null);
  const analyticsRef = useRef(null);
  const scrollToSection = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    setStudentsLoading(true);
    setDrivesLoading(true);
    setLoadError("");
    const unsubStudents = subscribeCrtStudents(
      (rows) => {
        setStudents(rows);
        setStudentsLoading(false);
        setLastSynced(new Date());
      },
      (err) => {
        setStudentsLoading(false);
        setLoadError(friendlyError(err, "Could not load CRT students."));
      }
    );
    const unsubDrives = subscribeDrives(
      (rows) => {
        setDrives(rows);
        setDrivesLoading(false);
        setLastSynced(new Date());
      },
      (err) => {
        setDrivesLoading(false);
        setLoadError(friendlyError(err, "Could not load placement drives."));
      }
    );
    return () => {
      unsubStudents();
      unsubDrives();
    };
  }, [reloadKey]);

  const loading = studentsLoading || drivesLoading;

  const getPlacementStatus = useCallback(
    (date) => {
      if (date > today) return "Upcoming";
      if (date === today) return "Current";
      return "Past";
    },
    [today]
  );

  const getStatusBadge = (status) => {
    if (status === "Upcoming") return "bg-sky-100 text-sky-700 border border-sky-200";
    if (status === "Current") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  const departmentOptions = useMemo(() => {
    const set = new Set(DEFAULT_DEPARTMENTS);
    students.forEach((s) => s.department && s.department !== "GENERAL" && set.add(s.department));
    return [...set].sort();
  }, [students]);

  const participantsByDrive = useMemo(() => {
    const map = new Map();
    drives.forEach((d) => map.set(d.id, driveParticipants(d, students)));
    return map;
  }, [drives, students]);

  const yearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    drives.forEach((d) => /^\d{4}/.test(d.driveDate) && years.add(d.driveDate.slice(0, 4)));
    students.forEach((s) => {
      const end = academicYearEnd(s.academicYear);
      if (end) years.add(String(end));
      s.offers.forEach((o) => o.offerDate && years.add(o.offerDate.slice(0, 4)));
    });
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [drives, students, currentYear]);

  const yearDrives = useMemo(
    () => (selectedYear === "all" ? drives : drives.filter((d) => d.driveDate.slice(0, 4) === selectedYear)),
    [drives, selectedYear]
  );

  const yearDriveStudentIds = useMemo(() => {
    const ids = new Set();
    yearDrives.forEach((d) => (participantsByDrive.get(d.id) || []).forEach((p) => ids.add(p.student.id)));
    return ids;
  }, [yearDrives, participantsByDrive]);

  const cohort = useMemo(() => {
    if (selectedYear === "all") return students;
    return students.filter((s) => {
      const end = academicYearEnd(s.academicYear);
      if (end) return String(end) === selectedYear;
      return (
        yearDriveStudentIds.has(s.id) ||
        s.offers.some((o) => o.offerDate && o.offerDate.slice(0, 4) === selectedYear)
      );
    });
  }, [students, selectedYear, yearDriveStudentIds]);

  /** One row per student per company — drive attendance plus PO offers made outside any drive. */
  const participations = useMemo(() => {
    const rows = [];
    const matchedOffers = new Set();
    yearDrives.forEach((drive) => {
      (participantsByDrive.get(drive.id) || []).forEach((p) => {
        if (p.offer) matchedOffers.add(`${p.student.id}|${companyKey(p.offer.company)}|${p.offer.offerDate}`);
        rows.push({
          uid: p.student.id,
          department: p.student.department,
          companyName: drive.companyName,
          placed: p.placed,
          roundsCleared: p.roundsCleared,
          finalRoundPlaced: p.placed,
        });
      });
    });
    const cohortIds = new Set(cohort.map((s) => s.id));
    students.forEach((s) => {
      s.offers.forEach((o) => {
        const inYear =
          selectedYear === "all" ||
          (o.offerDate ? o.offerDate.slice(0, 4) === selectedYear : cohortIds.has(s.id));
        if (!inYear) return;
        if (matchedOffers.has(`${s.id}|${companyKey(o.company)}|${o.offerDate}`)) return;
        rows.push({
          uid: s.id,
          department: s.department,
          companyName: o.company,
          placed: true,
          roundsCleared: 0,
          finalRoundPlaced: true,
        });
      });
    });
    return rows;
  }, [yearDrives, participantsByDrive, students, cohort, selectedYear]);

  const stats = useMemo(() => {
    const placedStudents = cohort.filter((s) => s.status === "Placed").length;
    return {
      totalStudents: cohort.length,
      placedStudents,
      unplacedStudents: cohort.length - placedStudents,
      finalRoundPlaced: participations.filter((p) => p.finalRoundPlaced).length,
      totalRoundsCleared: participations.reduce((sum, p) => sum + p.roundsCleared, 0),
      totalPlacements: yearDrives.length,
    };
  }, [cohort, participations, yearDrives]);

  const placementRate = stats.totalStudents
    ? ((stats.placedStudents / stats.totalStudents) * 100).toFixed(1)
    : "0.0";

  const pieData = [
    { name: "Placed", value: stats.placedStudents },
    { name: "Unplaced", value: stats.unplacedStudents },
  ];

  const filteredDrives = useMemo(() => {
    const q = placementSearch.trim().toLowerCase();
    if (!q) return yearDrives;
    return yearDrives.filter((d) =>
      `${d.companyName} ${d.role} ${d.departments.join(" ")} ${d.packageLpa}`.toLowerCase().includes(q)
    );
  }, [yearDrives, placementSearch]);

  const companyProgressList = useMemo(
    () =>
      filteredDrives.map((drive) => {
        const participants = participantsByDrive.get(drive.id) || [];
        const status = getPlacementStatus(drive.driveDate);
        const totalRounds = drive.rounds;
        const phaseFor = (list) => {
          const maxCleared = list.reduce((m, p) => Math.max(m, p.roundsCleared), 0);
          const currentRound =
            status === "Upcoming" ? 1 : status === "Past" ? totalRounds : Math.min(Math.max(maxCleared + 1, 1), totalRounds);
          const phaseLabel =
            status === "Upcoming" ? "Yet to Start" : status === "Current" ? `Round ${currentRound} In Progress` : "Completed";
          const inCurrent =
            status === "Past"
              ? 0
              : status === "Upcoming"
                ? list.filter((p) => p.roundsCleared === 0).length
                : list.filter((p) => p.roundsCleared === currentRound - 1 && !p.placed).length;
          return { currentRound, phaseLabel, inCurrent };
        };
        const overall = phaseFor(participants);
        const branches = [...new Set(participants.map((p) => p.student.department))].sort();
        return {
          ...drive,
          participants,
          status,
          totalRounds,
          phaseLabel: overall.phaseLabel,
          currentRound: overall.currentRound,
          currentRoundStudents: overall.inCurrent,
          placedCount: participants.filter((p) => p.placed).length,
          branchBreakdown: branches.map((branch) => {
            const list = participants.filter((p) => p.student.department === branch);
            const phase = phaseFor(list);
            return {
              branch,
              totalStudents: list.length,
              currentRound: status === "Past" ? null : phase.currentRound,
              phaseLabel: phase.phaseLabel,
              driveStatus: status,
              currentRoundStudents: phase.inCurrent,
            };
          }),
        };
      }),
    [filteredDrives, participantsByDrive, getPlacementStatus]
  );

  const companyAnalytics = useMemo(() => buildAnalytics(participations, "companyName", "department"), [participations]);
  const departmentAnalytics = useMemo(() => buildAnalytics(participations, "department", "companyName"), [participations]);

  /* ----------------------------- drive form ----------------------------- */

  const openNewDrive = () => {
    setEditingDriveId(null);
    setDriveForm(EMPTY_DRIVE_FORM);
    setDriveErrors({});
    setDriveSubmitError("");
    setShowDriveModal(true);
  };

  const openEditDrive = (drive) => {
    setEditingDriveId(drive.id);
    setDriveForm({
      companyName: drive.companyName,
      role: drive.role,
      packageLpa: String(drive.packageLpa || ""),
      driveDate: drive.driveDate,
      departments: drive.departments,
      openings: String(drive.openings || ""),
      rounds: String(drive.rounds || ""),
      maxBacklogs: drive.maxBacklogs == null ? "" : String(drive.maxBacklogs),
    });
    setDriveErrors({});
    setDriveSubmitError("");
    setShowDriveModal(true);
  };

  const closeDriveModal = () => {
    if (driveSaving) return;
    setShowDriveModal(false);
    setEditingDriveId(null);
  };

  const updateDriveField = (name, value) => {
    setDriveForm((prev) => ({ ...prev, [name]: value }));
    setDriveErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
  };

  const toggleDepartment = (dept) => {
    setDriveForm((prev) => {
      let next;
      if (dept === ALL_DEPARTMENTS) {
        next = prev.departments.includes(ALL_DEPARTMENTS) ? [] : [ALL_DEPARTMENTS];
      } else {
        const base = prev.departments.filter((d) => d !== ALL_DEPARTMENTS);
        next = base.includes(dept) ? base.filter((d) => d !== dept) : [...base, dept];
      }
      return { ...prev, departments: next };
    });
    setDriveErrors((prev) => ({ ...prev, departments: "" }));
  };

  const handleSaveDrive = async (e) => {
    e.preventDefault();
    if (driveSaving) return;
    const editing = drives.find((d) => d.id === editingDriveId);
    const result = validateDrive(driveForm, {
      drives,
      editingId: editingDriveId,
      maxRoundsCleared: editing ? maxRoundsClearedForDrive(editing) : 0,
    });
    if (!result.ok) {
      setDriveErrors(result.errors);
      setDriveSubmitError("Please fix the highlighted fields.");
      return;
    }
    if (editing && companyKey(editing.companyName) !== result.value.companyKey) {
      const linked = (participantsByDrive.get(editing.id) || []).filter((p) => p.fromOffer).length;
      if (
        linked > 0 &&
        !window.confirm(
          `${linked} placed student(s) are linked to "${editing.companyName}" by their PO offer. After renaming, they will only match if their offer uses the new name. Continue?`
        )
      ) {
        return;
      }
    }
    setDriveSaving(true);
    setDriveSubmitError("");
    try {
      await saveDrive(result.value, editingDriveId);
      setShowDriveModal(false);
      setEditingDriveId(null);
      setDriveForm(EMPTY_DRIVE_FORM);
    } catch (err) {
      setDriveSubmitError(friendlyError(err, "Could not save the drive. Try again."));
    } finally {
      setDriveSaving(false);
    }
  };

  const handleDeleteDrive = async (drive) => {
    const participants = participantsByDrive.get(drive.id) || [];
    const added = participants.filter((p) => !p.fromOffer).length;
    const message = added
      ? `Delete the ${drive.companyName} drive on ${drive.driveDate}?\n\nRound progress for ${added} student(s) will be lost. PO offers on student profiles are not affected.`
      : `Delete the ${drive.companyName} drive on ${drive.driveDate}?`;
    if (!window.confirm(message)) return;
    setBusyKey(`delete:${drive.id}`);
    try {
      await deleteDrive(drive.id);
      if (expandedCompanyId === drive.id) setExpandedCompanyId(null);
    } catch (err) {
      alert(friendlyError(err, "Could not delete the drive."));
    } finally {
      setBusyKey("");
    }
  };

  /* ----------------------------- candidates ----------------------------- */

  const handleAddCandidate = async (drive) => {
    setCandidateError("");
    const student = students.find((s) => s.id === candidateDraft.studentId);
    const eligibility = checkCandidateEligibility(student, drive);
    if (eligibility) return setCandidateError(eligibility);
    const roundsErr = validateRoundsCleared(candidateDraft.rounds, drive);
    if (roundsErr) return setCandidateError(roundsErr);
    setBusyKey(`add:${drive.id}`);
    try {
      await setCandidateRounds(drive.id, student.id, Number(candidateDraft.rounds));
      setCandidateDraft({ driveId: drive.id, studentId: "", rounds: "0", search: "" });
    } catch (err) {
      setCandidateError(friendlyError(err, "Could not add the student."));
    } finally {
      setBusyKey("");
    }
  };

  const handleSaveRounds = async (drive, participant) => {
    const key = `${drive.id}:${participant.student.id}`;
    const raw = roundEdits[key] ?? String(participant.roundsCleared);
    const err = validateRoundsCleared(raw, drive);
    if (err) return alert(err);
    setBusyKey(`rounds:${key}`);
    try {
      await setCandidateRounds(drive.id, participant.student.id, Number(raw));
      setRoundEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      alert(friendlyError(error, "Could not save rounds."));
    } finally {
      setBusyKey("");
    }
  };

  const handleRemoveCandidate = async (drive, participant) => {
    if (!window.confirm(`Remove ${participant.student.name} from the ${drive.companyName} drive?`)) return;
    setBusyKey(`remove:${drive.id}:${participant.student.id}`);
    try {
      await removeCandidate(drive.id, participant.student.id);
    } catch (err) {
      alert(friendlyError(err, "Could not remove the student."));
    } finally {
      setBusyKey("");
    }
  };

  const exportDrivesCsv = () => {
    const header = ["Company", "Role", "Package LPA", "Drive Date", "Departments", "Openings", "Rounds", "Candidates", "Selected", "Status"];
    const lines = companyProgressList.map((d) =>
      [d.companyName, d.role, d.packageLpa, d.driveDate, d.departments.join(" "), d.openings, d.rounds, d.participants.length, d.placedCount, d.status]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `placement-drives-${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-10">
        <Link
          href="/Admin/crt"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 hover:bg-white text-slate-700 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to CRT
        </Link>

        {/* HERO */}
        <section className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-500 text-white shadow-2xl">
          <div className="p-6 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="uppercase tracking-[0.25em] text-xs md:text-sm text-blue-100 font-semibold">
                    Placement ERP Dashboard
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    <span className={`h-1.5 w-1.5 rounded-full ${loadError ? "bg-rose-300" : "bg-emerald-300 animate-pulse"}`} />
                    {loadError ? "Sync error" : "Live"} · {selectedYear === "all" ? "All years" : `Year ${selectedYear}`}
                  </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold mt-3">{collegeLabel}</h1>
                <p className="mt-3 text-blue-100 max-w-2xl">
                  Placement drives, round progress, and analytics. Offers recorded by the PO update this page automatically.
                </p>
                {lastSynced && (
                  <p className="mt-2 text-xs text-blue-100/80">Last synced: {lastSynced.toLocaleTimeString()}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 min-w-[280px]">
                <div className="bg-white/15 backdrop-blur rounded-3xl p-5 border border-white/20">
                  <p className="text-sm text-white/90 font-semibold">Placement Rate</p>
                  <p className="text-3xl text-white font-bold mt-2">{loading ? "…" : `${placementRate}%`}</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-3xl p-5 border border-white/20">
                  <p className="text-sm text-white/90 font-semibold">Total Drives</p>
                  <p className="text-3xl text-white font-bold mt-2">{loading ? "…" : stats.totalPlacements}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm font-medium text-rose-800">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* QUICK NAV */}
        <section className="sticky top-3 z-30">
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-lg p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <QuickButton label="Dashboard" onClick={() => scrollToSection(dashboardRef)} />
                <QuickButton label="Placements" onClick={() => scrollToSection(placementsRef)} />
                <QuickButton label="Analytics" onClick={() => scrollToSection(analyticsRef)} />
              </div>

              <div className="flex items-center gap-3 md:pl-4 md:border-l md:border-slate-200">
                <label htmlFor="placement-year" className="text-xs font-semibold uppercase tracking-wider text-slate-500 shrink-0">
                  Year
                </label>
                <div className="relative w-full md:w-44">
                  <select
                    id="placement-year"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setExpandedCompanyId(null);
                    }}
                    className="w-full appearance-none cursor-pointer rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 pl-4 pr-10 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                    <option value="all">All years</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-xl border-2 border-indigo-600 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading live placement data…</p>
          </div>
        ) : (
          <>
            {/* DASHBOARD */}
            <section ref={dashboardRef} className="scroll-mt-28">
              <SectionHeader
                title="Dashboard Overview"
                subtitle={
                  selectedYear === "all"
                    ? "All CRT students across every year"
                    : `CRT students graduating in ${selectedYear}, or with drives and offers that year`
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                <StatCard title="Total Students" value={stats.totalStudents} color="text-indigo-600" iconBg="bg-indigo-50" Icon={AcademicCapIcon} />
                <StatCard title="Placed" value={stats.placedStudents} color="text-emerald-600" iconBg="bg-emerald-50" Icon={CheckCircleIcon} />
                <StatCard title="Unplaced" value={stats.unplacedStudents} color="text-rose-600" iconBg="bg-rose-50" Icon={XCircleIcon} />
                <StatCard title="Offers" value={stats.finalRoundPlaced} color="text-blue-600" iconBg="bg-blue-50" Icon={FlagIcon} />
                <StatCard title="Rounds Cleared" value={stats.totalRoundsCleared} color="text-violet-600" iconBg="bg-violet-50" Icon={ChartBarIcon} />
                <StatCard title="Drives" value={stats.totalPlacements} color="text-orange-600" iconBg="bg-orange-50" Icon={BriefcaseIcon} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                <Card className="p-6 xl:col-span-2">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Placed vs Unplaced</h3>
                  {stats.totalStudents === 0 ? (
                    <p className="h-80 flex items-center justify-center text-sm text-slate-500">
                      No CRT students found for this year.
                    </p>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label>
                            {pieData.map((_, index) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </div>
            </section>

            {/* PLACEMENTS */}
            <section ref={placementsRef} className="scroll-mt-28">
              <SectionHeader
                title="Placements"
                subtitle="Company drives, eligibility, rounds and selections"
                action={
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={exportDrivesCsv}
                      disabled={companyProgressList.length === 0}
                      className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold shadow-sm hover:shadow disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={openNewDrive}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:shadow-xl transition"
                    >
                      + Add Drive
                    </button>
                  </div>
                }
              />

              <Card className="p-5 mb-5">
                <input
                  type="search"
                  placeholder="Search by company, role, department or package…"
                  value={placementSearch}
                  onChange={(e) => setPlacementSearch(e.target.value)}
                  maxLength={80}
                  className={inputClass}
                />
              </Card>

              <Card className="p-5">
                <h3 className="text-xl font-bold text-slate-800">Company Drives Tracker</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Open a drive to see rounds, branch-wise progress, and to manage the students attending it.
                </p>

                <div className="mt-4 space-y-3">
                  {companyProgressList.map((company) => {
                    const isOpen = expandedCompanyId === company.id;
                    const draftActive = candidateDraft.driveId === company.id;
                    const participantIds = new Set(company.participants.map((p) => p.student.id));
                    const search = draftActive ? candidateDraft.search.trim().toLowerCase() : "";
                    const addable = students
                      .filter((s) => !participantIds.has(s.id))
                      .filter((s) => !search || `${s.name} ${s.regNo} ${s.department}`.toLowerCase().includes(search))
                      .slice(0, 200);
                    return (
                      <div key={company.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedCompanyId(isOpen ? null : company.id);
                            setCandidateDraft({ driveId: company.id, studentId: "", rounds: "0", search: "" });
                            setCandidateError("");
                          }}
                          className="w-full px-4 py-3 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-3 text-left"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {company.companyName} <span className="text-slate-400 font-normal">· {company.role}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {company.driveDate} · {company.packageLpa} LPA · {company.departments.join(", ")} ·{" "}
                              {company.participants.length} attending · {company.placedCount} selected
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(company.status)}`}>
                            {company.status}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-4 py-4 bg-slate-50 border-t border-slate-200 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                              {[
                                ["Total Rounds", company.totalRounds],
                                ["Current Phase", company.phaseLabel],
                                ["Current Round", company.status === "Past" ? "—" : `Round ${company.currentRound}`],
                                ["Current Round Students", company.currentRoundStudents],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-white border border-slate-200 p-3">
                                  <p className="text-slate-500">{label}</p>
                                  <p className="font-bold text-slate-800">{value}</p>
                                </div>
                              ))}
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 mb-2">Branch-wise breakdown</h4>
                              {company.branchBreakdown.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                  <table className="w-full min-w-[640px] text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                                      <tr>
                                        {["Branch", "Students", "Drive status", "Phase", "Current round", "In current round"].map((h) => (
                                          <th key={h} className="p-3 font-semibold">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {company.branchBreakdown.map((row) => (
                                        <tr key={row.branch} className="border-t border-slate-100 hover:bg-slate-50/80">
                                          <td className="p-3 font-medium text-slate-800">{row.branch}</td>
                                          <td className="p-3 text-slate-700">{row.totalStudents}</td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(row.driveStatus)}`}>
                                              {row.driveStatus}
                                            </span>
                                          </td>
                                          <td className="p-3 text-slate-700">{row.phaseLabel}</td>
                                          <td className="p-3 text-slate-700">
                                            {row.currentRound == null ? "—" : `Round ${row.currentRound}`}
                                          </td>
                                          <td className="p-3 font-semibold text-slate-800">{row.currentRoundStudents}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2">
                                  No students attending yet. Add students below, or record an offer from the PO dashboard.
                                </p>
                              )}
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 mb-2">Students attending</h4>
                              {company.participants.length > 0 && (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white mb-3">
                                  <table className="w-full min-w-[720px] text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                                      <tr>
                                        {["Reg No", "Name", "Dept", "Rounds cleared", "Result", ""].map((h) => (
                                          <th key={h} className="p-3 font-semibold">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {company.participants.map((p) => {
                                        const key = `${company.id}:${p.student.id}`;
                                        const editValue = roundEdits[key] ?? String(p.roundsCleared);
                                        const dirty = editValue !== String(p.roundsCleared);
                                        return (
                                          <tr key={p.student.id} className="border-t border-slate-100">
                                            <td className="p-3 text-slate-600">{p.student.regNo}</td>
                                            <td className="p-3 font-medium text-slate-800">{p.student.name}</td>
                                            <td className="p-3 text-slate-600">{p.student.department}</td>
                                            <td className="p-3">
                                              {p.placed ? (
                                                <span className="text-slate-700">
                                                  {company.rounds}/{company.rounds}
                                                </span>
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={company.rounds}
                                                    step={1}
                                                    value={editValue}
                                                    onChange={(e) => setRoundEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                                                    className="w-20 border border-slate-200 rounded-lg px-2 py-1"
                                                    aria-label={`Rounds cleared by ${p.student.name}`}
                                                  />
                                                  <span className="text-xs text-slate-400">/ {company.rounds}</span>
                                                  {dirty && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSaveRounds(company, p)}
                                                      disabled={busyKey === `rounds:${key}`}
                                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
                                                    >
                                                      {busyKey === `rounds:${key}` ? "Saving…" : "Save"}
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                            <td className="p-3">
                                              {p.placed ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                  Placed · {p.offer?.packageLpa || company.packageLpa} LPA
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                                  In process
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-3 text-right">
                                              {p.fromOffer ? (
                                                <span className="text-xs text-slate-400" title="Edit offers from the PO dashboard">
                                                  From PO offer
                                                </span>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveCandidate(company, p)}
                                                  disabled={busyKey === `remove:${company.id}:${p.student.id}`}
                                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                                                >
                                                  Remove
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold text-slate-600 mb-2">Add a student to this drive</p>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                  <input
                                    type="search"
                                    placeholder="Filter by name, reg no, dept"
                                    value={draftActive ? candidateDraft.search : ""}
                                    onChange={(e) =>
                                      setCandidateDraft((prev) => ({ ...prev, driveId: company.id, search: e.target.value }))
                                    }
                                    maxLength={60}
                                    className="md:col-span-4 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                  />
                                  <select
                                    value={draftActive ? candidateDraft.studentId : ""}
                                    onChange={(e) =>
                                      setCandidateDraft((prev) => ({ ...prev, driveId: company.id, studentId: e.target.value }))
                                    }
                                    className="md:col-span-4 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  >
                                    <option value="">Select student ({addable.length})</option>
                                    {addable.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name} — {s.regNo} — {s.department}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min={0}
                                    max={company.rounds}
                                    step={1}
                                    value={draftActive ? candidateDraft.rounds : "0"}
                                    onChange={(e) =>
                                      setCandidateDraft((prev) => ({ ...prev, driveId: company.id, rounds: e.target.value }))
                                    }
                                    className="md:col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                    aria-label="Rounds cleared"
                                    title="Rounds cleared"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddCandidate(company)}
                                    disabled={busyKey === `add:${company.id}` || !(draftActive && candidateDraft.studentId)}
                                    className="md:col-span-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2 disabled:opacity-50"
                                  >
                                    {busyKey === `add:${company.id}` ? "Adding…" : "Add"}
                                  </button>
                                </div>
                                {draftActive && candidateError && (
                                  <p className="mt-2 text-xs font-medium text-rose-600">{candidateError}</p>
                                )}
                                <p className="mt-2 text-[11px] text-slate-400">
                                  Students with a PO offer from {company.companyName} in {company.driveDate.slice(0, 4)} appear here automatically as placed.
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditDrive(company)}
                                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
                              >
                                Edit drive
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDrive(company)}
                                disabled={busyKey === `delete:${company.id}`}
                                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50"
                              >
                                {busyKey === `delete:${company.id}` ? "Deleting…" : "Delete drive"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {companyProgressList.length === 0 && (
                    <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                      {placementSearch
                        ? "No drives match your search."
                        : `No drives for ${selectedYear === "all" ? "any year" : selectedYear} yet. Use “+ Add Drive” to create one.`}
                    </p>
                  )}
                </div>
              </Card>
            </section>

            {/* ANALYTICS */}
            <section ref={analyticsRef} className="scroll-mt-28 space-y-10">
              <div>
                <SectionHeader title="Company Analytics" subtitle="Company-wise performance with department-wise round stats" />
                <AnalyticsTable
                  title="Company Wise Analytics"
                  firstColumn="Company Name"
                  rows={companyAnalytics}
                  description="Includes drive attendance and every PO-recorded offer. Round Stats: Round N --> DEPT-count. Off-campus offers count as placed with 0 rounds."
                />
              </div>
              <div>
                <SectionHeader title="Department Analytics" subtitle="Department-wise performance with company-wise round stats" />
                <AnalyticsTable
                  title="Department Wise Analytics"
                  firstColumn="Department Name"
                  rows={departmentAnalytics}
                  description="Same numbers grouped by department; round breakdowns are by company (e.g. Round 1 --> TCS-5)."
                />
              </div>
            </section>
          </>
        )}
      </main>

      {showDriveModal && (
        <Modal title={editingDriveId ? "Edit Placement Drive" : "Add Placement Drive"} onClose={closeDriveModal}>
          <form onSubmit={handleSaveDrive} noValidate className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Company name *" error={driveErrors.companyName}>
                <input
                  value={driveForm.companyName}
                  onChange={(e) => updateDriveField("companyName", e.target.value)}
                  maxLength={LIMITS.nameMax}
                  placeholder="e.g. Infosys"
                  className={inputClass}
                />
              </Field>
              <Field label="Role *" error={driveErrors.role}>
                <input
                  value={driveForm.role}
                  onChange={(e) => updateDriveField("role", e.target.value)}
                  maxLength={LIMITS.nameMax}
                  placeholder="e.g. Systems Engineer"
                  className={inputClass}
                />
              </Field>
              <Field label="Package (LPA) *" error={driveErrors.packageLpa} hint={`${LIMITS.packageMin} – ${LIMITS.packageMax} LPA`}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={LIMITS.packageMin}
                  max={LIMITS.packageMax}
                  value={driveForm.packageLpa}
                  onChange={(e) => updateDriveField("packageLpa", e.target.value)}
                  placeholder="e.g. 6.5"
                  className={inputClass}
                />
              </Field>
              <Field label="Drive date *" error={driveErrors.driveDate}>
                <input
                  type="date"
                  value={driveForm.driveDate}
                  onChange={(e) => updateDriveField("driveDate", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Openings *" error={driveErrors.openings} hint={`1 – ${LIMITS.openingsMax}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITS.openingsMax}
                  step={1}
                  value={driveForm.openings}
                  onChange={(e) => updateDriveField("openings", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Number of rounds *" error={driveErrors.rounds} hint={`1 – ${LIMITS.roundsMax}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITS.roundsMax}
                  step={1}
                  value={driveForm.rounds}
                  onChange={(e) => updateDriveField("rounds", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Max backlogs allowed" error={driveErrors.maxBacklogs} hint="Leave empty for no limit">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={LIMITS.backlogsMax}
                  step={1}
                  value={driveForm.maxBacklogs}
                  onChange={(e) => updateDriveField("maxBacklogs", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Eligible departments *" error={driveErrors.departments}>
              <div className="flex flex-wrap gap-2">
                {[ALL_DEPARTMENTS, ...departmentOptions].map((dept) => {
                  const active = driveForm.departments.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${
                        active
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                      }`}
                    >
                      {dept === ALL_DEPARTMENTS ? "All departments" : dept}
                    </button>
                  );
                })}
              </div>
            </Field>

            {driveSubmitError && (
              <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700">
                {driveSubmitError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={driveSaving}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-2xl font-semibold disabled:opacity-60"
              >
                {driveSaving ? "Saving…" : editingDriveId ? "Update Drive" : "Save Drive"}
              </button>
              <button
                type="button"
                onClick={closeDriveModal}
                disabled={driveSaving}
                className="bg-slate-200 hover:bg-slate-300 px-5 py-3 rounded-2xl font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
