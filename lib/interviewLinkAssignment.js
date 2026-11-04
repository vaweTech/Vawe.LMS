import { db, firestoreHelpers } from "./firebase";
import {
  getLinkPaperExamIds,
  getLinkQuestionPapers,
  pickBalancedLinkPaper,
} from "./interviewExamPapers";

/** Each candidate gets one exam picked at random (balanced) from the link's exams. */
export const LINK_MODE_RANDOM = "random";
/** Each candidate takes every exam in the link, one after another, in the saved order. */
export const LINK_MODE_SEQUENTIAL = "sequential";

/** Links created before modes existed were always random. */
export function getLinkMode(linkData) {
  return linkData?.mode === LINK_MODE_SEQUENTIAL ? LINK_MODE_SEQUENTIAL : LINK_MODE_RANDOM;
}

export function normalizeLinkPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function assignmentStorageKey(linkToken, phone) {
  return `interview-link-assignment:${linkToken}:${normalizeLinkPhone(phone)}`;
}

function assignmentDocRef(linkToken, phone) {
  return firestoreHelpers.doc(
    db,
    "interviewExamLinks",
    linkToken,
    "assignments",
    normalizeLinkPhone(phone)
  );
}

export function readStoredLinkAssignment(linkToken, phone) {
  if (typeof window === "undefined" || !linkToken || !phone) return null;
  try {
    const raw = localStorage.getItem(assignmentStorageKey(linkToken, phone));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeLinkAssignment(linkToken, phone, assignment) {
  if (typeof window === "undefined" || !linkToken || !phone) return;
  localStorage.setItem(
    assignmentStorageKey(linkToken, phone),
    JSON.stringify(assignment)
  );
}

export function linkSessionPhoneKey(linkToken) {
  return `interview-link-session-phone:${linkToken}`;
}

export async function loadInterviewLinkPapers(linkToken) {
  const snap = await firestoreHelpers.getDoc(
    firestoreHelpers.doc(db, "interviewExamLinks", linkToken)
  );
  if (!snap.exists()) {
    return { linkData: null, papers: [] };
  }

  const linkData = snap.data() || {};
  const examDocs = [];
  for (const examId of getLinkPaperExamIds(linkData)) {
    const examSnap = await firestoreHelpers.getDoc(
      firestoreHelpers.doc(db, "interviewExams", examId)
    );
    if (examSnap.exists()) {
      examDocs.push({ id: examSnap.id, ...examSnap.data() });
    }
  }

  const papers = getLinkQuestionPapers(linkData, examDocs).filter(
    (p) => p.questions.length > 0
  );
  return { linkData, papers };
}

/** Count how many candidates were assigned each paper for this link. */
export async function fetchLinkAssignmentCounts(linkToken, papers) {
  const counts = {};
  for (const paper of papers || []) {
    const id = paper.examId || paper.id;
    if (id) counts[id] = 0;
  }
  if (!linkToken || !papers?.length) return counts;

  try {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(
        db,
        "interviewExamLinks",
        linkToken,
        "assignments"
      )
    );
    for (const docSnap of snap.docs) {
      const examId = String(docSnap.data()?.examId || "").trim();
      if (examId && counts[examId] != null) {
        counts[examId] += 1;
      }
    }
  } catch (e) {
    console.warn("Could not load link assignment counts:", e);
  }
  return counts;
}

async function readFirestoreLinkAssignment(linkToken, phoneDigits) {
  try {
    const snap = await firestoreHelpers.getDoc(
      assignmentDocRef(linkToken, phoneDigits)
    );
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    if (!data.examId) return null;
    return {
      examId: data.examId,
      examTitle: String(data.examTitle || "").trim() || "Assigned set",
      linkLabel: String(data.linkLabel || "").trim(),
    };
  } catch {
    return null;
  }
}

async function writeFirestoreLinkAssignment(linkToken, phoneDigits, assignment) {
  await firestoreHelpers.setDoc(
    assignmentDocRef(linkToken, phoneDigits),
    {
      phone: phoneDigits,
      examId: assignment.examId,
      examTitle: assignment.examTitle,
      linkLabel: assignment.linkLabel || "",
      assignedAt: Date.now(),
    },
    { merge: true }
  );
}

function toAssignment(paper, linkData) {
  return {
    examId: paper.examId || paper.id,
    examTitle: String(paper.name || "").trim() || "Assigned set",
    linkLabel: String(linkData?.label || "").trim(),
  };
}

async function phoneHasSubmitted(examId, phoneDigits) {
  const q = firestoreHelpers.query(
    firestoreHelpers.collection(db, "interviewExams", String(examId), "submissions"),
    firestoreHelpers.where("phone", "in", [phoneDigits, `91${phoneDigits}`])
  );
  const snap = await firestoreHelpers.getDocs(q);
  return !snap.empty;
}

/**
 * Sequential links: the first exam (in link order) this phone has not submitted yet.
 * Returns { examId, examTitle, linkLabel, step, totalSteps } or { allDone: true, totalSteps }.
 */
async function resolveSequentialStep(linkToken, phoneDigits) {
  const { linkData, papers } = await loadInterviewLinkPapers(linkToken);
  if (!papers.length) return null;
  for (let i = 0; i < papers.length; i += 1) {
    const paper = papers[i];
    const done = phoneDigits ? await phoneHasSubmitted(paper.examId || paper.id, phoneDigits) : false;
    if (!done) {
      return { ...toAssignment(paper, linkData), step: i + 1, totalSteps: papers.length };
    }
  }
  return { allDone: true, totalSteps: papers.length, linkLabel: String(linkData?.label || "").trim() };
}

async function readLinkMode(linkToken) {
  const snap = await firestoreHelpers.getDoc(firestoreHelpers.doc(db, "interviewExamLinks", linkToken));
  return snap.exists() ? getLinkMode(snap.data()) : LINK_MODE_RANDOM;
}

/**
 * Random links: one stable paper per link + phone; new phones get the least-used paper.
 * Sequential links: the next exam this phone still has to take (see resolveSequentialStep).
 */
export async function resolveInterviewLinkAssignment({ linkToken, phone }) {
  const phoneDigits = normalizeLinkPhone(phone);
  if (!linkToken || phoneDigits.length < 10) return null;

  if ((await readLinkMode(linkToken)) === LINK_MODE_SEQUENTIAL) {
    const step = await resolveSequentialStep(linkToken, phoneDigits);
    return step ? { ...step, reused: false } : null;
  }

  const firestoreAssignment = await readFirestoreLinkAssignment(
    linkToken,
    phoneDigits
  );
  if (firestoreAssignment?.examId) {
    storeLinkAssignment(linkToken, phoneDigits, firestoreAssignment);
    return { ...firestoreAssignment, reused: true };
  }

  const stored = readStoredLinkAssignment(linkToken, phoneDigits);
  if (stored?.examId) {
    try {
      await writeFirestoreLinkAssignment(linkToken, phoneDigits, stored);
    } catch (e) {
      console.warn("Could not sync assignment to Firestore:", e);
    }
    return { ...stored, reused: true };
  }

  const { linkData, papers } = await loadInterviewLinkPapers(linkToken);
  if (!papers.length) return null;

  const counts = await fetchLinkAssignmentCounts(linkToken, papers);
  const paper = pickBalancedLinkPaper(papers, counts);
  if (!paper) return null;

  const assignment = toAssignment(paper, linkData);
  storeLinkAssignment(linkToken, phoneDigits, assignment);

  try {
    await writeFirestoreLinkAssignment(linkToken, phoneDigits, assignment);
  } catch (e) {
    console.warn("Could not save assignment to Firestore:", e);
  }

  return { ...assignment, reused: false };
}

/** Exam to open from the join link (before phone is known): first exam, or a balanced random pick. */
export async function pickBalancedPaperForLink(linkToken) {
  const { linkData, papers } = await loadInterviewLinkPapers(linkToken);
  if (!papers.length) return null;
  if (getLinkMode(linkData) === LINK_MODE_SEQUENTIAL) {
    return { ...toAssignment(papers[0], linkData), step: 1, totalSteps: papers.length };
  }
  const counts = await fetchLinkAssignmentCounts(linkToken, papers);
  const paper = pickBalancedLinkPaper(papers, counts);
  if (!paper) return null;
  return toAssignment(paper, linkData);
}
