import admin from "@/lib/firebaseAdmin";
import { decryptSample, descriptorFingerprint, randomToken } from "@/lib/crtFrsCrypto";

/**
 * Own Firestore client with TLS on: the shared `adminDb` runs with ssl:false in local dev, which
 * cannot reach Firestore for queries and transactions.
 */
function createFrsDb() {
  const name = "crt-frs";
  let app = admin.apps.find((a) => a?.name === name);
  if (!app) {
    const base = admin.app();
    app = admin.initializeApp({ credential: base.options.credential, projectId: base.options.projectId }, name);
    app.firestore().settings({ ignoreUndefinedProperties: true, preferRest: true });
  }
  return app.firestore();
}

export const adminDb = createFrsDb();

/**
 * SkillWins CRT Face Attendance (FRS) — server helpers.
 *
 * Architecture (approved — do not replace):
 *   @vladmandic/face-api · TinyFaceDetector · FaceLandmark68 · FaceRecognitionNet (128-D)
 *   Blink + head-turn liveness · Euclidean match · GPS geofence · same attendance/TR_* docs
 *
 * Upgrade trigger (only if fraud / false-match volume justifies vendor cost):
 *   Move to cloud face compare + dedicated liveness while keeping this UX and attendance model.
 *   Until then: harden validation, challenges, encryption, and Firestore client denies.
 *
 * Collections (Admin SDK only — clients must be denied in Firestore rules):
 *   crtFaceProfiles/{uid}     encrypted samples + locked profile
 *   crtFrsChallenges/{id}     one-time liveness challenges
 *   crtFrsRateLimits/{uid}    failed attempt windows
 *   crtFaceCheckins/{id}      audit log (thumbnail, match, distance)
 *   crtFaceProfileResets/{id} admin reset audit
 *   attendance/TR_…           present + faceCheckins (trainer-aligned)
 */

export const FRS_TIMEZONE = process.env.FRS_TIMEZONE || "Asia/Kolkata";
export const DESCRIPTOR_LENGTH = 128;

function numEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Max euclidean distance to accept a match.
 * Default 0.48 (slightly tighter than classic face-api 0.5). Override with FRS_MATCH_THRESHOLD.
 */
export const MATCH_THRESHOLD = numEnv("FRS_MATCH_THRESHOLD", 0.48);
/** Registration rejects a face this close to another student's registered face. */
export const DUPLICATE_THRESHOLD = numEnv("FRS_DUPLICATE_THRESHOLD", 0.42);
const SAMPLE_CONSISTENCY = numEnv("FRS_SAMPLE_CONSISTENCY", 0.55);
const MAX_THUMBNAIL_CHARS = 60000;
export const DEFAULT_MAX_GPS_ACCURACY_M = 150;
const GPS_TOLERANCE_M = 25;
export const CHALLENGE_TTL_MS = numEnv("FRS_CHALLENGE_TTL_MS", 120000);
export const RATE_LIMIT_WINDOW_MS = numEnv("FRS_RATE_LIMIT_WINDOW_MS", 3600000);
export const RATE_LIMIT_MAX_FAILS = numEnv("FRS_RATE_LIMIT_MAX_FAILS", 12);
export const REPLAY_WINDOW_MS = numEnv("FRS_REPLAY_WINDOW_MS", 120000);

export const FieldValue = admin.firestore.FieldValue;
export const FieldPath = admin.firestore.FieldPath;

export class FrsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const ADMIN_ROLES = new Set(["admin", "superadmin", "collegeadmin", "dataentry"]);

export async function authenticate(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new FrsError("Please sign in again.", 401);
  const decoded = await admin.auth().verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const role = String(userData.role || "").trim().toLowerCase();
  return {
    uid: decoded.uid,
    email: String(decoded.email || userData.email || "").trim().toLowerCase(),
    name: userData.name || userData.displayName || decoded.name || "",
    isAdmin: ADMIN_ROLES.has(role),
  };
}

function datePartsInZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FRS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Same rule as `isCourseVisibleToBatch` in lib/crtCourseFork.js (a client module). */
function isCourseVisibleToBatch(course, batchId) {
  const ids = (v) => (Array.isArray(v) ? v.map(String) : []);
  const only = ids(course?.batchIds);
  if (only.length > 0) return only.includes(String(batchId));
  return !ids(course?.hiddenForBatchIds).includes(String(batchId));
}

export function todayInZone() {
  return datePartsInZone().date;
}

export function nowTimeInZone() {
  return datePartsInZone().time;
}

function timestampDate(value) {
  if (!value) return "";
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isFinite(d.getTime()) ? datePartsInZone(d).date : "";
}

export function trainerAttendanceDocId(programId, batchId, courseId, chapterId, dateStr) {
  const s = (x) => String(x ?? "").replace(/\//g, "-");
  return `TR_${s(programId)}_${s(batchId)}_${s(courseId)}_${s(chapterId)}_${dateStr}`;
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function parseDescriptor(raw) {
  if (!Array.isArray(raw) || raw.length !== DESCRIPTOR_LENGTH) return null;
  const out = raw.map(Number);
  return out.every((n) => Number.isFinite(n) && Math.abs(n) < 2) ? out : null;
}

export function parseThumbnail(raw) {
  const s = String(raw || "");
  if (!s.startsWith("data:image/jpeg;base64,") || s.length > MAX_THUMBNAIL_CHARS) return null;
  return s;
}

export function profileSamples(profile) {
  return (Array.isArray(profile?.samples) ? profile.samples : []).map(decryptSample).filter(Boolean);
}

export function bestMatchDistance(samples, descriptor) {
  let best = Infinity;
  for (const s of samples) best = Math.min(best, euclidean(s, descriptor));
  return best;
}

export function samplesAreConsistent(samples) {
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      if (euclidean(samples[i], samples[j]) > SAMPLE_CONSISTENCY) return false;
    }
  }
  return true;
}

export function normalizeGeofence(raw) {
  const g = raw && typeof raw === "object" ? raw : {};
  const lat = Number(g.lat);
  const lng = Number(g.lng);
  const radiusM = Number(g.radiusM);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const timeOk = (t) => (/^\d{2}:\d{2}$/.test(String(t || "")) ? String(t) : "");
  return {
    enabled: g.enabled === true && hasPoint && radiusM > 0,
    lat: hasPoint ? lat : null,
    lng: hasPoint ? lng : null,
    radiusM: radiusM > 0 ? radiusM : null,
    label: String(g.label || ""),
    checkInStart: timeOk(g.checkInStart),
    checkInEnd: timeOk(g.checkInEnd),
    maxAccuracyM: Number(g.maxAccuracyM) > 0 ? Number(g.maxAccuracyM) : DEFAULT_MAX_GPS_ACCURACY_M,
  };
}

/** Distance check against the batch geofence; returns { distanceM } or throws with a student-facing message. */
export function checkLocation(geofence, location) {
  if (!geofence.enabled) {
    throw new FrsError("Your admin has not set the class location for this batch yet.", 409);
  }
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const accuracy = Number(location?.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new FrsError("Your location is required to check in. Allow location access and try again.");
  }
  if (Number.isFinite(accuracy) && accuracy > geofence.maxAccuracyM) {
    throw new FrsError(
      `Your location is too imprecise (±${Math.round(accuracy)} m; needs ±${geofence.maxAccuracyM} m or better). ` +
        "On a laptop turn on Windows Location services and connect to Wi-Fi; on a phone turn on precise location."
    );
  }
  const distanceM = Math.round(haversineMeters(lat, lng, geofence.lat, geofence.lng));
  const tolerance = Number.isFinite(accuracy) ? Math.min(accuracy, GPS_TOLERANCE_M) : 0;
  if (distanceM > geofence.radiusM + tolerance) {
    throw new FrsError(
      `You are ${distanceM} m from ${geofence.label || "the class location"}. Check-in is allowed only within ${geofence.radiusM} m.`,
      403
    );
  }
  return { distanceM, accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null };
}

export function checkTimeWindow(geofence) {
  const now = nowTimeInZone();
  if (geofence.checkInStart && now < geofence.checkInStart) {
    throw new FrsError(`Check-in opens at ${geofence.checkInStart}.`, 403);
  }
  if (geofence.checkInEnd && now > geofence.checkInEnd) {
    throw new FrsError(`Check-in closed at ${geofence.checkInEnd}.`, 403);
  }
}

/** Every id/email/regd no. tied to this login (same rules as `resolveCrtStudentBatchMatchKeys`). */
async function resolveIdentity(me) {
  const keys = new Set([me.uid]);
  const emails = new Set(me.email ? [me.email] : []);
  const regdNos = new Set();
  const absorb = (d) => {
    if (!d?.exists) return;
    const x = d.data() || {};
    keys.add(d.id);
    if (x.email) emails.add(String(x.email).trim().toLowerCase());
    if (x.regdNo) regdNos.add(String(x.regdNo).trim());
  };
  const [own, byUid, crtByUid, crtOwn] = await Promise.all([
    adminDb.collection("students").doc(me.uid).get().catch(() => null),
    adminDb.collection("students").where("uid", "==", me.uid).get().catch(() => null),
    adminDb.collection("users").doc("crtStudent").collection("students").where("uid", "==", me.uid).get().catch(() => null),
    adminDb.collection("users").doc("crtStudent").collection("students").doc(me.uid).get().catch(() => null),
  ]);
  absorb(own);
  byUid?.docs.forEach(absorb);
  crtByUid?.docs.forEach(absorb);
  absorb(crtOwn);
  return { keys, emails, regdNos };
}

function studentMatches(d, identity) {
  const x = d.data() || {};
  const sid = String(x.studentId ?? x.uid ?? d.id ?? "").trim();
  if (sid && identity.keys.has(sid)) return true;
  const uidField = String(x.uid ?? "").trim();
  if (uidField && identity.keys.has(uidField)) return true;
  const em = String(x.email ?? "").trim().toLowerCase();
  if (em && identity.emails.has(em)) return true;
  const regd = String(x.regdNo ?? "").trim();
  return !!regd && identity.regdNos.has(regd);
}

function rosterEntry(d) {
  const x = d.data() || {};
  const presentId = String(x.studentId || x.uid || d.id);
  const name = x.name || x.studentName || x.displayName || "—";
  const rollNo = x.rollNo || x.regNo || x.regdNo || x.registrationNo || "";
  return { presentId, name, rollNo, email: String(x.email || "").trim().toLowerCase(), label: rollNo ? `${name} (${rollNo})` : name };
}

/** Batches of `crtId` this student belongs to, with batch data and the full roster. */
export async function findMemberships(me, crtId) {
  const identity = await resolveIdentity(me);
  const batchesSnap = await adminDb.collection("crt").doc(String(crtId)).collection("batches").get();
  const list = await Promise.all(
    batchesSnap.docs.map(async (b) => {
      const stSnap = await b.ref.collection("students").get();
      const match = stSnap.docs.find((d) => studentMatches(d, identity));
      if (!match) return null;
      const data = b.data() || {};
      return {
        batchId: b.id,
        batchName: data.name || b.id,
        presentId: rosterEntry(match).presentId,
        geofence: normalizeGeofence(data.geofence),
        roster: stSnap.docs.map(rosterEntry),
      };
    })
  );
  return list.filter(Boolean);
}

/**
 * Classes a batch can check in to today: chapters unlocked today, plus any chapter a trainer
 * opened face check-in or an attendance sheet for today — minus any the trainer closed.
 */
export async function todaysClasses(crtId, batchId, today = todayInZone()) {
  const programRef = adminDb.collection("crt").doc(String(crtId));
  const [coursesSnap, sessionsSnap] = await Promise.all([
    programRef.collection("courses").get(),
    adminDb.collection("attendance").where("type", "==", "trainer").where("date", "==", today).get(),
  ]);
  const courses = new Map();
  coursesSnap.docs.forEach((c) => {
    const data = c.data() || {};
    if (isCourseVisibleToBatch(data, batchId)) courses.set(c.id, data.title || data.name || "Course");
  });

  const found = new Map();
  await Promise.all(
    [...courses.keys()].map(async (courseId) => {
      const unlockSnap = await programRef
        .collection("batches")
        .doc(String(batchId))
        .collection("courses")
        .doc(courseId)
        .collection("chapterUnlocks")
        .where("unlocked", "==", true)
        .get()
        .catch(() => null);
      unlockSnap?.docs.forEach((u) => {
        if (timestampDate(u.data()?.updatedAt) === today) found.set(`${courseId}::${u.id}`, { courseId, chapterId: u.id });
      });
    })
  );
  const sessions = new Map();
  sessionsSnap.docs.forEach((s) => {
    const x = s.data() || {};
    if (x.crtProgramId !== crtId || x.batchId !== batchId || !courses.has(x.courseId) || !x.chapterId) return;
    const key = `${x.courseId}::${x.chapterId}`;
    sessions.set(key, x);
    if (x.faceCheckInOpen === false) found.delete(key);
    else if (!found.has(key)) found.set(key, { courseId: x.courseId, chapterId: x.chapterId });
  });

  const classes = await Promise.all(
    [...found.entries()].map(async ([key, c]) => {
      const chSnap = await programRef
        .collection("courses")
        .doc(c.courseId)
        .collection("chapters")
        .doc(c.chapterId)
        .get()
        .catch(() => null);
      const ch = chSnap?.exists ? chSnap.data() || {} : {};
      return {
        ...c,
        courseTitle: courses.get(c.courseId),
        chapterTitle: ch.title || ch.name || "Class",
        order: Number(ch.order) || 0,
        session: sessions.get(key) || null,
      };
    })
  );
  return classes.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.order - b.order);
}

export function publicProfile(profile) {
  if (!profile) return { registered: false };
  const at = profile.registeredAt?.toDate?.();
  return {
    registered: true,
    locked: profile.locked !== false,
    registeredAt: at ? at.toISOString() : null,
    thumbnail: profile.thumbnail || null,
  };
}

const challenges = () => adminDb.collection("crtFrsChallenges");
const rateLimits = () => adminDb.collection("crtFrsRateLimits");

/** Server-issued one-time liveness challenge (random head-turn direction). */
export async function issueChallenge(me, { purpose, crtId }) {
  if (!["register", "checkIn"].includes(purpose)) throw new FrsError("Invalid challenge purpose.");
  const turn = Math.random() < 0.5 ? "left" : "right";
  const id = randomToken(18);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  await challenges().doc(id).set({
    uid: me.uid,
    purpose,
    crtId: String(crtId || ""),
    turn,
    nonce: randomToken(12),
    consumed: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });
  return { challengeId: id, turn, expiresInSec: Math.round(CHALLENGE_TTL_MS / 1000) };
}

function readChallengeOrThrow(snap, me, claimedTurn, purpose) {
  if (!snap.exists) throw new FrsError("Liveness challenge expired. Try again.", 409);
  const c = snap.data() || {};
  if (c.uid !== me.uid) throw new FrsError("Liveness challenge mismatch.", 403);
  if (c.purpose && purpose && c.purpose !== purpose) throw new FrsError("Liveness challenge mismatch.", 403);
  if (c.consumed) throw new FrsError("Liveness challenge already used. Try again.", 409);
  if (Number(c.expiresAt) < Date.now()) throw new FrsError("Liveness challenge expired. Try again.", 409);
  if (c.turn !== claimedTurn) {
    throw new FrsError("Liveness challenge failed. Follow the on-screen head-turn direction.", 403);
  }
  return c;
}

/** Validate challenge without consuming (allows retry after a failed face match). */
export async function assertChallenge(me, challengeId, claimedTurn, purpose) {
  const id = String(challengeId || "").trim();
  if (!id) throw new FrsError("Liveness challenge missing. Restart face capture.");
  const turn = claimedTurn === "left" || claimedTurn === "right" ? claimedTurn : "";
  if (!turn) throw new FrsError("Liveness proof incomplete.");
  const snap = await challenges().doc(id).get();
  readChallengeOrThrow(snap, me, turn, purpose);
  return { id, turn };
}

/** Mark a previously validated challenge as used (call after successful register / check-in). */
export async function consumeChallenge(me, challengeId, claimedTurn, purpose) {
  const id = String(challengeId || "").trim();
  const turn = claimedTurn === "left" || claimedTurn === "right" ? claimedTurn : "";
  if (!id || !turn) throw new FrsError("Liveness challenge missing. Restart face capture.");
  await adminDb.runTransaction(async (tx) => {
    const ref = challenges().doc(id);
    const snap = await tx.get(ref);
    readChallengeOrThrow(snap, me, turn, purpose);
    tx.update(ref, { consumed: true, consumedAt: FieldValue.serverTimestamp() });
  });
  return { turn };
}

export async function assertUnderRateLimit(uid) {
  const ref = rateLimits().doc(String(uid));
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const windowStart = Number(data.windowStart) || 0;
  const fails = Number(data.fails) || 0;
  if (windowStart && Date.now() - windowStart < RATE_LIMIT_WINDOW_MS && fails >= RATE_LIMIT_MAX_FAILS) {
    throw new FrsError("Too many failed face attempts. Wait a while and try again.", 429);
  }
}

export async function recordFailedAttempt(uid) {
  const ref = rateLimits().doc(String(uid));
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() || {} : {};
      const windowStart = Number(data.windowStart) || 0;
      const fresh = !windowStart || Date.now() - windowStart >= RATE_LIMIT_WINDOW_MS;
      tx.set(
        ref,
        {
          windowStart: fresh ? Date.now() : windowStart,
          fails: fresh ? 1 : (Number(data.fails) || 0) + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (e) {
    console.warn("crt-frs: rate limit write failed", e?.message || e);
  }
}

/** Reject replaying the exact same descriptor within a short window (stolen payload). */
export function assertNotReplay(profile, fingerprint) {
  const prev = String(profile?.lastFingerprint || "");
  const at = Number(profile?.lastFingerprintAt) || 0;
  if (prev && prev === fingerprint && at && Date.now() - at < REPLAY_WINDOW_MS) {
    throw new FrsError("This face capture was already used. Capture again.", 409);
  }
}

export function fingerprintOf(descriptor) {
  return descriptorFingerprint(descriptor);
}
