import { db, firestoreHelpers } from "./firebase";
import {
  getLinkPaperExamIds,
  getLinkQuestionPapers,
  pickBalancedLinkPaper,
} from "./interviewExamPapers";

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

/**
 * One stable paper per link + phone.
 * New phones get the least-used paper from the pool (fair distribution).
 */
export async function resolveInterviewLinkAssignment({ linkToken, phone }) {
  const phoneDigits = normalizeLinkPhone(phone);
  if (!linkToken || phoneDigits.length < 10) return null;

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

/** Balanced pick for join redirect (before phone is known). */
export async function pickBalancedPaperForLink(linkToken) {
  const { linkData, papers } = await loadInterviewLinkPapers(linkToken);
  if (!papers.length) return null;
  const counts = await fetchLinkAssignmentCounts(linkToken, papers);
  const paper = pickBalancedLinkPaper(papers, counts);
  if (!paper) return null;
  return toAssignment(paper, linkData);
}
