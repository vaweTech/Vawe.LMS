"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft, Crosshair, ExternalLink, Loader2, MapPin, RefreshCw, RotateCcw, Save, ScanFace } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { localDateStr } from "@/lib/crtAttendance";
import { frsRequest, getPreciseLocation } from "@/lib/crtFrsClient";
import { useAdminAccess } from "../../AdminAccessContext";

const RADIUS_PRESETS = [50, 100, 200, 500];
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#00448a] focus:outline-none focus:ring-2 focus:ring-[#00448a]/20";

const EMPTY_FENCE = {
  enabled: false,
  label: "",
  lat: "",
  lng: "",
  radiusM: 100,
  checkInStart: "",
  checkInEnd: "",
  maxAccuracyM: 150,
};

function fenceForm(g) {
  if (!g) return { ...EMPTY_FENCE };
  return {
    enabled: g.enabled === true,
    label: g.label || "",
    lat: g.lat ?? "",
    lng: g.lng ?? "",
    radiusM: g.radiusM || 100,
    checkInStart: g.checkInStart || "",
    checkInEnd: g.checkInEnd || "",
    maxAccuracyM: g.maxAccuracyM || 150,
  };
}

function formatTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";
}

const REASONS = { face_mismatch: "Face did not match", out_of_range: "Outside the radius" };

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export default function CrtFrsAdminPage() {
  const { user, loading: accessLoading, hasCrtManagerAccess } = useAdminAccess();
  if (accessLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  if (!user || !hasCrtManagerAccess) {
    return <div className="p-8 text-center text-sm text-slate-600">You do not have access to this page.</div>;
  }
  return <FrsAdmin />;
}

function FrsAdmin() {
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState("");
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [form, setForm] = useState(EMPTY_FENCE);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [date, setDate] = useState(() => localDateStr());
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [resettingUid, setResettingUid] = useState("");

  useEffect(() => {
    getDocs(collection(db, "crt"))
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, name: d.data()?.name || d.id }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setPrograms(list);
        setProgramId((cur) => cur || list[0]?.id || "");
      })
      .catch(() => setPrograms([]));
  }, []);

  const loadBatches = useCallback(async () => {
    if (!programId) {
      setBatches([]);
      return;
    }
    const snap = await getDocs(collection(db, "crt", programId, "batches"));
    const list = snap.docs
      .map((d) => ({ id: d.id, name: d.data()?.name || d.id, geofence: d.data()?.geofence || null }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setBatches(list);
    setBatchId((cur) => (list.some((b) => b.id === cur) ? cur : list[0]?.id || ""));
  }, [programId]);

  useEffect(() => {
    loadBatches().catch(() => setBatches([]));
  }, [loadBatches]);

  const batch = useMemo(() => batches.find((b) => b.id === batchId) || null, [batches, batchId]);

  useEffect(() => {
    setForm(fenceForm(batch?.geofence));
    setNotice(null);
  }, [batch]);

  const loadReport = useCallback(async () => {
    if (!programId || !batchId || !auth.currentUser) return;
    setReportLoading(true);
    setReportError("");
    try {
      setReport(await frsRequest(auth.currentUser, "adminList", { crtId: programId, batchId, date }));
    } catch (e) {
      setReport(null);
      setReportError(e.message);
    } finally {
      setReportLoading(false);
    }
  }, [programId, batchId, date]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const useMyLocation = async () => {
    setLocating(true);
    setNotice(null);
    try {
      const loc = await getPreciseLocation({ maxAccuracyM: 100, timeoutMs: 20000 });
      setForm((f) => ({ ...f, lat: loc.lat.toFixed(6), lng: loc.lng.toFixed(6) }));
      setNotice({ tone: "ok", text: `Location captured (accuracy ±${Math.round(loc.accuracy)} m). Save to apply.` });
    } catch (e) {
      setNotice({ tone: "error", text: e.message });
    } finally {
      setLocating(false);
    }
  };

  const validFence = () => {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const radiusM = Math.round(Number(form.radiusM));
    if (form.enabled) {
      if (!Number.isFinite(lat) || Math.abs(lat) > 90 || form.lat === "") return "Enter a valid latitude.";
      if (!Number.isFinite(lng) || Math.abs(lng) > 180 || form.lng === "") return "Enter a valid longitude.";
      if (!(radiusM >= 10 && radiusM <= 5000)) return "Radius must be between 10 m and 5000 m.";
    }
    if (form.checkInStart && form.checkInEnd && form.checkInStart >= form.checkInEnd) {
      return "Check-in start must be before the end time.";
    }
    return "";
  };

  const fencePayload = () => ({
    enabled: form.enabled,
    label: form.label.trim(),
    lat: form.lat === "" ? null : Number(form.lat),
    lng: form.lng === "" ? null : Number(form.lng),
    radiusM: Math.round(Number(form.radiusM)) || 100,
    checkInStart: form.checkInStart,
    checkInEnd: form.checkInEnd,
    maxAccuracyM: Math.round(Number(form.maxAccuracyM)) || 150,
  });

  const save = async (allBatches = false) => {
    const err = validFence();
    if (err) {
      setNotice({ tone: "error", text: err });
      return;
    }
    if (allBatches && !window.confirm(`Apply this location to all ${batches.length} batches of this programme?`)) return;
    setSaving(true);
    setNotice(null);
    try {
      const geofence = fencePayload();
      const ids = allBatches ? batches.map((b) => b.id) : [batchId];
      await Promise.all(
        ids.map((id) =>
          updateDoc(doc(db, "crt", programId, "batches", id), {
            geofence,
            geofenceUpdatedAt: serverTimestamp(),
            geofenceUpdatedBy: auth.currentUser?.uid || null,
          })
        )
      );
      await loadBatches();
      setNotice({ tone: "ok", text: allBatches ? `Saved for ${ids.length} batches.` : "Location saved." });
    } catch (e) {
      setNotice({ tone: "error", text: e?.message || "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const resetFace = async (s) => {
    if (!window.confirm(`Reset the face registration of ${s.name}? They will need to register again.`)) return;
    setResettingUid(s.profileUid);
    try {
      await frsRequest(auth.currentUser, "adminReset", { uid: s.profileUid });
      await loadReport();
    } catch (e) {
      alert(e.message);
    } finally {
      setResettingUid("");
    }
  };

  const students = report?.students || [];
  const registered = students.filter((s) => s.registered).length;
  const checkins = report?.checkins || [];
  const presentCount = new Set(checkins.filter((c) => c.result === "present").map((c) => c.presentId)).size;
  const mapsUrl =
    form.lat !== "" && form.lng !== "" ? `https://www.google.com/maps?q=${Number(form.lat)},${Number(form.lng)}` : "";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/Admin/crt" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <ScanFace className="h-5 w-5 text-[#00448a]" />
              Face attendance (FRS)
            </h1>
            <p className="text-sm text-slate-500">
              Set where each batch may check in, and review face registrations and check-ins. Biometric templates are
              encrypted server-side (set <code className="text-xs">FRS_BIOMETRIC_KEY</code>); merge{" "}
              <code className="text-xs">firestore.frs.rules</code> into production Firestore rules so clients cannot
              read face profiles.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Programme">
          <select className={inputClass} value={programId} onChange={(e) => setProgramId(e.target.value)}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Batch">
          <select className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.geofence?.enabled ? " · location set" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {batch && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-[#00448a]" />
              Check-in location · {batch.name}
            </h2>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#00448a]"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
              />
              Face check-in enabled
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Place name">
              <input
                className={inputClass}
                value={form.label}
                placeholder="e.g. Seminar Hall, Block A"
                onChange={(e) => set("label", e.target.value)}
              />
            </Field>
            <Field label="Latitude">
              <input className={inputClass} inputMode="decimal" value={form.lat} onChange={(e) => set("lat", e.target.value)} />
            </Field>
            <Field label="Longitude">
              <input className={inputClass} inputMode="decimal" value={form.lng} onChange={(e) => set("lng", e.target.value)} />
            </Field>
            <Field label="Radius (metres)">
              <input
                className={inputClass}
                type="number"
                min={10}
                max={5000}
                value={form.radiusM}
                onChange={(e) => set("radiusM", e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {RADIUS_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set("radiusM", r)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  Number(form.radiusM) === r
                    ? "border-[#00448a] bg-[#00448a] text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {r} m
              </button>
            ))}
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00448a]/30 px-3 py-1.5 text-sm font-medium text-[#00448a] hover:bg-blue-50 disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Use my current location
            </button>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-[#00448a]"
              >
                <ExternalLink className="h-4 w-4" />
                View on map
              </a>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Check-in opens (optional)">
              <input className={inputClass} type="time" value={form.checkInStart} onChange={(e) => set("checkInStart", e.target.value)} />
            </Field>
            <Field label="Check-in closes (optional)">
              <input className={inputClass} type="time" value={form.checkInEnd} onChange={(e) => set("checkInEnd", e.target.value)} />
            </Field>
            <Field label="Max GPS inaccuracy (m)" hint="Readings less precise than this are rejected.">
              <input
                className={inputClass}
                type="number"
                min={20}
                max={1000}
                value={form.maxAccuracyM}
                onChange={(e) => set("maxAccuracyM", e.target.value)}
              />
            </Field>
          </div>

          {notice && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                notice.tone === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {notice.text}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {batches.length > 1 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => save(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Save to all batches
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => save(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00448a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003a76] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save location
            </button>
          </div>
        </section>
      )}

      {batch && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Students &amp; check-ins</h2>
              <p className="text-sm text-slate-500">
                {registered}/{students.length} faces registered · {presentCount} checked in on {report?.date || date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={inputClass}
                value={date}
                max={localDateStr()}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                type="button"
                onClick={loadReport}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${reportLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {reportError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{reportError}</p>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Face registrations
              </p>
              <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                {students.map((s) => (
                  <li key={s.presentId} className="flex items-center gap-3 px-3 py-2">
                    {s.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <ScanFace className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {s.rollNo || s.email || s.presentId}
                        {s.registered && s.registeredAt
                          ? ` · registered ${new Date(s.registeredAt).toLocaleDateString("en-IN")}`
                          : ""}
                      </p>
                    </div>
                    {s.registered ? (
                      <button
                        type="button"
                        disabled={resettingUid === s.profileUid}
                        onClick={() => resetFace(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </button>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Not registered
                      </span>
                    )}
                  </li>
                ))}
                {!students.length && !reportLoading && (
                  <li className="px-3 py-6 text-center text-sm text-slate-500">No students in this batch.</li>
                )}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Check-in log
              </p>
              <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                {checkins.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                    {c.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {c.name || c.presentId}
                        <span className="ml-2 text-xs font-normal text-slate-500">{formatTime(c.at)}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {c.chapterTitle ? `${c.chapterTitle} · ` : ""}
                        {c.distanceM != null ? `${c.distanceM} m away · ` : ""}
                        {c.match != null ? `match ${(Math.max(0, 1 - c.match) * 100).toFixed(0)}%` : ""}
                      </p>
                    </div>
                    {c.result === "present" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Present</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                        {REASONS[c.reason] || "Rejected"}
                      </span>
                    )}
                  </li>
                ))}
                {!checkins.length && !reportLoading && (
                  <li className="px-3 py-6 text-center text-sm text-slate-500">No face check-ins on this date.</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
