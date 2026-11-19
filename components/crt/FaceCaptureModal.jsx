"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, RotateCcw, X } from "lucide-react";
import {
  averageDescriptor,
  captureFaceThumbnail,
  detectorOptions,
  eyeAspectRatio,
  loadFaceApi,
  yawRatio,
} from "@/lib/crtFrsClient";

const LIVENESS_TIMEOUT_MS = 60000;
const FRAME_DELAY_MS = 70;
/** After this long without a detected blink, ask for a head turn the other way instead. */
const BLINK_FALLBACK_MS = 12000;
/** Eyes count as closed below this share of the recent open-eye level, and open again above the second. */
const BLINK_CLOSED_RATIO = 0.82;
const BLINK_OPEN_RATIO = 0.9;
/** Face briefly lost mid-blink (closed eyes often defeat the detector) also counts as closed. */
const BLINK_LOST_FRAMES = 8;
const FRONTAL_MIN = 0.4;
const FRONTAL_MAX = 0.6;
const TURN_LEFT_MIN = 0.63;
const TURN_RIGHT_MAX = 0.37;
const MIN_FACE_WIDTH = 0.2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const other = (dir) => (dir === "left" ? "right" : "left");

function stepsFor(turn, blinkFallback) {
  return [
    { id: "center", label: "Look straight at the camera" },
    {
      id: "blink",
      label: blinkFallback ? `Turn your head to your ${other(turn)}` : "Blink slowly (close and open your eyes)",
    },
    { id: "turn", label: `Turn your head slowly to your ${turn}` },
    { id: "front", label: "Look straight again" },
  ];
}

/**
 * Live camera with a blink + head-turn liveness check, then face descriptors.
 * Pass `challengeTurn` from the server challenge so the required head-turn is not client-chosen.
 * `onCaptured({ descriptors, thumbnail, livenessTurn })` may throw; message shown with retry.
 */
export default function FaceCaptureModal({ title, samples = 2, challengeTurn = null, onCaptured, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const runRef = useRef(0);
  const onCapturedRef = useRef(onCaptured);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [stepIdx, setStepIdx] = useState(0);
  const [turn, setTurn] = useState("left");
  const [blinkFallback, setBlinkFallback] = useState(false);
  const [eyeLevel, setEyeLevel] = useState(null);
  const [hint, setHint] = useState("Starting camera…");
  const [error, setError] = useState("");

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCapturedRef.current = onCaptured;
    onCloseRef.current = onClose;
  }, [onCaptured, onClose]);

  const stopCamera = useCallback(() => {
    runRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const runLiveness = useCallback(async () => {
    const run = ++runRef.current;
    const alive = () => runRef.current === run;
    const video = videoRef.current;
    const dir = challengeTurn === "left" || challengeTurn === "right" ? challengeTurn : Math.random() < 0.5 ? "left" : "right";
    setTurn(dir);
    setStepIdx(0);
    setBlinkFallback(false);
    setEyeLevel(null);
    setError("");
    setPhase("running");
    setHint("Position your face inside the oval");

    const faceapi = await loadFaceApi();
    const opts = detectorOptions(faceapi);
    const fastOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });
    const startedAt = Date.now();
    let step = 0;
    let stable = 0;
    let eyesClosed = false;
    let lostFrames = 0;
    let blinkStartedAt = 0;
    let fallback = false;
    let openHistory = [];

    const enterBlinkStep = () => {
      step = 1;
      eyesClosed = false;
      blinkStartedAt = Date.now();
      setStepIdx(1);
      setHint("Now blink slowly — close your eyes, then open them");
    };
    const enterTurnStep = () => {
      step = 2;
      setStepIdx(2);
      setEyeLevel(null);
      setHint(`Turn your head slowly to your ${dir}`);
    };

    const guide = (det) => {
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const { box } = det.detection;
      if (box.width / vw < MIN_FACE_WIDTH) return "Move closer to the camera";
      const cx = (box.x + box.width / 2) / vw;
      const cy = (box.y + box.height / 2) / vh;
      if (Math.abs(cx - 0.5) > 0.2 || Math.abs(cy - 0.5) > 0.25) return "Center your face inside the oval";
      return "";
    };

    while (alive() && step < 4) {
      if (Date.now() - startedAt > LIVENESS_TIMEOUT_MS) {
        setPhase("error");
        setError("Liveness check timed out. Make sure your face is well lit and try again.");
        return;
      }
      const dets = await faceapi.detectAllFaces(video, step === 1 ? fastOpts : opts).withFaceLandmarks();
      if (!alive()) return;
      if (dets.length !== 1) {
        lostFrames += 1;
        if (step === 1 && !fallback && dets.length === 0 && openHistory.length >= 3 && lostFrames <= BLINK_LOST_FRAMES) {
          eyesClosed = true;
          await sleep(10);
          continue;
        }
        setHint(dets.length > 1 ? "Only your face should be visible" : "No face detected — look at the camera");
        if (step > 0 && lostFrames > 25) {
          step = 0;
          stable = 0;
          openHistory = [];
          setStepIdx(0);
          setEyeLevel(null);
        }
        await sleep(FRAME_DELAY_MS);
        continue;
      }
      lostFrames = 0;
      const det = dets[0];
      const msg = guide(det);
      const ear = eyeAspectRatio(det.landmarks);
      const yaw = yawRatio(det.landmarks);
      const frontal = yaw > FRONTAL_MIN && yaw < FRONTAL_MAX;

      if (step === 0) {
        if (msg || !frontal) {
          setHint(msg || "Face the camera directly");
          stable = 0;
        } else {
          stable += 1;
          openHistory = [...openHistory, ear].slice(-15);
          setHint("Hold still…");
          if (stable >= 5) enterBlinkStep();
        }
      } else if (step === 1) {
        if (!fallback && Date.now() - blinkStartedAt > BLINK_FALLBACK_MS) {
          fallback = true;
          setBlinkFallback(true);
          setEyeLevel(null);
          setHint(`Blink not detected — turn your head slowly to your ${other(dir)} instead`);
        }
        if (fallback) {
          const turned = other(dir) === "left" ? yaw > TURN_LEFT_MIN : yaw < TURN_RIGHT_MAX;
          if (turned) {
            step = 1.5;
            setHint("Good — look straight at the camera");
          }
        } else {
          const openLevel = Math.max(...openHistory, ear);
          const ratio = ear / openLevel;
          setEyeLevel(Math.round(Math.min(1, ratio) * 100));
          if (!eyesClosed && ratio < BLINK_CLOSED_RATIO) {
            eyesClosed = true;
          } else if (eyesClosed && ratio > BLINK_OPEN_RATIO) {
            enterTurnStep();
          } else if (!eyesClosed && frontal) {
            openHistory = [...openHistory, ear].slice(-15);
          }
          if (step === 1) {
            await sleep(10);
            continue;
          }
        }
      } else if (step === 1.5) {
        if (frontal) enterTurnStep();
      } else if (step === 2) {
        if ((dir === "left" && yaw > TURN_LEFT_MIN) || (dir === "right" && yaw < TURN_RIGHT_MAX)) {
          step = 3;
          stable = 0;
          setStepIdx(3);
          setHint("Great — now look straight at the camera");
        }
      } else if (step === 3) {
        if (!msg && frontal) {
          stable += 1;
          if (stable >= 3) step = 4;
        } else {
          stable = 0;
          setHint(msg || "Look straight at the camera");
        }
      }
      await sleep(FRAME_DELAY_MS);
    }
    if (!alive()) return;

    setHint("Capturing…");
    const descriptors = [];
    let thumbnail = "";
    for (let tries = 0; descriptors.length < samples && tries < 40 && alive(); tries += 1) {
      const det = await faceapi.detectSingleFace(video, opts).withFaceLandmarks().withFaceDescriptor();
      if (det && !guide(det)) {
        const yaw = yawRatio(det.landmarks);
        if (yaw > FRONTAL_MIN && yaw < FRONTAL_MAX) {
          descriptors.push(Array.from(det.descriptor));
          if (!thumbnail) thumbnail = captureFaceThumbnail(video, det.detection.box);
          await sleep(250);
          continue;
        }
      }
      await sleep(FRAME_DELAY_MS);
    }
    if (!alive()) return;
    if (descriptors.length < samples) {
      setPhase("error");
      setError("Could not capture a clear photo of your face. Try again facing the camera.");
      return;
    }

    setPhase("submitting");
    setHint("Verifying…");
    try {
      await onCapturedRef.current({
        descriptors,
        descriptor: averageDescriptor(descriptors),
        thumbnail,
        livenessTurn: dir,
      });
      if (!alive()) return;
      setPhase("done");
      setHint("Done");
      stopCamera();
      setCameraReady(false);
      setTimeout(() => onCloseRef.current?.(), 1500);
    } catch (e) {
      if (!alive()) return;
      setPhase("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [samples, challengeTurn, stopCamera]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          }),
          loadFaceApi(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
        runLiveness();
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access for this site and try again."
            : e?.name === "NotFoundError"
              ? "No camera found on this device."
              : e?.message || "Could not start the camera."
        );
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [runLiveness, stopCamera]);

  const steps = stepsFor(turn, blinkFallback);
  const canRetry = phase === "error" && cameraReady;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-slate-950">
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`h-[72%] w-[48%] rounded-[50%] border-4 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] transition-colors ${
                phase === "done" ? "border-emerald-400" : phase === "error" ? "border-rose-400" : "border-white/80"
              }`}
            />
          </div>
          {(phase === "loading" || phase === "submitting") && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}
          {phase === "running" && eyeLevel != null && (
            <div className="absolute right-3 top-3 w-28 rounded-lg bg-slate-950/60 px-2.5 py-2 text-[11px] font-semibold text-white">
              Eyes {eyeLevel < BLINK_CLOSED_RATIO * 100 ? "closed" : "open"}
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25">
                <div
                  className={`h-full rounded-full transition-[width] duration-75 ${
                    eyeLevel < BLINK_CLOSED_RATIO * 100 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.max(8, eyeLevel)}%` }}
                />
              </div>
            </div>
          )}
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-3 pt-8 text-center text-sm font-semibold text-white">
            {phase === "loading" ? "Loading face models…" : hint}
          </p>
        </div>

        <div className="space-y-3 p-4">
          <ol className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            {steps.map((s, i) => {
              const done = phase === "done" || phase === "submitting" || i < stepIdx;
              const active = phase === "running" && i === stepIdx;
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                    done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : active
                        ? "border-[#00448a]/30 bg-blue-50 font-semibold text-[#00448a]"
                        : "border-slate-200 text-slate-500"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                  {s.label}
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            {canRetry && (
              <button
                type="button"
                onClick={() => runLiveness()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00448a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003a76]"
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {phase === "done" ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
