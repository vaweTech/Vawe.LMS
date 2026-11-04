"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, ClipboardList, Code2, FileCheck, GraduationCap, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { computeCrtStudentAttendance, LOW_ATTENDANCE_PERCENT } from "@/lib/crtAttendance";
import { fetchMyCrtScores, findMyCrtEnrollments } from "@/lib/crtStudentProgress";
import { ASSIGNMENT_PASS_PERCENT } from "@/lib/assignmentScores";

/** CRT programmes the signed-in student is enrolled in: { enrollments, loading }. */
export function useMyCrtEnrollments(user) {
  const [state, setState] = useState({ enrollments: [], loading: true });
  useEffect(() => {
    if (!user?.uid) {
      setState({ enrollments: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    findMyCrtEnrollments(db, user)
      .then((list) => !cancelled && setState({ enrollments: list, loading: false }))
      .catch(() => !cancelled && setState({ enrollments: [], loading: false }));
    return () => {
      cancelled = true;
    };
  }, [user]);
  return state;
}

function batchLabel(enrollment) {
  const names = (enrollment?.batches || []).map((b) => b.batchName).filter(Boolean);
  return names.length ? names.join(", ") : "Batch not assigned yet";
}

function attendanceTone(percent, total) {
  if (!total) return "text-slate-500";
  return percent < LOW_ATTENDANCE_PERCENT ? "text-rose-600" : "text-emerald-600";
}

/**
 * One-line "which programme am I in" bar for CRT pages. Pass `crtId` on programme pages to also say
 * when the student is viewing a programme they are not enrolled in.
 */
export function CrtProgrammeStrip({ user, crtId = null, className = "" }) {
  const { enrollments, loading } = useMyCrtEnrollments(user);
  const enrollment = crtId ? enrollments.find((e) => e.crtId === crtId) : enrollments[0];
  const [attendance, setAttendance] = useState(null);

  useEffect(() => {
    if (!enrollment?.crtId || !user?.uid) {
      setAttendance(null);
      return;
    }
    let cancelled = false;
    computeCrtStudentAttendance(db, user, enrollment.crtId)
      .then((s) => !cancelled && setAttendance(s))
      .catch(() => !cancelled && setAttendance(null));
    return () => {
      cancelled = true;
    };
  }, [enrollment?.crtId, user]);

  if (loading || !user?.uid) return null;

  if (!enrollment) {
    if (!crtId) return null;
    const mine = enrollments[0];
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ${className}`}>
        You are not enrolled in this programme.
        {mine && (
          <>
            {" "}Your programme is{" "}
            <Link href={`/crt/${mine.slug}`} className="font-semibold underline">
              {mine.programName}
            </Link>
            .
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-[#00448a]/15 bg-white/95 px-4 py-2.5 text-sm shadow-sm ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#00448a]">
        <GraduationCap className="h-4 w-4" />
        <Link href={`/crt/${enrollment.slug}`} className="hover:underline">
          {enrollment.programName}
        </Link>
      </span>
      <span className="inline-flex items-center gap-1.5 text-slate-600">
        <Users className="h-4 w-4 text-slate-400" />
        {batchLabel(enrollment)}
      </span>
      <span className="inline-flex items-center gap-1.5 text-slate-600">
        <CalendarCheck className="h-4 w-4 text-slate-400" />
        Attendance:{" "}
        {attendance == null ? (
          "…"
        ) : attendance.total > 0 ? (
          <span className={`font-semibold ${attendanceTone(attendance.percent, attendance.total)}`}>
            {attendance.percent}% ({attendance.present}/{attendance.total})
          </span>
        ) : (
          "not recorded yet"
        )}
      </span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, tone = "text-slate-900" }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={`mt-1 text-lg sm:text-xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function scoreValue(t) {
  if (!t.total) return "—";
  if (t.average != null) return `${t.average}%`;
  return t.submitted ? "Submitted" : "—";
}

function scoreSub(t) {
  if (!t.total) return "None assigned";
  const parts = [`${t.submitted}/${t.total} done`];
  if (t.awaitingReview) parts.push(`${t.awaitingReview} awaiting review`);
  return parts.join(" · ");
}

/** Full "my progress" card for one enrolled programme: identity, attendance, scores by type, item list. */
export default function MyCrtProgressCard({ user, enrollment, showProgrammeLink = true }) {
  const [attendance, setAttendance] = useState(null);
  const [scores, setScores] = useState(null);
  useEffect(() => {
    if (!enrollment?.crtId || !user?.uid) return;
    let cancelled = false;
    setAttendance(null);
    setScores(null);
    computeCrtStudentAttendance(db, user, enrollment.crtId)
      .then((s) => !cancelled && setAttendance(s))
      .catch(() => !cancelled && setAttendance({ total: 0, present: 0, percent: 0, history: [] }));
    const batchIds = (enrollment.batches || []).map((b) => b.batchId);
    fetchMyCrtScores(db, user, enrollment.crtId, enrollment.slug, batchIds)
      .then((s) => !cancelled && setScores(s))
      .catch(() => !cancelled && setScores({ items: [], summary: null, courses: [] }));
    return () => {
      cancelled = true;
    };
  }, [enrollment, user]);

  const byType = scores?.summary?.byType;

  if (!enrollment) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 shadow-md overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-[#00448a] to-[#1a6bb8] px-4 py-3 sm:px-5 sm:py-4 text-white">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Your current programme</p>
          <h3 className="text-base sm:text-lg font-bold leading-tight break-words">{enrollment.programName}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
            <Users className="h-4 w-4" />
            {batchLabel(enrollment)}
          </p>
        </div>
        {showProgrammeLink && (
          <Link
            href={`/crt/${enrollment.slug}`}
            className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
          >
            Open programme →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={CalendarCheck}
          label="Attendance"
          value={attendance == null ? "…" : attendance.total > 0 ? `${attendance.percent}%` : "—"}
          sub={
            attendance == null
              ? "Loading"
              : attendance.total > 0
                ? `${attendance.present}/${attendance.total} classes${
                    attendance.percent < LOW_ATTENDANCE_PERCENT ? ` · below ${LOW_ATTENDANCE_PERCENT}%` : ""
                  }`
                : "Not recorded yet"
          }
          tone={attendance ? attendanceTone(attendance.percent, attendance.total) : "text-slate-400"}
        />
        <StatTile
          icon={ClipboardList}
          label="MCQ assignments"
          value={byType ? scoreValue(byType.mcq) : "…"}
          sub={byType ? scoreSub(byType.mcq) : "Loading"}
        />
        <StatTile
          icon={Code2}
          label="Coding assignments"
          value={byType ? scoreValue(byType.coding) : "…"}
          sub={byType ? scoreSub(byType.coding) : "Loading"}
        />
        <StatTile
          icon={FileCheck}
          label="Full tests"
          value={byType ? scoreValue(byType.exam) : "…"}
          sub={byType ? scoreSub(byType.exam) : "Loading"}
        />
      </div>

      <div className="border-t border-slate-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">Assignment & test scores</h4>
        {scores == null ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading scores…</p>
        ) : !scores.courses?.length ? (
          <p className="py-4 text-center text-sm text-slate-500">No courses in this programme yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {scores.courses.map((c) => (
              <li key={c.courseId}>
                <Link href={c.href} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{c.courseTitle}</p>
                    <p className="text-xs text-slate-500">
                      Classes unlocked:{" "}
                      <span className="font-semibold text-slate-700">
                        {c.unlockedClasses}
                        {c.totalClasses > 0 ? ` / ${c.totalClasses}` : ""}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {c.averageScore == null ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        No score yet
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          c.averageScore >= ASSIGNMENT_PASS_PERCENT
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        Avg {c.averageScore}%
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
