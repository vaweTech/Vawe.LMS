"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

/**
 * CRT class attendance.
 *
 * Trainers write one doc per batch + course + day (chapter) + date to `attendance`:
 *   { type: "trainer", crtProgramId, batchId, courseId, chapterId, date,
 *     status: "held" | "not_held", present: [studentId], roster: [studentId], rosterNames: { id: name } }
 * Each held doc is one session. A student is only counted for sessions they were enrolled for:
 * listed in `roster`, or (older docs without a roster) dated on/after the day they joined the batch.
 */

export const LOW_ATTENDANCE_PERCENT = 75;
export const SESSION_NOT_HELD = "not_held";

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Local calendar date YYYY-MM-DD. */
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `assignedAt` (ISO string / Timestamp / millis) → local YYYY-MM-DD, or "" when unknown. */
export function joinDateStr(value) {
  if (!value) return "";
  let ms = 0;
  if (typeof value === "number") ms = value;
  else if (typeof value === "string") ms = new Date(value).getTime();
  else if (typeof value?.toDate === "function") ms = value.toDate().getTime();
  else if (typeof value?.seconds === "number") ms = value.seconds * 1000;
  return Number.isFinite(ms) && ms > 0 ? localDateStr(new Date(ms)) : "";
}

/** Batch student doc → the shape every attendance screen uses. */
export function normalizeBatchStudent(d) {
  const x = d.data() || {};
  return {
    docId: d.id,
    presentId: String(x.studentId || x.uid || d.id),
    name: x.name || x.studentName || x.displayName || "—",
    rollNo: x.rollNo || x.regNo || x.regdNo || x.registrationNo || "",
    email: x.email || "",
    phone: x.phone || x.phone1 || "",
    joinDate: joinDateStr(x.assignedAt),
  };
}

export function isSessionHeld(session) {
  return session.status !== SESSION_NOT_HELD;
}

/** Whether `student` ({ presentId, joinDate }) was expected to attend `session`. */
export function wasEnrolledFor(session, student) {
  if (Array.isArray(session.roster)) return session.roster.includes(student.presentId);
  return !student.joinDate || session.date >= student.joinDate;
}

function addRegd(set, v) {
  const s = String(v ?? "").trim();
  if (s) set.add(s);
}

/**
 * Admin assigns batch members with `studentId` = document id from `students` (CRT list), not always
 * the Firebase Auth uid. Collect every id/email/regd no. we can tie to this login.
 */
export async function resolveCrtStudentBatchMatchKeys(db, authUser) {
  const uid = authUser?.uid;
  const keys = new Set();
  const emails = new Set();
  const regdNos = new Set();
  if (uid) keys.add(uid);
  const authEmail = (authUser?.email || "").trim().toLowerCase();
  if (authEmail) emails.add(authEmail);

  const absorb = (id, data) => {
    keys.add(id);
    if (data?.email) emails.add(String(data.email).trim().toLowerCase());
    addRegd(regdNos, data?.regdNo);
  };

  try {
    const snap = await getDoc(doc(db, "students", uid));
    if (snap.exists()) absorb(snap.id, snap.data());
  } catch (_) {
    /* ignore */
  }
  try {
    const snap = await getDocs(query(collection(db, "students"), where("uid", "==", uid)));
    snap.docs.forEach((d) => absorb(d.id, d.data()));
  } catch (_) {
    /* ignore */
  }
  try {
    const snap = await getDocs(
      query(collection(db, "users", "crtStudent", "students"), where("uid", "==", uid))
    );
    snap.docs.forEach((d) => absorb(d.id, d.data()));
  } catch (_) {
    /* ignore */
  }
  try {
    const alt = await getDoc(doc(db, "users", "crtStudent", "students", uid));
    if (alt.exists()) absorb(alt.id, alt.data());
  } catch (_) {
    /* ignore */
  }

  return { keys, emails, regdNos };
}

/**
 * Batches of a CRT programme this student belongs to, with the id the trainer page stores in
 * `present` and the date they joined the batch.
 */
export async function findCrtBatchMembership(db, crtId, identity) {
  const keys = identity?.keys instanceof Set ? identity.keys : new Set();
  const emails = identity?.emails instanceof Set ? identity.emails : new Set();
  const regdNos = identity?.regdNos instanceof Set ? identity.regdNos : new Set();
  const batchesSnap = await getDocs(collection(db, "crt", crtId, "batches"));
  const memberships = await Promise.all(
    batchesSnap.docs.map(async (b) => {
      const stSnap = await getDocs(collection(db, "crt", crtId, "batches", b.id, "students"));
      const match = stSnap.docs.find((d) => {
        const x = d.data() || {};
        const sid = String(x.studentId ?? x.uid ?? d.id ?? "").trim();
        if (sid && keys.has(sid)) return true;
        const uidField = String(x.uid ?? "").trim();
        if (uidField && keys.has(uidField)) return true;
        const em = String(x.email ?? "").trim().toLowerCase();
        if (em && emails.has(em)) return true;
        const regd = String(x.regdNo ?? "").trim();
        return !!regd && regdNos.has(regd);
      });
      if (!match) return null;
      const st = normalizeBatchStudent(match);
      return { batchId: b.id, batchName: b.data()?.name || b.id, presentId: st.presentId, joinDate: st.joinDate };
    })
  );
  return memberships.filter(Boolean);
}

export async function findBatchIdsForStudentInCrt(db, crtId, identity) {
  const memberships = await findCrtBatchMembership(db, crtId, identity);
  return memberships.map((m) => m.batchId);
}

export function normalizeSession(id, x) {
  return {
    id,
    crtProgramId: x.crtProgramId || "",
    batchId: x.batchId || "",
    courseId: x.courseId || "",
    chapterId: x.chapterId || "",
    date: String(x.date || ""),
    status: x.status === SESSION_NOT_HELD ? SESSION_NOT_HELD : "held",
    present: Array.isArray(x.present) ? x.present.map(String) : [],
    roster: Array.isArray(x.roster) ? x.roster.map(String) : null,
    rosterNames: x.rosterNames && typeof x.rosterNames === "object" ? x.rosterNames : {},
    markedBy: x.markedBy || null,
    markedByName: x.markedByName || "",
  };
}

/** All trainer attendance sessions recorded for one batch of a CRT programme. */
export async function fetchBatchAttendanceSessions(db, crtId, batchId) {
  const snap = await getDocs(
    query(
      collection(db, "attendance"),
      where("type", "==", "trainer"),
      where("batchId", "==", batchId)
    )
  );
  return snap.docs
    .map((d) => normalizeSession(d.id, d.data() || {}))
    .filter((s) => s.crtProgramId === crtId && s.chapterId && s.date);
}

/** Every trainer session (all programmes and batches) on one date. */
export async function fetchSessionsOnDate(db, dateStr) {
  const snap = await getDocs(
    query(collection(db, "attendance"), where("type", "==", "trainer"), where("date", "==", dateStr))
  );
  return snap.docs.map((d) => normalizeSession(d.id, d.data() || {})).filter((s) => s.crtProgramId && s.batchId);
}

export function attendanceStats(total, present) {
  return { total, present, percent: total > 0 ? Math.round((present / total) * 100) : 0 };
}

/** Attendance of one student over a list of sessions (skips classes not held / before they joined). */
export function studentAttendance(sessions, student) {
  let total = 0;
  let present = 0;
  for (const s of sessions) {
    if (!isSessionHeld(s) || !wasEnrolledFor(s, student)) continue;
    total += 1;
    if (s.present.includes(student.presentId)) present += 1;
  }
  return attendanceStats(total, present);
}

/**
 * Attendance for the signed-in student across the given courses of one CRT programme.
 * Returns { total, present, percent, history: [{ id, date, courseId, chapterId, batchName, present }] }.
 */
export async function computeCrtStudentAttendance(db, authUser, crtId, courseIds = null) {
  const empty = { ...attendanceStats(0, 0), history: [] };
  if (!db || !authUser?.uid || !crtId) return empty;
  const identity = await resolveCrtStudentBatchMatchKeys(db, authUser);
  const memberships = await findCrtBatchMembership(db, crtId, identity);
  if (!memberships.length) return empty;

  const courseFilter = courseIds ? new Set(courseIds) : null;
  const history = [];
  for (const m of memberships) {
    const sessions = await fetchBatchAttendanceSessions(db, crtId, m.batchId);
    for (const s of sessions) {
      if (courseFilter && !courseFilter.has(s.courseId)) continue;
      if (!isSessionHeld(s) || !wasEnrolledFor(s, m)) continue;
      const present = s.present.includes(m.presentId) || s.present.some((id) => identity.keys.has(id));
      history.push({ id: s.id, date: s.date, courseId: s.courseId, chapterId: s.chapterId, batchName: m.batchName, present });
    }
  }
  history.sort((a, b) => b.date.localeCompare(a.date));
  const presentCount = history.filter((h) => h.present).length;
  return { ...attendanceStats(history.length, presentCount), history };
}

/** Sends attendance alerts through the server (email + WhatsApp when configured). */
export async function sendAttendanceAlert(authUser, payload) {
  const token = await authUser?.getIdToken?.();
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch("/api/crt-attendance-alert", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Could not send alerts.");
  return data;
}
