"use client";

const MODEL_URL = "/models/face";

let faceApiPromise = null;

/**
 * Browser capability check for FRS (secure context, camera, WebGL/WASM for tfjs).
 * Returns { ok: true } or { ok: false, reason }.
 */
export function checkFrsBrowserSupport() {
  if (typeof window === "undefined") return { ok: false, reason: "Face attendance runs in the browser." };
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    return { ok: false, reason: "Face attendance needs HTTPS (or localhost)." };
  }
  if (!navigator?.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "This browser cannot access the camera." };
  }
  if (!navigator?.geolocation) {
    return { ok: false, reason: "This browser cannot share your location." };
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      return {
        ok: true,
        reason: null,
        warn: "WebGL is unavailable — face detection will be slower (CPU).",
      };
    }
  } catch (_) {
    /* CPU fallback still works */
  }
  return { ok: true };
}

/** Loads face-api and its three models once per page. */
export function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
      try {
        await faceapi.tf.setBackend("webgl");
      } catch (_) {
        await faceapi.tf.setBackend("cpu");
      }
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })().catch((e) => {
      faceApiPromise = null;
      throw e;
    });
  }
  return faceApiPromise;
}

export function detectorOptions(faceapi) {
  return new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeRatio(p) {
  return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * dist(p[0], p[3]) || 1);
}

/** Eye aspect ratio averaged over both eyes (68-point landmarks); drops sharply on a blink. */
export function eyeAspectRatio(landmarks) {
  const pts = landmarks.positions;
  return (eyeRatio(pts.slice(36, 42)) + eyeRatio(pts.slice(42, 48))) / 2;
}

/**
 * Where the nose sits between the jaw edges in the raw (unmirrored) camera frame:
 * ~0.5 facing the camera, higher when the student turns to their left, lower to their right.
 */
export function yawRatio(landmarks) {
  const pts = landmarks.positions;
  const left = pts[0];
  const right = pts[16];
  const nose = pts[30];
  return (nose.x - left.x) / (right.x - left.x || 1);
}

/** Square JPEG crop around the face box for the profile / check-in audit photo. */
export function captureFaceThumbnail(video, box, size = 160) {
  const pad = Math.max(box.width, box.height) * 0.35;
  const side = Math.max(box.width, box.height) + pad * 2;
  const sx = Math.max(0, box.x + box.width / 2 - side / 2);
  const sy = Math.max(0, box.y + box.height / 2 - side / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function averageDescriptor(list) {
  const out = new Array(list[0].length).fill(0);
  list.forEach((d) => d.forEach((v, i) => (out[i] += v / list.length)));
  return out;
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? "Location permission denied. Allow location access for this site and try again."
              : "Could not get your location. Turn on GPS / location services and try again."
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export const LOCATION_HELP =
  "Laptop: open Windows Settings → Privacy & security → Location, turn on Location services and " +
  "\"Let desktop apps access your location\", connect to Wi-Fi, then allow location for this site in the browser. " +
  "Phone: turn on Location with Precise / High accuracy.";

/**
 * Watches the position for up to `timeoutMs`, keeping the most accurate reading, and resolves as soon as
 * one is within `maxAccuracyM`. Rejects when the best reading is still too imprecise.
 */
export function getPreciseLocation({ maxAccuracyM = 150, timeoutMs = 15000, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot share your location."));
      return;
    }
    let best = null;
    let done = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      fn();
    };
    const tooImprecise = () =>
      new Error(
        best
          ? `Your location is too imprecise (±${Math.round(best.accuracy)} m; needs ±${maxAccuracyM} m or better). ${LOCATION_HELP}`
          : `Could not get your location. ${LOCATION_HELP}`
      );
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || reading.accuracy < best.accuracy) best = reading;
        onProgress?.(best);
        if (best.accuracy <= maxAccuracyM) finish(() => resolve(best));
      },
      (err) => {
        if (err.code === 1) {
          finish(() =>
            reject(
              new Error(
                "Location permission denied. Click the lock icon in the address bar, allow Location for this site, and try again."
              )
            )
          );
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
    const timer = setTimeout(() => finish(() => reject(tooImprecise())), timeoutMs);
  });
}

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const rad = (x) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export async function frsRequest(user, action, payload = {}) {
  const token = await user?.getIdToken?.();
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch("/api/crt-frs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed.");
  return data;
}
