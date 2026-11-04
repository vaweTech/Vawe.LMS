"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { fetchSessionsOnDate, isSessionHeld, localDateStr } from "@/lib/crtAttendance";
import CrtBatchAttendanceReport, { reportInputClass } from "@/components/crt/CrtBatchAttendanceReport";

/** Every active batch across CRT programmes: [{ programId, programName, batchId, batchName }]. */
async function fetchAllBatches() {
  const programsSnap = await getDocs(collection(db, "crt"));
  const lists = await Promise.all(
    programsSnap.docs.map(async (p) => {
      const programName = p.data()?.name || p.id;
      try {
        const bSnap = await getDocs(collection(db, "crt", p.id, "batches"));
        return bSnap.docs
          .filter((b) => String(b.data()?.status || "active").toLowerCase() !== "completed")
          .map((b) => ({ programId: p.id, programName, batchId: b.id, batchName: b.data()?.name || b.id }));
      } catch (_) {
        return [];
      }
    })
  );
  return lists
    .flat()
    .sort(
      (a, b) =>
        a.programName.localeCompare(b.programName) ||
        a.batchName.localeCompare(b.batchName, undefined, { numeric: true })
    );
}

function DailyOverview({ batches, onOpen }) {
  const [date, setDate] = useState(() => localDateStr());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchSessionsOnDate(db, date)
      .then((list) => !cancelled && setSessions(list))
      .catch((e) => !cancelled && setError(e?.message || "Could not load today's attendance."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  const rows = useMemo(() => {
    const byBatch = new Map();
    sessions.forEach((s) => {
      const key = `${s.crtProgramId}__${s.batchId}`;
      if (!byBatch.has(key)) byBatch.set(key, []);
      byBatch.get(key).push(s);
    });
    return batches.map((b) => {
      const list = byBatch.get(`${b.programId}__${b.batchId}`) || [];
      const held = list.filter(isSessionHeld);
      let expected = 0;
      let present = 0;
      held.forEach((s) => {
        expected += s.roster ? s.roster.length : s.rosterSize || s.present.length;
        present += s.present.length;
      });
      return {
        ...b,
        marked: list.length,
        held: held.length,
        notHeld: list.length - held.length,
        percent: expected > 0 ? Math.round((present / expected) * 100) : null,
      };
    });
  }, [batches, sessions]);

  const notMarked = rows.filter((r) => r.marked === 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">All batches</h2>
          <p className="text-xs text-slate-500">Click a batch to open its full report below.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className={`${reportInputClass} w-auto`}
            value={date}
            max={localDateStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {!loading && notMarked.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{notMarked.length}</strong> active batch(es) have no attendance marked for {date}:{" "}
            {notMarked.map((r) => `${r.programName} · ${r.batchName}`).join(", ")}. If they had class, remind the trainer.
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4 font-medium">Programme</th>
              <th className="py-2 pr-4 font-medium">Batch</th>
              <th className="py-2 pr-4 font-medium">Classes marked</th>
              <th className="py-2 pr-4 font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.programId}__${r.batchId}`}
                onClick={() => onOpen(r.programId, r.batchId)}
                className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
              >
                <td className="py-2 pr-4 text-slate-700">{r.programName}</td>
                <td className="py-2 pr-4 font-medium text-slate-900">{r.batchName}</td>
                <td className="py-2 pr-4">
                  {r.marked === 0 ? (
                    <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Not marked
                    </span>
                  ) : (
                    <span className="text-slate-700">
                      {r.held}
                      {r.notHeld > 0 && <span className="text-slate-400"> (+{r.notHeld} not held)</span>}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {r.percent == null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className={`font-semibold ${r.percent < 75 ? "text-rose-700" : "text-emerald-700"}`}>
                      {r.percent}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  {loading ? "Loading…" : "No active batches found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CrtAttendanceReportPage() {
  const [batches, setBatches] = useState([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAllBatches()
      .then(setBatches)
      .catch((e) => setError(e?.message || "Could not load CRT batches."));
  }, []);

  const programs = useMemo(() => {
    const map = new Map();
    batches.forEach((b) => map.set(b.programId, b.programName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [batches]);
  const programBatches = batches.filter((b) => b.programId === programId);
  const selected = batches.find((b) => b.programId === programId && b.batchId === batchId);

  const openBatch = (pid, bid) => {
    setProgramId(pid);
    setBatchId(bid);
    setTimeout(() => document.getElementById("batch-report")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4 py-8 sm:py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">CRT Attendance</h1>
            <p className="text-sm text-slate-600 mt-1">
              Daily class attendance marked by trainers: all batches at a glance, then batch-wise and student-wise.
            </p>
          </div>
          <Link
            href="/Admin/crt"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to CRT
          </Link>
        </div>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <DailyOverview batches={batches} onOpen={openBatch} />

        <div id="batch-report" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600 space-y-1">
            <span>CRT programme</span>
            <select
              className={reportInputClass}
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setBatchId("");
              }}
            >
              <option value="">Select programme</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600 space-y-1">
            <span>Batch</span>
            <select
              className={reportInputClass}
              value={batchId}
              disabled={!programId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">Select batch</option>
              {programBatches.map((b) => (
                <option key={b.batchId} value={b.batchId}>{b.batchName}</option>
              ))}
            </select>
          </label>
        </div>

        {programId && batchId ? (
          <CrtBatchAttendanceReport
            key={`${programId}__${batchId}`}
            programId={programId}
            batchId={batchId}
            batchName={selected?.batchName}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Choose a CRT programme and batch (or click a batch above) to see its full report.
          </p>
        )}
      </div>
    </div>
  );
}
