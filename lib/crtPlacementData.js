"use client";

import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  addDoc,
  deleteDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/** Shared placement data for the PO dashboard and the CRT Placements page. */

export const DRIVES_COLLECTION = "crtPlacementDrives";
export const DEFAULT_DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AIML", "DS"];
export const ALL_DEPARTMENTS = "ALL";

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  packageMin: 0.5,
  packageMax: 100,
  openingsMax: 5000,
  roundsMax: 20,
  backlogsMax: 50,
  earliestYear: 2015,
  futureYears: 2,
};

const ID_CHUNK = 30;
const NAME_PATTERN = /^[A-Za-z0-9&.,()'/+\- ]+$/;

export function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

export function toIsoDate(v) {
  const ms = toMillis(v);
  return ms ? new Date(ms).toISOString().slice(0, 10) : "";
}

export function parsePackageLpa(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const m = String(raw).replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

export function companyKey(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanText(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

/** "2025-26" → 2026 (graduating year). */
export function academicYearEnd(academicYear) {
  const m = String(academicYear || "").match(/^(\d{4})\s*-\s*(\d{2,4})$/);
  if (!m) return null;
  const start = Number(m[1]);
  return start + 1;
}

function isEmptyCompany(c) {
  const v = String(c || "").trim().toLowerCase();
  return !v || v === "-" || v === "—" || v === "n/a" || v === "na";
}

function rawOffers(d) {
  const raw = d?.offers ?? d?.placementOffers ?? d?.offerList ?? d?.offersHistory;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((o) => {
        if (!o || typeof o !== "object") return null;
        const company = cleanText(o.company || o.companyName || o.placementCompany);
        if (isEmptyCompany(company)) return null;
        return {
          company,
          packageLpa: parsePackageLpa(o.packageLpa ?? o.package ?? o.ctcLpa ?? o.salaryLpa),
          offerDate: toIsoDate(o.offerDate ?? o.placementDate),
        };
      })
      .filter(Boolean);
  }
  const company = cleanText(d?.placementCompany || d?.placedCompany || d?.offerCompany || d?.company);
  if (isEmptyCompany(company)) return [];
  return [
    {
      company,
      packageLpa: parsePackageLpa(d.packageLpa ?? d.package ?? d.ctcLpa ?? d.salaryLpa ?? d.salary),
      offerDate: toIsoDate(d.offerDate ?? d.placementDate ?? d.placedAt),
    },
  ];
}

/** "2025-26", "2025-2026" or a passing year like "2026" → "2025-26". */
function normalizeAcademicYear(d) {
  const raw = cleanText(d.academicYear || d.batchYear);
  const range = raw.match(/^(\d{4})\s*[-/]\s*(\d{2,4})$/);
  if (range) return `${range[1]}-${range[2].slice(-2)}`;
  if (raw) return raw;
  const passing = cleanText(d.yearOfPassing || d.passoutYear || d.passOutYear || d.graduationYear).match(/\b(\d{4})\b/);
  if (!passing) return "";
  const end = Number(passing[1]);
  return `${end - 1}-${String(end).slice(-2)}`;
}

const DEPARTMENT_ALIASES = {
  "COMPUTER SCIENCE": "CSE",
  "COMPUTER SCIENCE AND ENGINEERING": "CSE",
  "COMPUTER SCIENCE & ENGINEERING": "CSE",
  "INFORMATION TECHNOLOGY": "IT",
  "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
  "ELECTRONICS & COMMUNICATION ENGINEERING": "ECE",
  "ELECTRICAL AND ELECTRONICS ENGINEERING": "EEE",
  "ELECTRICAL & ELECTRONICS ENGINEERING": "EEE",
  "MECHANICAL ENGINEERING": "MECH",
  MECHANICAL: "MECH",
  "CIVIL ENGINEERING": "CIVIL",
  "DATA SCIENCE": "DS",
  "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING": "AIML",
  "AI & ML": "AIML",
  "AI&ML": "AIML",
};

function normalizeDepartment(d) {
  const v = cleanText(d.branch || d.department || d.dept).toUpperCase().replace(/\.$/, "");
  if (!v) return "GENERAL";
  return DEPARTMENT_ALIASES[v] || v;
}

/** Firestore student profile → one consistent shape used by every placement screen. */
export function normalizeCrtStudent(id, data, source) {
  const d = data || {};
  const offers = rawOffers(d);
  const ps = String(d.placementStatus || d.placement || "").toLowerCase();
  let placed = d.placed === true || d.isPlaced === true || ps === "placed" || ps === "yes" || offers.length > 0;
  if (ps === "unplaced" || ps === "no" || d.placed === false) placed = false;

  const backlogsRaw = d.backlogs ?? d.activeBacklogs ?? d.numberOfBacklogs;
  const backlogs = backlogsRaw === "" || backlogsRaw == null ? null : Number(backlogsRaw);

  return {
    id,
    source,
    regNo: cleanText(d.regdNo || d.regNo || d.registrationNumber) || "—",
    name: cleanText(d.name || d.studentName) || "Unnamed student",
    department: normalizeDepartment(d),
    academicYear: normalizeAcademicYear(d),
    status: placed ? "Placed" : "Unplaced",
    offers,
    backlogs: Number.isFinite(backlogs) ? backlogs : null,
  };
}

export const NO_BATCH_LABEL = "No batch";

/**
 * Students assigned to any CRT program or batch — the only students placement screens show.
 * Returns { ids, enrollments } where enrollments maps uid → [{ crtId, programName, batchId, batchName }].
 * A student listed on the program but in no batch gets one entry with batchId "".
 */
export async function fetchAssignedCrtStudents() {
  const ids = new Set();
  const enrollments = new Map();
  if (!db) return { ids, enrollments };
  const add = (uid, entry) => {
    if (!uid) return;
    ids.add(uid);
    const list = enrollments.get(uid) || [];
    if (!list.some((e) => e.crtId === entry.crtId && e.batchId === entry.batchId)) list.push(entry);
    enrollments.set(uid, list);
  };
  const crtSnap = await getDocs(collection(db, "crt"));
  await Promise.all(
    crtSnap.docs.map(async (crtDoc) => {
      const crtData = crtDoc.data() || {};
      const programName = cleanText(crtData.name || crtData.title) || crtDoc.id;
      try {
        const [studentsSnap, batchesSnap] = await Promise.all([
          getDocs(collection(db, "crt", crtDoc.id, "students")),
          getDocs(collection(db, "crt", crtDoc.id, "batches")),
        ]);
        const inBatch = new Set();
        await Promise.all(
          batchesSnap.docs.map(async (b) => {
            const batchName = cleanText(b.data()?.name) || b.id;
            try {
              const bs = await getDocs(collection(db, "crt", crtDoc.id, "batches", b.id, "students"));
              bs.docs.forEach((s) => {
                const uid = s.data()?.studentId;
                if (!uid) return;
                inBatch.add(uid);
                add(uid, { crtId: crtDoc.id, programName, batchId: b.id, batchName });
              });
            } catch {
              /* skip unreadable batch */
            }
          })
        );
        studentsSnap.docs.forEach((s) => {
          const uid = s.data()?.studentId;
          if (uid && !inBatch.has(uid)) {
            add(uid, { crtId: crtDoc.id, programName, batchId: "", batchName: NO_BATCH_LABEL });
          }
        });
      } catch {
        /* skip unreadable program */
      }
    })
  );
  return { ids, enrollments };
}

export async function fetchAssignedCrtStudentIds() {
  return (await fetchAssignedCrtStudents()).ids;
}

/**
 * Live CRT student list. Profiles in `students/{uid}` win over `users/crtStudent/students/{uid}`.
 * Returns an unsubscribe function.
 */
export function subscribeCrtStudents(onData, onError) {
  if (!db) {
    onData([]);
    return () => {};
  }
  let cancelled = false;

  /* ---- live membership: crt → program students + batches → batch students ---- */
  // crtId → { programName, programUids:Set, batches: Map batchId → { batchName, uids:Set } }
  const programs = new Map();
  const programUnsubs = new Map(); // crtId → [unsub...]
  const batchUnsubs = new Map(); // `${crtId}/${batchId}` → unsub
  let pending = 0; // membership listeners still waiting for their first snapshot
  const track = (onFirst) => {
    pending += 1;
    let first = true;
    return () => {
      if (first) {
        first = false;
        pending -= 1;
      }
      onFirst?.();
    };
  };

  /* ---- live profiles for the current id set ---- */
  let profileUnsubs = [];
  let profileKey = "";
  const primary = new Map();
  const fallback = new Map();
  const ready = new Set();
  let expected = 0;
  let enrollments = new Map();

  const withEnrollments = (row) => ({ ...row, crtEnrollments: enrollments.get(row.id) || [] });

  const emit = () => {
    if (cancelled || pending > 0 || ready.size < expected) return;
    const rows = [];
    const seen = new Set();
    primary.forEach((data, uid) => {
      seen.add(uid);
      rows.push(withEnrollments(normalizeCrtStudent(uid, data, "students")));
    });
    fallback.forEach((data, uid) => {
      if (!seen.has(uid)) rows.push(withEnrollments(normalizeCrtStudent(uid, data, "crtStudentStudents")));
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    onData(rows);
  };

  const subscribeProfiles = (ids) => {
    const list = [...ids].sort();
    const key = list.join(",");
    if (key === profileKey) return emit();
    profileKey = key;
    profileUnsubs.forEach((u) => u());
    profileUnsubs = [];
    primary.clear();
    fallback.clear();
    ready.clear();
    const chunks = [];
    for (let i = 0; i < list.length; i += ID_CHUNK) chunks.push(list.slice(i, i + ID_CHUNK));
    expected = chunks.length * 2;
    if (!chunks.length) return emit();
    chunks.forEach((chunk, idx) => {
      [
        { key: `p${idx}`, ref: collection(db, "students"), store: primary },
        { key: `f${idx}`, ref: collection(db, "users", "crtStudent", "students"), store: fallback },
      ].forEach(({ key: readyKey, ref, store }) => {
        profileUnsubs.push(
          onSnapshot(
            query(ref, where(documentId(), "in", chunk)),
            (snap) => {
              chunk.forEach((uid) => store.delete(uid));
              snap.docs.forEach((d) => store.set(d.id, d.data()));
              ready.add(readyKey);
              emit();
            },
            (err) => {
              ready.add(readyKey);
              if (store === primary) onError?.(err);
              emit();
            }
          )
        );
      });
    });
  };

  let rebuildTimer = null;
  const scheduleRebuild = () => {
    if (cancelled || pending > 0) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      if (cancelled || pending > 0) return;
      const byUid = new Map();
      const add = (uid, entry) => {
        const list = byUid.get(uid) || [];
        if (!list.some((e) => e.crtId === entry.crtId && e.batchId === entry.batchId)) list.push(entry);
        byUid.set(uid, list);
      };
      programs.forEach((p, crtId) => {
        const inBatch = new Set();
        p.batches.forEach((b, batchId) => {
          b.uids.forEach((uid) => {
            inBatch.add(uid);
            add(uid, { crtId, programName: p.programName, batchId, batchName: b.batchName });
          });
        });
        p.programUids.forEach((uid) => {
          if (!inBatch.has(uid)) add(uid, { crtId, programName: p.programName, batchId: "", batchName: NO_BATCH_LABEL });
        });
      });
      enrollments = byUid;
      subscribeProfiles(new Set(byUid.keys()));
    }, 150);
  };

  const uidsOf = (snap) => new Set(snap.docs.map((s) => s.data()?.studentId).filter(Boolean));

  const watchBatch = (crtId, batchId) => {
    const key = `${crtId}/${batchId}`;
    if (batchUnsubs.has(key)) return;
    const done = track(scheduleRebuild);
    batchUnsubs.set(
      key,
      onSnapshot(
        collection(db, "crt", crtId, "batches", batchId, "students"),
        (snap) => {
          const b = programs.get(crtId)?.batches.get(batchId);
          if (b) b.uids = uidsOf(snap);
          done();
        },
        () => done()
      )
    );
  };

  const unwatchProgram = (crtId) => {
    (programUnsubs.get(crtId) || []).forEach((u) => u());
    programUnsubs.delete(crtId);
    [...batchUnsubs.keys()]
      .filter((k) => k.startsWith(`${crtId}/`))
      .forEach((k) => {
        batchUnsubs.get(k)();
        batchUnsubs.delete(k);
      });
    programs.delete(crtId);
  };

  const watchProgram = (crtId, programName) => {
    const existing = programs.get(crtId);
    if (existing) {
      existing.programName = programName;
      return;
    }
    programs.set(crtId, { programName, programUids: new Set(), batches: new Map() });
    const doneStudents = track(scheduleRebuild);
    const doneBatches = track(scheduleRebuild);
    programUnsubs.set(crtId, [
      onSnapshot(
        collection(db, "crt", crtId, "students"),
        (snap) => {
          const p = programs.get(crtId);
          if (p) p.programUids = uidsOf(snap);
          doneStudents();
        },
        () => doneStudents()
      ),
      onSnapshot(
        collection(db, "crt", crtId, "batches"),
        (snap) => {
          const p = programs.get(crtId);
          if (!p) return doneBatches();
          const live = new Set();
          snap.docs.forEach((b) => {
            live.add(b.id);
            const batchName = cleanText(b.data()?.name) || b.id;
            const cur = p.batches.get(b.id);
            if (cur) cur.batchName = batchName;
            else p.batches.set(b.id, { batchName, uids: new Set() });
            watchBatch(crtId, b.id);
          });
          [...p.batches.keys()].forEach((id) => {
            if (live.has(id)) return;
            p.batches.delete(id);
            const key = `${crtId}/${id}`;
            batchUnsubs.get(key)?.();
            batchUnsubs.delete(key);
          });
          doneBatches();
        },
        () => doneBatches()
      ),
    ]);
  };

  const doneCrt = track(scheduleRebuild);
  const crtUnsub = onSnapshot(
    collection(db, "crt"),
    (snap) => {
      const live = new Set();
      snap.docs.forEach((d) => {
        live.add(d.id);
        const data = d.data() || {};
        watchProgram(d.id, cleanText(data.name || data.title) || d.id);
      });
      [...programs.keys()].filter((id) => !live.has(id)).forEach(unwatchProgram);
      doneCrt();
    },
    (err) => {
      doneCrt();
      onError?.(err);
    }
  );

  return () => {
    cancelled = true;
    clearTimeout(rebuildTimer);
    crtUnsub();
    [...programUnsubs.keys()].forEach(unwatchProgram);
    profileUnsubs.forEach((u) => u());
  };
}

/* ----------------------------- validation ----------------------------- */

function validateName(value, label) {
  const v = cleanText(value);
  if (!v) return `${label} is required.`;
  if (v.length < LIMITS.nameMin) return `${label} must be at least ${LIMITS.nameMin} characters.`;
  if (v.length > LIMITS.nameMax) return `${label} must be at most ${LIMITS.nameMax} characters.`;
  if (!NAME_PATTERN.test(v)) return `${label} has characters that are not allowed.`;
  return "";
}

function validateInt(raw, label, { min, max, required = true }) {
  const s = String(raw ?? "").trim();
  if (!s) return required ? `${label} is required.` : "";
  if (!/^\d+$/.test(s)) return `${label} must be a whole number.`;
  const n = Number(s);
  if (n < min) return `${label} must be at least ${min}.`;
  if (n > max) return `${label} must be at most ${max}.`;
  return "";
}

function validatePackage(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "Package (LPA) is required.";
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return "Package must be a number like 6 or 6.5 (in LPA).";
  const n = Number(s);
  if (n < LIMITS.packageMin) return `Package must be at least ${LIMITS.packageMin} LPA.`;
  if (n > LIMITS.packageMax) return `Package must be at most ${LIMITS.packageMax} LPA.`;
  return "";
}

function validateDate(raw, label, { allowFuture }) {
  const s = String(raw ?? "").trim();
  if (!s) return `${label} is required.`;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return `${label} must be a valid date.`;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return `${label} must be a valid date.`;
  }
  const thisYear = new Date().getFullYear();
  if (year < LIMITS.earliestYear) return `${label} cannot be before ${LIMITS.earliestYear}.`;
  if (year > thisYear + LIMITS.futureYears) return `${label} is too far in the future.`;
  if (!allowFuture) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return `${label} cannot be in the future.`;
  }
  return "";
}

/**
 * Validates a placement drive form.
 * `context.drives` is the current list (for duplicate checks),
 * `context.maxRoundsCleared` is the highest round already recorded for this drive.
 */
export function validateDrive(form, { drives = [], editingId = null, maxRoundsCleared = 0 } = {}) {
  const errors = {};
  const set = (k, msg) => msg && (errors[k] = msg);

  set("companyName", validateName(form.companyName, "Company name"));
  set("role", validateName(form.role, "Role"));
  set("packageLpa", validatePackage(form.packageLpa));
  set("driveDate", validateDate(form.driveDate, "Drive date", { allowFuture: true }));
  set("openings", validateInt(form.openings, "Openings", { min: 1, max: LIMITS.openingsMax }));
  set("rounds", validateInt(form.rounds, "Rounds", { min: 1, max: LIMITS.roundsMax }));
  set("maxBacklogs", validateInt(form.maxBacklogs, "Max backlogs allowed", { min: 0, max: LIMITS.backlogsMax, required: false }));

  const departments = Array.isArray(form.departments) ? form.departments : [];
  if (!departments.length) errors.departments = "Choose at least one department, or All.";

  if (!errors.rounds && Number(form.rounds) < maxRoundsCleared) {
    errors.rounds = `Rounds cannot be less than ${maxRoundsCleared}; a student has already cleared that many.`;
  }

  if (!errors.companyName && !errors.role && !errors.driveDate) {
    const dup = drives.find(
      (d) =>
        d.id !== editingId &&
        companyKey(d.companyName) === companyKey(form.companyName) &&
        companyKey(d.role) === companyKey(form.role) &&
        d.driveDate === form.driveDate
    );
    if (dup) errors.companyName = "A drive for this company, role and date already exists.";
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          companyName: cleanText(form.companyName),
          companyKey: companyKey(form.companyName),
          role: cleanText(form.role),
          packageLpa: Number(form.packageLpa),
          driveDate: form.driveDate,
          departments: departments.includes(ALL_DEPARTMENTS) ? [ALL_DEPARTMENTS] : [...new Set(departments)].sort(),
          openings: Number(form.openings),
          rounds: Number(form.rounds),
          maxBacklogs: String(form.maxBacklogs ?? "").trim() === "" ? null : Number(form.maxBacklogs),
        }
      : null,
  };
}

/** Validates the PO's offer rows. Returns cleaned rows ready to save, or a list of errors. */
export function validateOfferRows(rows) {
  const errors = [];
  const cleaned = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((r, i) => {
    const label = `Offer ${i + 1}`;
    const company = cleanText(r?.company);
    const pkg = String(r?.packageLpa ?? "").trim();
    const date = String(r?.offerDate ?? "").trim();
    if (!company && !pkg && !date) return;
    const nameErr = validateName(company, `${label}: company`);
    if (nameErr) errors.push(nameErr);
    const pkgErr = validatePackage(pkg);
    if (pkgErr) errors.push(`${label}: ${pkgErr}`);
    if (date) {
      const dateErr = validateDate(date, `${label}: offer date`, { allowFuture: false });
      if (dateErr) errors.push(dateErr);
    }
    const key = companyKey(company);
    if (key && seen.has(key)) errors.push(`${label}: ${company} is listed more than once.`);
    seen.add(key);
    cleaned.push({ company, packageLpa: Number(pkg), offerDate: date });
  });
  return { ok: errors.length === 0, errors, cleaned };
}

/** Checks whether a student may be added to a drive. Returns an error message or "". */
export function checkCandidateEligibility(student, drive) {
  if (!student || !drive) return "Select a student.";
  const depts = drive.departments || [];
  if (!depts.includes(ALL_DEPARTMENTS) && !depts.includes(student.department)) {
    return `${student.name} (${student.department}) is not in the departments allowed for this drive.`;
  }
  if (drive.maxBacklogs != null && student.backlogs != null && student.backlogs > drive.maxBacklogs) {
    return `${student.name} has ${student.backlogs} backlogs; this drive allows at most ${drive.maxBacklogs}.`;
  }
  return "";
}

export function validateRoundsCleared(raw, drive) {
  return validateInt(raw, "Rounds cleared", { min: 0, max: Number(drive?.rounds) || LIMITS.roundsMax });
}

/* ------------------------------- drives ------------------------------- */

function normalizeDrive(id, d) {
  const departments = Array.isArray(d.departments)
    ? d.departments.map((x) => String(x).toUpperCase())
    : d.department
      ? [String(d.department).toUpperCase()]
      : [ALL_DEPARTMENTS];
  const candidates = {};
  Object.entries(d.candidates || {}).forEach(([uid, c]) => {
    candidates[uid] = { roundsCleared: Math.max(0, Number(c?.roundsCleared) || 0) };
  });
  return {
    id,
    companyName: cleanText(d.companyName),
    role: cleanText(d.role),
    packageLpa: parsePackageLpa(d.packageLpa ?? d.package),
    driveDate: String(d.driveDate || ""),
    departments,
    openings: Number(d.openings) || 0,
    rounds: Math.max(1, Number(d.rounds) || 1),
    maxBacklogs: d.maxBacklogs == null || d.maxBacklogs === "" ? null : Number(d.maxBacklogs),
    candidates,
  };
}

export function subscribeDrives(onData, onError) {
  if (!db) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, DRIVES_COLLECTION),
    (snap) => {
      const rows = snap.docs.map((d) => normalizeDrive(d.id, d.data()));
      rows.sort((a, b) => b.driveDate.localeCompare(a.driveDate));
      onData(rows);
    },
    (err) => onError?.(err)
  );
}

function auditFields() {
  return { updatedAt: serverTimestamp(), updatedBy: auth?.currentUser?.uid || null };
}

export async function saveDrive(value, editingId) {
  if (!db) throw new Error("Database is not available.");
  if (editingId) {
    await updateDoc(doc(db, DRIVES_COLLECTION, editingId), { ...value, ...auditFields() });
    return editingId;
  }
  const ref = await addDoc(collection(db, DRIVES_COLLECTION), {
    ...value,
    candidates: {},
    createdAt: serverTimestamp(),
    createdBy: auth?.currentUser?.uid || null,
    ...auditFields(),
  });
  return ref.id;
}

export async function deleteDrive(id) {
  if (!db) throw new Error("Database is not available.");
  await deleteDoc(doc(db, DRIVES_COLLECTION, id));
}

export async function setCandidateRounds(driveId, uid, roundsCleared) {
  if (!db) throw new Error("Database is not available.");
  const ref = doc(db, DRIVES_COLLECTION, driveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("This drive was deleted. Refresh and try again.");
  await updateDoc(ref, {
    [`candidates.${uid}`]: { roundsCleared: Number(roundsCleared), updatedAt: Date.now() },
    ...auditFields(),
  });
}

export async function removeCandidate(driveId, uid) {
  if (!db) throw new Error("Database is not available.");
  await updateDoc(doc(db, DRIVES_COLLECTION, driveId), {
    [`candidates.${uid}`]: deleteField(),
    ...auditFields(),
  });
}

/* ------------------------------ derived ------------------------------- */

/**
 * Students attending a drive: added candidates plus anyone the PO recorded an offer for
 * from this company in the drive's year. An offer means the student cleared every round.
 */
export function driveParticipants(drive, students) {
  const key = companyKey(drive.companyName);
  const driveYear = drive.driveDate.slice(0, 4);
  const byId = new Map(students.map((s) => [s.id, s]));
  const rows = new Map();

  students.forEach((s) => {
    const offer = s.offers.find(
      (o) => companyKey(o.company) === key && (!o.offerDate || o.offerDate.slice(0, 4) === driveYear)
    );
    if (offer) {
      rows.set(s.id, { student: s, placed: true, offer, roundsCleared: drive.rounds, fromOffer: true });
    }
  });

  Object.entries(drive.candidates || {}).forEach(([uid, c]) => {
    if (rows.has(uid)) return;
    const s = byId.get(uid);
    if (!s) return;
    rows.set(uid, {
      student: s,
      placed: false,
      offer: null,
      roundsCleared: Math.min(c.roundsCleared, drive.rounds),
      fromOffer: false,
    });
  });

  return [...rows.values()].sort((a, b) => a.student.name.localeCompare(b.student.name));
}

export function maxRoundsClearedForDrive(drive) {
  return Object.values(drive?.candidates || {}).reduce(
    (max, c) => Math.max(max, Number(c.roundsCleared) || 0),
    0
  );
}

export function csvEscape(value) {
  const s = String(value ?? "");
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}