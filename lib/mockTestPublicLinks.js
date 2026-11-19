import { mcqDb } from "./firebaseMCQs";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { fetchMockTest, fetchMockTestSubmissions } from "./mockTests";
import { qrCodeImageUrl } from "./interviewExamPapers";

/** Single selected test → open that paper directly. */
export const MOCK_PUBLIC_MODE_DIRECT = "direct";
/** Multiple tests → each candidate gets one random paper from the selection. */
export const MOCK_PUBLIC_MODE_RANDOM = "random";
/** Multiple tests → candidate takes every paper one by one in saved order. */
export const MOCK_PUBLIC_MODE_SEQUENTIAL = "sequential";

export function getMockPublicLinkMode(linkData) {
  const mode = String(linkData?.mode || "").trim();
  if (mode === MOCK_PUBLIC_MODE_SEQUENTIAL) return MOCK_PUBLIC_MODE_SEQUENTIAL;
  if (mode === MOCK_PUBLIC_MODE_DIRECT) return MOCK_PUBLIC_MODE_DIRECT;
  return MOCK_PUBLIC_MODE_RANDOM;
}

export function normalizeMockPublicPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function buildMockPublicJoinUrl(linkId, origin) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/mock-test/public/${encodeURIComponent(linkId)}`;
}

export { qrCodeImageUrl };

function newLinkId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchMockPublicLinks(companySlug) {
  if (!companySlug) return [];
  const snap = await getDocs(collection(mcqDb, "mockTestPublicLinks"));
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => l.companySlug === companySlug);
  list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return list;
}

export async function fetchMockPublicLink(linkId) {
  if (!linkId) return null;
  const snap = await getDoc(doc(mcqDb, "mockTestPublicLinks", linkId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createMockPublicLink({
  companySlug,
  label = "",
  testIds = [],
  testTitles = [],
  mode,
}) {
  const ids = (Array.isArray(testIds) ? testIds : []).map(String).filter(Boolean);
  if (!companySlug) throw new Error("Company is required.");
  if (!ids.length) throw new Error("Select at least one test.");

  let resolvedMode = mode;
  if (ids.length === 1) {
    resolvedMode = MOCK_PUBLIC_MODE_DIRECT;
  } else if (
    resolvedMode !== MOCK_PUBLIC_MODE_RANDOM &&
    resolvedMode !== MOCK_PUBLIC_MODE_SEQUENTIAL
  ) {
    throw new Error("Choose random or one-by-one for multiple tests.");
  }

  const linkId = newLinkId();
  const payload = {
    companySlug: String(companySlug),
    label: String(label || "").trim(),
    testIds: ids,
    testTitles: (Array.isArray(testTitles) ? testTitles : []).map(String),
    mode: resolvedMode,
    active: true,
    createdAt: Date.now(),
  };
  await setDoc(doc(mcqDb, "mockTestPublicLinks", linkId), payload);
  return { id: linkId, ...payload };
}

export async function updateMockPublicLink(linkId, patch) {
  if (!linkId) throw new Error("Link id is required.");
  const data = { updatedAt: Date.now() };
  if (patch.active != null) data.active = Boolean(patch.active);
  if (patch.label != null) data.label = String(patch.label).trim();
  await updateDoc(doc(mcqDb, "mockTestPublicLinks", linkId), data);
}

export async function deleteMockPublicLink(linkId) {
  if (!linkId) return;
  try {
    const assigns = await getDocs(
      collection(mcqDb, "mockTestPublicLinks", linkId, "assignments")
    );
    await Promise.all(assigns.docs.map((d) => deleteDoc(d.ref)));
  } catch (e) {
    console.warn("Failed to delete public link assignments:", e);
  }
  await deleteDoc(doc(mcqDb, "mockTestPublicLinks", linkId));
}

function sessionKey(linkId) {
  return `mock-public-session:${linkId}`;
}

export function readMockPublicSession(linkId) {
  if (typeof window === "undefined" || !linkId) return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(linkId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeMockPublicSession(linkId, data) {
  if (typeof window === "undefined" || !linkId) return;
  sessionStorage.setItem(sessionKey(linkId), JSON.stringify(data));
}

export function clearMockPublicSession(linkId) {
  if (typeof window === "undefined" || !linkId) return;
  sessionStorage.removeItem(sessionKey(linkId));
}

function assignmentRef(linkId, phone) {
  return doc(
    mcqDb,
    "mockTestPublicLinks",
    linkId,
    "assignments",
    normalizeMockPublicPhone(phone)
  );
}

async function readAssignment(linkId, phone) {
  const snap = await getDoc(assignmentRef(linkId, phone));
  if (!snap.exists()) return null;
  return snap.data();
}

async function writeAssignment(linkId, phone, data) {
  await setDoc(
    assignmentRef(linkId, phone),
    {
      phone: normalizeMockPublicPhone(phone),
      ...data,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

async function phoneHasSubmittedTest(companySlug, testId, phone) {
  const digits = normalizeMockPublicPhone(phone);
  if (!digits) return false;
  const subs = await fetchMockTestSubmissions(companySlug, testId);
  return subs.some((s) => {
    const p = normalizeMockPublicPhone(s.phone || s.userId);
    return p === digits;
  });
}

function pickRandomId(ids) {
  const list = ids.filter(Boolean);
  if (!list.length) return null;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return list[buf[0] % list.length];
  }
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Resolve which test(s) this candidate should take for a public link.
 * Returns:
 *  - { allDone, totalSteps, linkLabel } when sequential is finished
 *  - { testId, testTitle, mode, step, totalSteps, companySlug, linkLabel }
 */
export async function resolveMockPublicAssignment({ linkId, phone }) {
  const digits = normalizeMockPublicPhone(phone);
  if (!linkId || digits.length < 10) return null;

  const link = await fetchMockPublicLink(linkId);
  if (!link || link.active === false) return null;

  const testIds = (Array.isArray(link.testIds) ? link.testIds : []).map(String).filter(Boolean);
  if (!testIds.length) return null;

  const mode = getMockPublicLinkMode(link);
  const companySlug = link.companySlug;
  const titles = Array.isArray(link.testTitles) ? link.testTitles : [];
  const titleFor = (id, i) => {
    const idx = testIds.indexOf(id);
    return titles[idx >= 0 ? idx : i] || "Mock Test";
  };

  if (mode === MOCK_PUBLIC_MODE_SEQUENTIAL) {
    for (let i = 0; i < testIds.length; i += 1) {
      const testId = testIds[i];
      const done = await phoneHasSubmittedTest(companySlug, testId, digits);
      if (!done) {
        return {
          companySlug,
          testId,
          testTitle: titleFor(testId, i),
          mode,
          step: i + 1,
          totalSteps: testIds.length,
          linkLabel: String(link.label || "").trim(),
          linkId,
        };
      }
    }
    return {
      allDone: true,
      totalSteps: testIds.length,
      linkLabel: String(link.label || "").trim(),
      companySlug,
      linkId,
    };
  }

  // direct or random — one stable paper per phone
  const existing = await readAssignment(linkId, digits);
  if (existing?.testId && testIds.includes(String(existing.testId))) {
    return {
      companySlug,
      testId: String(existing.testId),
      testTitle: String(existing.testTitle || titleFor(existing.testId, 0)),
      mode,
      step: 1,
      totalSteps: 1,
      linkLabel: String(link.label || "").trim(),
      linkId,
    };
  }

  const chosen =
    mode === MOCK_PUBLIC_MODE_DIRECT ? testIds[0] : pickRandomId(testIds);
  if (!chosen) return null;

  // Prefer papers that still have questions
  let testId = chosen;
  if (mode === MOCK_PUBLIC_MODE_RANDOM) {
    const withQuestions = [];
    for (const id of testIds) {
      const t = await fetchMockTest(companySlug, id);
      if ((t?.questions || []).length > 0) withQuestions.push(id);
    }
    testId = pickRandomId(withQuestions.length ? withQuestions : testIds);
  }

  const assignment = {
    testId,
    testTitle: titleFor(testId, testIds.indexOf(testId)),
    mode,
    assignedAt: Date.now(),
    linkLabel: String(link.label || "").trim(),
  };
  await writeAssignment(linkId, digits, assignment);

  return {
    companySlug,
    testId,
    testTitle: assignment.testTitle,
    mode,
    step: 1,
    totalSteps: 1,
    linkLabel: assignment.linkLabel,
    linkId,
  };
}

export function buildMockPublicExamUrl({ companySlug, testId, linkId, origin }) {
  const base = String(origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(
    /\/$/,
    ""
  );
  const qs = new URLSearchParams({ public: "1", link: String(linkId || "") });
  return `${base}/mock-test/${encodeURIComponent(companySlug)}/${encodeURIComponent(testId)}?${qs.toString()}`;
}
