"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Clock, Loader2, Lock, MapPin, RefreshCw, ScanFace } from "lucide-react";
import { checkFrsBrowserSupport, distanceMeters, frsRequest, getPreciseLocation } from "@/lib/crtFrsClient";

const FaceCaptureModal = dynamic(() => import("@/components/crt/FaceCaptureModal"), { ssr: false });

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ClassStatus({ cls }) {
  if (cls.notHeld) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Not held</span>;
  }
  if (cls.present) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Present{cls.viaFace ? ` · face ${formatTime(cls.checkedInAt)}` : " · marked by trainer"}
      </span>
    );
  }
  return null;
}

/** Face-recognition attendance for a CRT student: one-time locked registration, then geofenced face check-in. */
export default function CrtFaceAttendance({ user, crtId }) {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [capture, setCapture] = useState(null);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState(null);
  const [locationProgress, setLocationProgress] = useState(null);
  const [browserOk, setBrowserOk] = useState(null);

  useEffect(() => {
    setBrowserOk(checkFrsBrowserSupport());
  }, []);

  useEffect(() => {
    if (!user?.uid || !crtId) return;
    let cancelled = false;
    setLoadError("");
    frsRequest(user, "status", { crtId })
      .then((s) => !cancelled && setStatus(s))
      .catch((e) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [user, crtId, reloadKey]);

  useEffect(() => {
    if (!user?.uid || !crtId || capture) return;
    const bump = () => document.visibilityState === "visible" && setReloadKey((k) => k + 1);
    const timer = setInterval(bump, 60000);
    window.addEventListener("focus", bump);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", bump);
    };
  }, [user, crtId, capture]);

  const reload = () => setReloadKey((k) => k + 1);

  const beginCapture = async (kind, extra = {}) => {
    const support = browserOk || checkFrsBrowserSupport();
    if (!support.ok) throw new Error(support.reason);
    const challenge = await frsRequest(user, "challenge", { crtId, purpose: kind === "register" ? "register" : "checkIn" });
    setCapture({ kind, ...extra, challengeId: challenge.challengeId, challengeTurn: challenge.turn });
  };

  const handleRegistered = useCallback(
    async ({ descriptors, thumbnail, livenessTurn }) => {
      await frsRequest(user, "register", {
        crtId,
        descriptors,
        thumbnail,
        challengeId: capture?.challengeId,
        liveness: true,
        livenessTurn,
      });
      setMessage({ tone: "ok", text: "Face registered and locked. You can now check in to your classes." });
      setReloadKey((k) => k + 1);
    },
    [user, crtId, capture?.challengeId]
  );

  const startRegister = async () => {
    setMessage(null);
    setBusyKey("register");
    try {
      await beginCapture("register");
    } catch (e) {
      setMessage({ tone: "error", text: e.message });
    } finally {
      setBusyKey("");
    }
  };

  const startCheckIn = async (batch, cls) => {
    const key = `${batch.batchId}::${cls.courseId}::${cls.chapterId}`;
    setBusyKey(key);
    setMessage(null);
    setLocationProgress(null);
    try {
      const support = browserOk || checkFrsBrowserSupport();
      if (!support.ok) throw new Error(support.reason);
      const g = batch.geofence;
      const location = await getPreciseLocation({
        maxAccuracyM: g.maxAccuracyM || 150,
        onProgress: (r) => setLocationProgress(Math.round(r.accuracy)),
      });
      const away = Math.round(distanceMeters(location.lat, location.lng, g.lat, g.lng));
      if (away > g.radiusM + Math.min(location.accuracy || 0, 25)) {
        throw new Error(`You are ${away} m from ${g.label || "the class location"}. Check-in works only within ${g.radiusM} m.`);
      }
      await beginCapture("checkin", { batch, cls, location });
    } catch (e) {
      setMessage({ tone: "error", text: e.message });
    } finally {
      setBusyKey("");
      setLocationProgress(null);
    }
  };

  const handleCheckInCaptured = useCallback(
    async ({ descriptor, thumbnail, livenessTurn }) => {
      const { batch, cls } = capture;
      let location = capture.location;
      try {
        const fresh = await getPreciseLocation({
          maxAccuracyM: batch.geofence.maxAccuracyM || 150,
          timeoutMs: 6000,
        });
        if (fresh.accuracy <= location.accuracy * 2) location = fresh;
      } catch (_) {
        /* keep the location taken before the camera opened */
      }
      const res = await frsRequest(user, "checkIn", {
        crtId,
        batchId: batch.batchId,
        courseId: cls.courseId,
        chapterId: cls.chapterId,
        descriptor,
        thumbnail,
        location,
        challengeId: capture.challengeId,
        liveness: true,
        livenessTurn,
      });
      setMessage({
        tone: "ok",
        text: res.alreadyCheckedIn
          ? `You were already checked in to ${cls.chapterTitle}.`
          : `Attendance marked: present for ${cls.chapterTitle}.`,
      });
      setReloadKey((k) => k + 1);
    },
    [capture, user, crtId]
  );

  if (!user?.uid || !crtId) return null;
  if (status && !status.enrolled) return null;

  const profile = status?.profile;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00448a]/10 text-[#00448a]">
            <ScanFace className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Face attendance</h3>
            <p className="text-xs text-slate-500">
              {status ? `Today · ${status.today}` : "Check in to your class with your face, at the class location"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile?.registered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <Lock className="h-3.5 w-3.5" />
              Face registered
            </span>
          )}
          <button
            type="button"
            onClick={reload}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {browserOk && !browserOk.ok && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{browserOk.reason}</p>
        )}
        {browserOk?.warn && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{browserOk.warn}</p>
        )}
        {loadError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{loadError}</p>
        ) : !status ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : !profile.registered ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Register your face to start checking in.</p>
              <p className="mt-1">
                You will look at the camera, blink and turn your head once. After registration your face profile is
                locked — only an admin can reset it.
              </p>
            </div>
            <button
              type="button"
              disabled={busyKey === "register" || (browserOk && !browserOk.ok)}
              onClick={startRegister}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#00448a] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#003a76] disabled:opacity-50"
            >
              {busyKey === "register" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
              {busyKey === "register" ? "Preparing…" : "Register my face"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {profile.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.thumbnail} alt="Registered face" className="h-12 w-12 rounded-xl object-cover ring-2 ring-emerald-200" />
            )}
            <p className="text-sm text-slate-600">
              Registered{profile.registeredAt ? ` on ${formatDate(profile.registeredAt)}` : ""}. Your face profile is locked.
            </p>
          </div>
        )}

        {message && (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              message.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </p>
        )}

        {status?.batches?.map((batch) => {
          const g = batch.geofence;
          return (
            <div key={batch.batchId} className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">{batch.batchName}</p>
                {g.enabled ? (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {g.label || "Class location"} · within {g.radiusM} m
                    </span>
                    {(g.checkInStart || g.checkInEnd) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {g.checkInStart || "—"} – {g.checkInEnd || "—"}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs font-medium text-amber-700">Class location not set by admin yet</p>
                )}
              </div>
              {batch.classes.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">
                  No class is open for check-in right now. Your trainer opens face check-in when the class starts — this
                  list refreshes automatically.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {batch.classes.map((cls) => {
                    const key = `${batch.batchId}::${cls.courseId}::${cls.chapterId}`;
                    const done = cls.present || cls.notHeld;
                    return (
                      <li key={key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{cls.chapterTitle}</p>
                          <p className="truncate text-xs text-slate-500">{cls.courseTitle}</p>
                        </div>
                        {done ? (
                          <ClassStatus cls={cls} />
                        ) : (
                          <button
                            type="button"
                            disabled={!profile?.registered || !g.enabled || !!busyKey}
                            onClick={() => startCheckIn(batch, cls)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                            {busyKey === key
                              ? locationProgress != null
                                ? `Locating… ±${locationProgress} m`
                                : "Getting location…"
                              : "Check in"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {capture && (
        <FaceCaptureModal
          title={capture.kind === "register" ? "Register your face" : `Check in · ${capture.cls.chapterTitle}`}
          samples={capture.kind === "register" ? 3 : 2}
          challengeTurn={capture.challengeTurn}
          onCaptured={capture.kind === "register" ? handleRegistered : handleCheckInCaptured}
          onClose={() => setCapture(null)}
        />
      )}
    </section>
  );
}
