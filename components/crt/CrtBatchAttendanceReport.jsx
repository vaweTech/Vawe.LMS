"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { BellRing, CalendarCheck, Download, Percent, RefreshCw, TrendingDown, Users } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { csvEscape } from "@/lib/crtPlacementData";
import {
  LOW_ATTENDANCE_PERCENT,
  fetchBatchAttendanceSessions,
  isSessionHeld,
  localDateStr,
  normalizeBatchStudent,
  sendAttendanceAlert,
  studentAttendance,
  wasEnrolledFor,
} from "@/lib/crtAttendance";

const DAY_MS = 86400000;

export const reportInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#00448a] focus:ring-2 focus:ring-blue-100 outline-none";

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function alertSummary(res) {
  const parts = [];
  if (res.emailConfigured) parts.push(`${res.emailSent} email(s) sent`);
  if (res.whatsappConfigured) parts.push(`${res.whatsappSent} WhatsApp message(s) sent`);
  if (!res.emailConfigured && !res.whatsappConfigured) parts.push("No email or WhatsApp is configured on the server");
  if (res.skipped) parts.push(`${res.skipped} skipped (no contact details)`);
  if (res.failed) parts.push(`${res.failed} failed`);
  return parts.join(" · ");
}

/** Attendance report for one CRT batch: summary, daily absentees, student-wise %, alerts. */
export default function CrtBatchAttendanceReport({ programId, batchId, batchName = "" }) {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("all");
  const [fromDate, setFromDate] = useState(() => localDateStr(new Date(Date.now() - 30 * DAY_MS)));
  const [toDate, setToDate] = useState(() => localDateStr());

  const [roster, setRoster] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [chapterTitles, setChapterTitles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [dailyDate, setDailyDate] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [alertBusy, setAlertBusy] = useState("");
  const [alertResult, setAlertResult] = useState("");

  useEffect(() => {
    setCourses([]);
    setCourseId("all");
    if (!programId) return;
    getDocs(collection(db, "crt", programId, "courses"))
      .then((snap) =>
        setCourses(
          snap.docs
            .map((d) => ({ id: d.id, name: d.data()?.title || d.data()?.name || d.id }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setCourses([]));
  }, [programId]);

  useEffect(() => {
    setRoster([]);
    setSessions([]);
    setAlertResult("");
    if (!programId || !batchId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      getDocs(collection(db, "crt", programId, "batches", batchId, "students")),
      fetchBatchAttendanceSessions(db, programId, batchId),
    ])
      .then(async ([stSnap, list]) => {
        if (cancelled) return;
        setRoster(stSnap.docs.map(normalizeBatchStudent).sort((a, b) => a.name.localeCompare(b.name)));
        setSessions(list);

        const courseIds = [...new Set(list.map((s) => s.courseId))];
        const titles = {};
        await Promise.all(
          courseIds.map(async (cid) => {
            try {
              const chSnap = await getDocs(collection(db, "crt", programId, "courses", cid, "chapters"));
              chSnap.docs.forEach((c, i) => {
                const x = c.data() || {};
                const day = typeof x.order === "number" ? x.order : i + 1;
                titles[`${cid}::${c.id}`] = `Day ${day}${x.title || x.name ? ` · ${x.title || x.name}` : ""}`;
              });
            } catch (_) {
              /* chapter titles are optional */
            }
          })
        );
        if (!cancelled) setChapterTitles(titles);
      })
      .catch((e) => !cancelled && setError(e?.message || "Could not load attendance."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [programId, batchId, reloadKey]);

  const courseName = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses]);
  const sessionLabel = (s) =>
    `${courseName.get(s.courseId) || "Course"} · ${chapterTitles[`${s.courseId}::${s.chapterId}`] || "Day"}`;

  const filteredSessions = useMemo(
    () =>
      sessions
        .filter((s) => (courseId === "all" || s.courseId === courseId) && s.date >= fromDate && s.date <= toDate)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sessions, courseId, fromDate, toDate]
  );
  const heldSessions = useMemo(() => filteredSessions.filter(isSessionHeld), [filteredSessions]);

  /** Students who were in the batch for some of these sessions but have since been removed. */
  const formerStudents = useMemo(() => {
    const current = new Set(roster.map((r) => r.presentId));
    const names = new Map();
    [...filteredSessions].reverse().forEach((s) => {
      [...(s.roster || []), ...s.present].forEach((id) => {
        if (current.has(id)) return;
        names.set(id, s.rosterNames?.[id] || names.get(id) || "");
      });
    });
    return [...names.entries()].map(([presentId, name]) => ({
      presentId,
      name: name || "Former student",
      rollNo: "",
      email: "",
      joinDate: "",
      former: true,
    }));
  }, [roster, filteredSessions]);

  const studentRows = useMemo(() => {
    const rows = [...roster, ...formerStudents].map((st) => ({ ...st, ...studentAttendance(heldSessions, st) }));
    return rows.sort((a, b) => Number(!!a.former) - Number(!!b.former) || a.percent - b.percent || a.name.localeCompare(b.name));
  }, [roster, formerStudents, heldSessions]);

  const currentRows = studentRows.filter((r) => !r.former);
  const lowRows = currentRows.filter((r) => r.total > 0 && r.percent < LOW_ATTENDANCE_PERCENT);
  const avgPercent = currentRows.filter((r) => r.total > 0).length
    ? Math.round(
        currentRows.filter((r) => r.total > 0).reduce((sum, r) => sum + r.percent, 0) /
          currentRows.filter((r) => r.total > 0).length
      )
    : 0;

  const sessionDates = useMemo(() => [...new Set(filteredSessions.map((s) => s.date))], [filteredSessions]);
  useEffect(() => {
    if (!sessionDates.includes(dailyDate)) setDailyDate(sessionDates[0] || "");
  }, [sessionDates, dailyDate]);
  const dailySessions = filteredSessions.filter((s) => s.date === dailyDate);

  const absenteesFor = (s) => {
    if (!isSessionHeld(s)) return [];
    const presentSet = new Set(s.present);
    return roster.filter((st) => wasEnrolledFor(s, st) && !presentSet.has(st.presentId));
  };

  const runAlert = async (key, payload, confirmText) => {
    if (!window.confirm(confirmText)) return;
    setAlertBusy(key);
    setAlertResult("");
    try {
      const res = await sendAttendanceAlert(auth.currentUser, { programId, batchId, ...payload });
      setAlertResult(alertSummary(res));
    } catch (e) {
      setAlertResult(e?.message || "Could not send alerts.");
    } finally {
      setAlertBusy("");
    }
  };

  const notifyAbsentees = (s) => {
    const absent = absenteesFor(s);
    runAlert(
      `absent:${s.id}`,
      { kind: "absence", date: s.date, courseLabel: sessionLabel(s), items: absent.map((a) => a.presentId) },
      `Send an absence alert to ${absent.length} student(s) for ${s.date}?`
    );
  };

  const notifyLow = () =>
    runAlert(
      "low",
      {
        kind: "low",
        threshold: LOW_ATTENDANCE_PERCENT,
        items: lowRows.map((r) => ({ presentId: r.presentId, percent: r.percent, present: r.present, total: r.total })),
      },
      `Send a low-attendance alert to ${lowRows.length} student(s) below ${LOW_ATTENDANCE_PERCENT}%?`
    );

  const exportCsv = () => {
    const header = ["Name", "Roll No", "Email", "Status", "Joined", "Present", "Sessions", "Attendance %"];
    const lines = studentRows.map((r) =>
      [r.name, r.rollNo, r.email, r.former ? "Left batch" : "In batch", r.joinDate, r.present, r.total, r.percent]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crt-attendance-${batchName || batchId}-${fromDate}-to-${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const visibleRows = onlyLow ? lowRows : studentRows;

  if (!programId || !batchId) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm grid gap-4 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600 space-y-1">
          <span>Course</span>
          <select className={reportInputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 space-y-1">
          <span>From</span>
          <input
            type="date"
            className={reportInputClass}
            value={fromDate}
            max={toDate}
            onChange={(e) => e.target.value && setFromDate(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-slate-600 space-y-1">
          <span>To</span>
          <input
            type="date"
            className={reportInputClass}
            value={toDate}
            min={fromDate}
            onChange={(e) => e.target.value && setToDate(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {alertResult && (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{alertResult}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Students in batch" value={roster.length} icon={Users} accent="bg-gradient-to-br from-blue-500 to-indigo-600" />
            <StatCard
              label="Classes held"
              value={`${heldSessions.length}${filteredSessions.length > heldSessions.length ? ` (+${filteredSessions.length - heldSessions.length} not held)` : ""}`}
              icon={CalendarCheck}
              accent="bg-gradient-to-br from-cyan-500 to-sky-600"
            />
            <StatCard label="Average attendance" value={`${avgPercent}%`} icon={Percent} accent="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <StatCard
              label={`Below ${LOW_ATTENDANCE_PERCENT}%`}
              value={lowRows.length}
              icon={TrendingDown}
              accent="bg-gradient-to-br from-rose-500 to-pink-600"
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Daily attendance</h2>
              {sessionDates.length > 0 && (
                <select className={`${reportInputClass} w-auto`} value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}>
                  {sessionDates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>
            {dailySessions.length === 0 ? (
              <p className="text-sm text-slate-500">No classes were marked in this date range.</p>
            ) : (
              <div className="space-y-3">
                {dailySessions.map((s) => {
                  if (!isSessionHeld(s)) {
                    return (
                      <div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                        <span className="font-medium text-slate-900">{sessionLabel(s)}</span>
                        <span className="ml-2 font-semibold text-amber-800">Class not held</span>
                        {s.markedByName && <span className="ml-2 text-slate-500">· marked by {s.markedByName}</span>}
                      </div>
                    );
                  }
                  const absent = absenteesFor(s);
                  const expected = roster.filter((st) => wasEnrolledFor(s, st)).length;
                  return (
                    <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">
                          {sessionLabel(s)}
                          {s.markedByName && <span className="text-xs font-normal text-slate-500"> · marked by {s.markedByName}</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span>
                            <span className="font-semibold text-emerald-700">{expected - absent.length} present</span>
                            <span className="text-slate-400"> / </span>
                            <span className="font-semibold text-rose-700">{absent.length} absent</span>
                          </span>
                          {absent.length > 0 && (
                            <button
                              type="button"
                              onClick={() => notifyAbsentees(s)}
                              disabled={!!alertBusy}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-medium hover:bg-rose-50 disabled:opacity-60"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              {alertBusy === `absent:${s.id}` ? "Sending…" : "Notify absentees"}
                            </button>
                          )}
                        </div>
                      </div>
                      {absent.length > 0 && (
                        <p className="mt-2 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Absent: </span>
                          {absent.map((st) => (st.rollNo ? `${st.name} (${st.rollNo})` : st.name)).join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Student-wise attendance</h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
                  Only below {LOW_ATTENDANCE_PERCENT}%
                </label>
                <button
                  onClick={notifyLow}
                  disabled={!lowRows.length || !!alertBusy}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-medium disabled:opacity-60"
                >
                  <BellRing className="w-4 h-4" />
                  {alertBusy === "low" ? "Sending…" : `Notify below ${LOW_ATTENDANCE_PERCENT}%`}
                </button>
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={exportCsv}
                  disabled={!studentRows.length}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-medium disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Roll No</th>
                    <th className="py-2 pr-4 font-medium">Joined</th>
                    <th className="py-2 pr-4 font-medium">Present</th>
                    <th className="py-2 pr-4 font-medium">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const low = !r.former && r.total > 0 && r.percent < LOW_ATTENDANCE_PERCENT;
                    return (
                      <tr key={r.presentId} className={`border-b border-slate-100 ${r.former ? "text-slate-400" : ""}`}>
                        <td className="py-2 pr-4">
                          <span className={r.former ? "" : "text-slate-900"}>{r.name}</span>
                          {r.former && (
                            <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                              Left batch
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{r.rollNo || "—"}</td>
                        <td className="py-2 pr-4">{r.joinDate || "—"}</td>
                        <td className="py-2 pr-4">
                          {r.present} / {r.total}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full ${r.former ? "bg-slate-300" : low ? "bg-rose-500" : "bg-emerald-500"}`}
                                style={{ width: `${r.percent}%` }}
                              />
                            </div>
                            <span className={`font-semibold ${r.former ? "" : low ? "text-rose-700" : "text-emerald-700"}`}>
                              {r.percent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        {onlyLow ? `No students below ${LOW_ATTENDANCE_PERCENT}%.` : "No students in this batch."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
