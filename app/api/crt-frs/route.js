import { NextResponse } from "next/server";
import { encryptDescriptor } from "@/lib/crtFrsCrypto";
import {
  adminDb,
  DUPLICATE_THRESHOLD,
  FieldPath,
  FieldValue,
  FrsError,
  MATCH_THRESHOLD,
  assertNotReplay,
  assertUnderRateLimit,
  authenticate,
  bestMatchDistance,
  checkLocation,
  checkTimeWindow,
  assertChallenge,
  consumeChallenge,
  findMemberships,
  fingerprintOf,
  issueChallenge,
  normalizeGeofence,
  parseDescriptor,
  parseThumbnail,
  profileSamples,
  publicProfile,
  recordFailedAttempt,
  samplesAreConsistent,
  todayInZone,
  todaysClasses,
  trainerAttendanceDocId,
} from "@/lib/crtFrsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const profiles = () => adminDb.collection("crtFaceProfiles");
const checkinLog = () => adminDb.collection("crtFaceCheckins");

function publicGeofence(g) {
  return {
    enabled: g.enabled,
    lat: g.lat,
    lng: g.lng,
    radiusM: g.radiusM,
    label: g.label,
    checkInStart: g.checkInStart,
    checkInEnd: g.checkInEnd,
    maxAccuracyM: g.maxAccuracyM,
  };
}

function requireCrtId(body) {
  const crtId = String(body?.crtId || "").trim();
  if (!crtId) throw new FrsError("crtId is required.");
  return crtId;
}

function requireLivenessProof(body) {
  if (body?.liveness !== true) throw new FrsError("Liveness check not completed.");
  const turn = body?.livenessTurn === "left" || body?.livenessTurn === "right" ? body.livenessTurn : "";
  if (!turn) throw new FrsError("Liveness proof incomplete.");
  return turn;
}

async function handleStatus(me, body) {
  const crtId = requireCrtId(body);
  const today = todayInZone();
  const [profileSnap, memberships] = await Promise.all([profiles().doc(me.uid).get(), findMemberships(me, crtId)]);
  const batches = await Promise.all(
    memberships.map(async (m) => {
      const classes = await todaysClasses(crtId, m.batchId, today);
      return {
        batchId: m.batchId,
        batchName: m.batchName,
        geofence: publicGeofence(m.geofence),
        classes: classes.map((c) => {
          const s = c.session || {};
          const face = s.faceCheckins?.[m.presentId];
          return {
            courseId: c.courseId,
            chapterId: c.chapterId,
            courseTitle: c.courseTitle,
            chapterTitle: c.chapterTitle,
            notHeld: s.status === "not_held",
            present: Array.isArray(s.present) && s.present.includes(m.presentId),
            viaFace: !!face,
            checkedInAt: face?.at?.toDate?.()?.toISOString?.() || null,
          };
        }),
      };
    })
  );
  return {
    today,
    enrolled: memberships.length > 0,
    profile: publicProfile(profileSnap.exists ? profileSnap.data() : null),
    batches,
    matchThreshold: MATCH_THRESHOLD,
  };
}

async function handleChallenge(me, body) {
  const crtId = requireCrtId(body);
  const purpose = body?.purpose === "register" ? "register" : body?.purpose === "checkIn" ? "checkIn" : "";
  if (!purpose) throw new FrsError("purpose must be register or checkIn.");
  await assertUnderRateLimit(me.uid);
  if (purpose === "register") {
    const existing = await profiles().doc(me.uid).get();
    if (existing.exists) throw new FrsError("Your face is already registered and locked.", 409);
  }
  return issueChallenge(me, { purpose, crtId });
}

async function handleRegister(me, body) {
  const crtId = requireCrtId(body);
  await assertUnderRateLimit(me.uid);
  const turn = requireLivenessProof(body);
  await assertChallenge(me, body?.challengeId, turn, "register");

  const samples = (Array.isArray(body?.descriptors) ? body.descriptors : []).map(parseDescriptor).filter(Boolean);
  if (samples.length < 3) throw new FrsError("Face capture incomplete. Please try again.");
  if (!samplesAreConsistent(samples)) {
    await recordFailedAttempt(me.uid);
    throw new FrsError("The captures did not look like the same face. Keep only your face in view and try again.");
  }
  const thumbnail = parseThumbnail(body?.thumbnail);
  if (!thumbnail) throw new FrsError("Face photo missing. Please try again.");

  const memberships = await findMemberships(me, crtId);
  if (!memberships.length) throw new FrsError("You are not assigned to a batch in this programme yet.", 403);

  const others = await profiles().where("crtIds", "array-contains", crtId).get();
  for (const d of others.docs) {
    if (d.id === me.uid) continue;
    const theirs = profileSamples(d.data());
    if (theirs.length && samples.some((s) => bestMatchDistance(theirs, s) < DUPLICATE_THRESHOLD)) {
      await recordFailedAttempt(me.uid);
      throw new FrsError("This face is already registered to another student. Contact your admin.", 409);
    }
  }

  const ref = profiles().doc(me.uid);
  const name = me.name || memberships[0].roster.find((r) => r.presentId === memberships[0].presentId)?.name || "";
  const encrypted = samples.map((v) => encryptDescriptor(v));
  await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      throw new FrsError("Your face is already registered and locked. Ask your admin to reset it if needed.", 409);
    }
    tx.set(ref, {
      uid: me.uid,
      email: me.email,
      name,
      samples: encrypted,
      samplesEncrypted: true,
      thumbnail,
      locked: true,
      crtIds: [crtId],
      presentIds: [...new Set(memberships.map((m) => m.presentId))],
      batchIds: memberships.map((m) => m.batchId),
      registeredAt: FieldValue.serverTimestamp(),
    });
  });
  await consumeChallenge(me, body?.challengeId, turn, "register");
  const saved = await ref.get();
  return { profile: publicProfile(saved.data()) };
}

async function logAttempt(entry) {
  try {
    await checkinLog().add({ ...entry, at: FieldValue.serverTimestamp() });
  } catch (e) {
    console.warn("crt-frs: could not write check-in log", e?.message || e);
  }
}

async function handleCheckIn(me, body) {
  const crtId = requireCrtId(body);
  const batchId = String(body?.batchId || "");
  const courseId = String(body?.courseId || "");
  const chapterId = String(body?.chapterId || "");
  if (!batchId || !courseId || !chapterId) throw new FrsError("Choose the class to check in to.");

  await assertUnderRateLimit(me.uid);
  const turn = requireLivenessProof(body);
  await assertChallenge(me, body?.challengeId, turn, "checkIn");

  const descriptor = parseDescriptor(body?.descriptor);
  if (!descriptor) throw new FrsError("Face capture incomplete. Please try again.");
  const thumbnail = parseThumbnail(body?.thumbnail);
  if (!thumbnail) throw new FrsError("Face photo missing. Please try again.");
  const today = todayInZone();

  const profileRef = profiles().doc(me.uid);
  const profileSnap = await profileRef.get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const samples = profile ? profileSamples(profile) : [];
  if (!samples.length) throw new FrsError("Register your face first.", 409);

  const fp = fingerprintOf(descriptor);
  try {
    assertNotReplay(profile, fp);
  } catch (e) {
    await recordFailedAttempt(me.uid);
    throw e;
  }

  const memberships = await findMemberships(me, crtId);
  const m = memberships.find((x) => x.batchId === batchId);
  if (!m) throw new FrsError("You are not in this batch.", 403);

  const base = {
    uid: me.uid,
    presentId: m.presentId,
    name: m.roster.find((r) => r.presentId === m.presentId)?.name || me.name || "",
    crtProgramId: crtId,
    batchId,
    courseId,
    chapterId,
    date: today,
    thumbnail,
    challengeId: String(body?.challengeId || ""),
    fingerprint: fp,
  };

  const match = Math.round(bestMatchDistance(samples, descriptor) * 1000) / 1000;
  if (match > MATCH_THRESHOLD) {
    await recordFailedAttempt(me.uid);
    await logAttempt({ ...base, result: "rejected", reason: "face_mismatch", match });
    throw new FrsError("Your face did not match your registered face. Try again in good light, facing the camera.", 403);
  }

  checkTimeWindow(m.geofence);
  let loc;
  try {
    loc = checkLocation(m.geofence, body?.location);
  } catch (e) {
    if (e.status === 403) {
      await recordFailedAttempt(me.uid);
      await logAttempt({ ...base, result: "rejected", reason: "out_of_range", match });
    }
    throw e;
  }

  const classes = await todaysClasses(crtId, batchId, today);
  const cls = classes.find((c) => c.courseId === courseId && c.chapterId === chapterId);
  if (!cls) throw new FrsError("This class is not open for check-in today.", 409);

  const ref = adminDb.collection("attendance").doc(trainerAttendanceDocId(crtId, batchId, courseId, chapterId, today));
  const checkin = {
    at: FieldValue.serverTimestamp(),
    uid: me.uid,
    distanceM: loc.distanceM,
    match,
    fingerprint: fp,
    challengeId: base.challengeId || null,
  };

  const already = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : null;
    if (data?.status === "not_held") throw new FrsError("Your trainer marked this class as not held.", 409);
    if (data?.faceCheckInOpen === false) throw new FrsError("Your trainer has closed face check-in for this class.", 409);
    if (data?.faceCheckins?.[m.presentId]) return true;

    if (!data) {
      tx.set(ref, {
        type: "trainer",
        courseId,
        chapterId,
        crtProgramId: crtId,
        batchId,
        date: today,
        status: "held",
        present: [m.presentId],
        roster: m.roster.map((r) => r.presentId),
        rosterNames: Object.fromEntries(m.roster.map((r) => [r.presentId, r.label])),
        rosterSize: m.roster.length,
        markedBy: null,
        markedByName: "Face check-in",
        faceCheckInOpen: true,
        faceCheckins: { [m.presentId]: checkin },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(
        ref,
        "present",
        FieldValue.arrayUnion(m.presentId),
        new FieldPath("faceCheckins", m.presentId),
        checkin,
        "updatedAt",
        FieldValue.serverTimestamp()
      );
    }
    tx.set(ref.collection("history").doc(), {
      status: "held",
      faceCheckIn: m.presentId,
      markedBy: me.uid,
      markedByName: `Face check-in: ${base.name || m.presentId}`,
      fingerprint: fp,
      at: FieldValue.serverTimestamp(),
    });
    return false;
  });

  if (already) {
    await consumeChallenge(me, body?.challengeId, turn, "checkIn").catch(() => {});
    return { ok: true, alreadyCheckedIn: true };
  }

  await consumeChallenge(me, body?.challengeId, turn, "checkIn");

  try {
    await profileRef.set(
      { lastFingerprint: fp, lastFingerprintAt: Date.now(), lastCheckInAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.warn("crt-frs: fingerprint stamp failed", e?.message || e);
  }

  try {
    await adminDb
      .collection("users")
      .doc("crtStudent")
      .collection("students")
      .doc(m.presentId)
      .collection("attendance")
      .doc("courseWise")
      .set(
        {
          courses: {
            [courseId]: {
              courseId,
              courseName: cls.courseTitle || "",
              programId: crtId,
              batchId,
              days: { [chapterId]: { [today]: true } },
            },
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (e) {
    console.warn("crt-frs: profile attendance mirror failed", e?.message || e);
  }

  await logAttempt({
    ...base,
    result: "present",
    match,
    distanceM: loc.distanceM,
    accuracyM: loc.accuracyM,
    courseTitle: cls.courseTitle,
    chapterTitle: cls.chapterTitle,
  });
  return { ok: true, distanceM: loc.distanceM, match };
}

async function handleAdminList(me, body) {
  if (!me.isAdmin) throw new FrsError("Admins only.", 403);
  const crtId = requireCrtId(body);
  const batchId = String(body?.batchId || "");
  if (!batchId) throw new FrsError("batchId is required.");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date || "")) ? body.date : todayInZone();

  const batchRef = adminDb.collection("crt").doc(crtId).collection("batches").doc(batchId);
  const [batchSnap, rosterSnap, profileSnap, logSnap] = await Promise.all([
    batchRef.get(),
    batchRef.collection("students").get(),
    profiles().where("crtIds", "array-contains", crtId).get(),
    checkinLog().where("crtProgramId", "==", crtId).where("batchId", "==", batchId).where("date", "==", date).get(),
  ]);
  if (!batchSnap.exists) throw new FrsError("Batch not found.", 404);

  const byPresentId = new Map();
  const byEmail = new Map();
  profileSnap.docs.forEach((d) => {
    const p = { uid: d.id, ...d.data() };
    (p.presentIds || []).forEach((id) => byPresentId.set(String(id), p));
    byPresentId.set(d.id, p);
    if (p.email) byEmail.set(String(p.email).toLowerCase(), p);
  });

  const students = rosterSnap.docs
    .map((d) => {
      const x = d.data() || {};
      const presentId = String(x.studentId || x.uid || d.id);
      const email = String(x.email || "").trim().toLowerCase();
      const p = byPresentId.get(presentId) || (email ? byEmail.get(email) : null) || null;
      return {
        presentId,
        name: x.name || x.studentName || x.displayName || "—",
        rollNo: x.rollNo || x.regNo || x.regdNo || x.registrationNo || "",
        email,
        profileUid: p?.uid || null,
        ...publicProfile(p),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const checkins = logSnap.docs
    .map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        presentId: x.presentId,
        name: x.name || "",
        result: x.result,
        reason: x.reason || "",
        match: x.match ?? null,
        distanceM: x.distanceM ?? null,
        courseTitle: x.courseTitle || "",
        chapterTitle: x.chapterTitle || "",
        thumbnail: x.thumbnail || null,
        at: x.at?.toDate?.()?.toISOString?.() || null,
      };
    })
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return { date, geofence: normalizeGeofence(batchSnap.data()?.geofence), students, checkins };
}

async function handleAdminReset(me, body) {
  if (!me.isAdmin) throw new FrsError("Admins only.", 403);
  const uid = String(body?.uid || "").trim();
  if (!uid) throw new FrsError("uid is required.");
  const ref = profiles().doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const p = snap.data() || {};
  await adminDb.collection("crtFaceProfileResets").add({
    uid,
    name: p.name || "",
    email: p.email || "",
    registeredAt: p.registeredAt || null,
    resetBy: me.uid,
    resetAt: FieldValue.serverTimestamp(),
  });
  await ref.delete();
  return { ok: true };
}

const HANDLERS = {
  status: handleStatus,
  challenge: handleChallenge,
  register: handleRegister,
  checkIn: handleCheckIn,
  adminList: handleAdminList,
  adminReset: handleAdminReset,
};

export async function POST(req) {
  try {
    const me = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const handler = HANDLERS[body?.action];
    if (!handler) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json(await handler(me, body));
  } catch (e) {
    if (e instanceof FrsError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("crt-frs error", e);
    const status = e?.code?.startsWith?.("auth/") ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Face attendance request failed." }, { status });
  }
}
