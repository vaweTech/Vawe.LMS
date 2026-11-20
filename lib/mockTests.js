import { mcqDb } from "./firebaseMCQs";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";

export function normalizeMockTestSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function slugFromMockTestLabel(label) {
  return normalizeMockTestSlug(label);
}

export async function fetchMockTestGroups() {
  const snap = await getDocs(collection(mcqDb, "mockTests"));
  const groups = snap.docs.map((d) => ({
    id: d.id,
    slug: d.id,
    ...d.data(),
  }));
  groups.sort((a, b) => {
    const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.label || a.slug || "").localeCompare(String(b.label || b.slug || ""));
  });
  return groups;
}

export function getMockTestCompany(slug, groups = []) {
  return groups.find((c) => c.slug === slug || c.id === slug) || null;
}

export function getMockTestCompanyLabel(slug, groups = []) {
  return getMockTestCompany(slug, groups)?.label || slug.replace(/_/g, " ").toUpperCase();
}

export async function fetchMockTestGroup(slug) {
  if (!slug) return null;
  const ref = doc(mcqDb, "mockTests", slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, slug: snap.id, ...snap.data() };
}

export async function ensureMockTestGroupExists(slug, label) {
  const normalizedSlug = normalizeMockTestSlug(slug);
  if (!normalizedSlug) throw new Error("Group slug is required.");
  const ref = doc(mcqDb, "mockTests", normalizedSlug);
  const snap = await getDoc(ref);
  if (snap.exists()) return normalizedSlug;
  await setDoc(ref, {
    slug: normalizedSlug,
    label: String(label || normalizedSlug.replace(/_/g, " ").toUpperCase()).trim(),
    order: 0,
    locked: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return normalizedSlug;
}
export async function createMockTestGroup({ slug, label, order = 0 }) {
  const normalizedSlug = normalizeMockTestSlug(slug);
  if (!normalizedSlug) throw new Error("Group slug is required.");
  if (!String(label || "").trim()) throw new Error("Group name is required.");

  const ref = doc(mcqDb, "mockTests", normalizedSlug);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("A group with this slug already exists.");

  await setDoc(ref, {
    slug: normalizedSlug,
    label: String(label).trim(),
    order: Number(order) || 0,
    locked: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return normalizedSlug;
}

export async function updateMockTestGroup(slug, patch) {
  if (!slug) throw new Error("Group slug is required.");
  const ref = doc(mcqDb, "mockTests", slug);
  const data = { updatedAt: new Date().toISOString() };
  if (patch.label != null) data.label = String(patch.label).trim();
  if (patch.order != null) data.order = Number(patch.order) || 0;
  if (patch.locked != null) data.locked = Boolean(patch.locked);
  await updateDoc(ref, data);
}

export async function deleteMockTestGroup(slug) {
  if (!slug) return;
  const tests = await fetchMockTestsForCompany(slug);
  await Promise.all(tests.map((test) => deleteMockTest(slug, test.id)));
  await deleteDoc(doc(mcqDb, "mockTests", slug));
}

export async function fetchMockTestsForCompany(companySlug) {
  if (!companySlug) return [];
  const snap = await getDocs(collection(mcqDb, "mockTests", companySlug, "tests"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  return list;
}

export async function fetchMockTest(companySlug, testId) {
  if (!companySlug || !testId) return null;
  const ref = doc(mcqDb, "mockTests", companySlug, "tests", testId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createMockTest(companySlug, data) {
  if (!companySlug) throw new Error("Company group is required.");
  await ensureMockTestGroupExists(companySlug, getMockTestCompanyLabel(companySlug));
  const ref = collection(mcqDb, "mockTests", companySlug, "tests");
  const docRef = await addDoc(ref, {
    title: String(data.title || "Mock Test").trim(),
    order: Number(data.order) || 1,
    durationMinutes: Number(data.durationMinutes) || 60,
    questions: Array.isArray(data.questions) ? data.questions : [],
    locked: data.locked != null ? Boolean(data.locked) : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updateMockTest(companySlug, testId, patch) {
  if (!companySlug || !testId) throw new Error("Test id is required.");
  const ref = doc(mcqDb, "mockTests", companySlug, "tests", testId);
  const data = { updatedAt: new Date().toISOString() };
  if (patch.title != null) data.title = String(patch.title).trim();
  if (patch.order != null) data.order = Number(patch.order) || 1;
  if (patch.durationMinutes != null) {
    data.durationMinutes = Number(patch.durationMinutes) || 0;
  }
  if (patch.questions != null) data.questions = patch.questions;
  if (patch.locked != null) data.locked = Boolean(patch.locked);
  if (patch.sectionTimings != null) data.sectionTimings = normalizeMockSectionTimings(patch.sectionTimings);
  if (patch.subSectionTimings != null) {
    data.subSectionTimings = normalizeMockSubSectionTimings(patch.subSectionTimings);
  }
  await updateDoc(ref, data);
}

export function mockSubSectionTimingKey(section, subSection) {
  const sec = String(section || "").trim() || "General";
  const sub = String(subSection || "").trim() || "General";
  return `${sec}||${sub}`;
}

export function normalizeMockSectionTimings(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  Object.entries(raw).forEach(([section, minutes]) => {
    const name = String(section || "").trim();
    const mins = Math.max(0, Number(minutes) || 0);
    if (name && mins > 0) out[name] = mins;
  });
  return out;
}

export function normalizeMockSubSectionTimings(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  Object.entries(raw).forEach(([key, minutes]) => {
    const k = String(key || "").trim();
    const mins = Math.max(0, Number(minutes) || 0);
    if (k && mins > 0) out[k] = mins;
  });
  return out;
}

/** Sum of sub-section minutes for one section (optionally limited to known sub names). */
export function sumMockSubSectionTimingsForSection(
  section,
  subSectionTimings,
  subSectionNames = null
) {
  const sec = String(section || "").trim();
  if (!sec) return 0;
  const subs = normalizeMockSubSectionTimings(subSectionTimings);
  if (Array.isArray(subSectionNames) && subSectionNames.length) {
    return subSectionNames.reduce((sum, sub) => {
      const key = mockSubSectionTimingKey(sec, sub);
      return sum + (Number(subs[key]) || 0);
    }, 0);
  }
  const prefix = `${sec}||`;
  return Object.entries(subs).reduce((sum, [key, mins]) => {
    if (String(key).startsWith(prefix)) return sum + (Number(mins) || 0);
    return sum;
  }, 0);
}

/**
 * Keep section minutes equal to the total of its sub-section minutes
 * whenever any sub-section timing is set for that section.
 */
export function syncSectionTimingsFromSubSections(
  sectionTimings,
  subSectionTimings,
  sectionToSubs = {}
) {
  const sections = { ...normalizeMockSectionTimings(sectionTimings) };
  const subs = normalizeMockSubSectionTimings(subSectionTimings);
  const sectionNames = new Set([
    ...Object.keys(sections),
    ...Object.keys(sectionToSubs || {}),
    ...Object.keys(subs).map((k) => String(k).split("||")[0]).filter(Boolean),
  ]);

  sectionNames.forEach((sec) => {
    const knownSubs = Array.isArray(sectionToSubs?.[sec]) ? sectionToSubs[sec] : null;
    const sum = sumMockSubSectionTimingsForSection(sec, subs, knownSubs);
    if (sum > 0) sections[sec] = sum;
  });

  return normalizeMockSectionTimings(sections);
}

/** True when admin set at least one section or sub-section duration. */
export function hasMockSectionBasedTiming(test) {
  const sections = normalizeMockSectionTimings(test?.sectionTimings);
  const subs = normalizeMockSubSectionTimings(test?.subSectionTimings);
  return Object.keys(sections).length > 0 || Object.keys(subs).length > 0;
}

/**
 * Resolve timer for the active scope.
 * - Sub-section minutes win when the current section has any sub-section timings.
 * - Otherwise use section minutes.
 * - Returns { minutes: 0, mode: "none" } → fall back to overall test duration.
 */
export function getMockScopeTiming({
  section,
  subSection = "",
  subSectionsInSection = [],
  sectionTimings = {},
  subSectionTimings = {},
} = {}) {
  const sec = String(section || "").trim() || "General";
  const sections = normalizeMockSectionTimings(sectionTimings);
  const subs = normalizeMockSubSectionTimings(subSectionTimings);
  const sectionHasSubTimings = Object.keys(subs).some((k) => k.startsWith(`${sec}||`));

  if (sectionHasSubTimings && Array.isArray(subSectionsInSection) && subSectionsInSection.length > 0) {
    const sub = String(subSection || "").trim() || subSectionsInSection[0] || "General";
    const key = mockSubSectionTimingKey(sec, sub);
    const minutes = Number(subs[key]) || 0;
    return { minutes, mode: "subsection", section: sec, subSection: sub, key };
  }

  const minutes = Number(sections[sec]) || 0;
  if (minutes > 0) {
    return { minutes, mode: "section", section: sec, subSection: "", key: sec };
  }
  return { minutes: 0, mode: "none", section: sec, subSection: "", key: "" };
}

export function isMockTestLocked(test, group) {
  if (group?.locked === true) return true;
  if (test?.locked === false && group?.locked !== true) return false;
  return true;
}

export async function deleteMockTest(companySlug, testId) {
  if (!companySlug || !testId) return;
  try {
    const [subs, blocks] = await Promise.all([
      getDocs(collection(mcqDb, "mockTests", companySlug, "tests", testId, "submissions")),
      getDocs(collection(mcqDb, "mockTests", companySlug, "tests", testId, "blocks")),
    ]);
    await Promise.all([
      ...subs.docs.map((d) => deleteDoc(d.ref)),
      ...blocks.docs.map((d) => deleteDoc(d.ref)),
    ]);
  } catch (e) {
    console.warn("Failed to delete mock test submissions:", e);
  }
  await deleteDoc(doc(mcqDb, "mockTests", companySlug, "tests", testId));
}

export function mockTestAttemptPercent({
  mcqCorrect = 0,
  mcqTotal = 0,
  codingScore = 0,
  codingMax = 0,
} = {}) {
  const earned = Number(mcqCorrect) + Number(codingScore);
  const max = Number(mcqTotal) + Number(codingMax);
  if (max <= 0) return 0;
  return Math.round((earned / max) * 100);
}

export function buildMockSectionScores(questionBreakdown = []) {
  const map = {};
  (Array.isArray(questionBreakdown) ? questionBreakdown : []).forEach((q) => {
    const name = String(q?.section || "General").trim() || "General";
    if (!map[name]) {
      map[name] = {
        section: name,
        correct: 0,
        total: 0,
        codingEarned: 0,
        codingMax: 0,
        earned: 0,
        max: 0,
        percent: 0,
      };
    }
    if (q?.type === "coding") {
      map[name].codingMax += Number(q.maxScore) || 0;
      map[name].codingEarned += Number(q.score) || 0;
    } else {
      map[name].total += 1;
      if (q?.correct) map[name].correct += 1;
    }
  });
  Object.values(map).forEach((s) => {
    s.earned = (Number(s.correct) || 0) + (Number(s.codingEarned) || 0);
    s.max = (Number(s.total) || 0) + (Number(s.codingMax) || 0);
    s.percent = s.max > 0 ? Math.round((s.earned / s.max) * 100) : 0;
  });
  return map;
}

export function normalizeMockSectionScores(raw, questionBreakdown = []) {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length) {
    const map = {};
    Object.entries(raw).forEach(([key, value]) => {
      const s = value && typeof value === "object" ? value : {};
      const section = String(s.section || key || "General").trim() || "General";
      const correct = Number(s.correct) || 0;
      const total = Number(s.total) || 0;
      const codingEarned = Number(s.codingEarned) || 0;
      const codingMax = Number(s.codingMax) || 0;
      const earned =
        s.earned != null ? Number(s.earned) || 0 : correct + codingEarned;
      const max = s.max != null ? Number(s.max) || 0 : total + codingMax;
      map[section] = {
        section,
        correct,
        total,
        codingEarned,
        codingMax,
        earned,
        max,
        percent:
          s.percent != null
            ? Number(s.percent) || 0
            : max > 0
              ? Math.round((earned / max) * 100)
              : 0,
      };
    });
    return map;
  }
  return buildMockSectionScores(questionBreakdown);
}

export function mockSubSectionScoreKey(section, subSection) {
  const sec = String(section || "General").trim() || "General";
  const sub = String(subSection || "General").trim() || "General";
  return `${sec}|||${sub}`;
}

export function mockSubSectionScoreLabel(section, subSection) {
  const sec = String(section || "General").trim() || "General";
  const sub = String(subSection || "General").trim() || "General";
  return sub === "General" || sub === sec ? sec : `${sec} › ${sub}`;
}

export function buildMockSubSectionScores(questionBreakdown = []) {
  const map = {};
  (Array.isArray(questionBreakdown) ? questionBreakdown : []).forEach((q) => {
    const section = String(q?.section || "General").trim() || "General";
    const subSection = String(q?.subSection || q?.subsection || "General").trim() || "General";
    const key = mockSubSectionScoreKey(section, subSection);
    if (!map[key]) {
      map[key] = {
        key,
        section,
        subSection,
        label: mockSubSectionScoreLabel(section, subSection),
        correct: 0,
        total: 0,
        codingEarned: 0,
        codingMax: 0,
        earned: 0,
        max: 0,
        percent: 0,
      };
    }
    if (q?.type === "coding") {
      map[key].codingMax += Number(q.maxScore) || 0;
      map[key].codingEarned += Number(q.score) || 0;
    } else {
      map[key].total += 1;
      if (q?.correct) map[key].correct += 1;
    }
  });
  Object.values(map).forEach((s) => {
    s.earned = (Number(s.correct) || 0) + (Number(s.codingEarned) || 0);
    s.max = (Number(s.total) || 0) + (Number(s.codingMax) || 0);
    s.percent = s.max > 0 ? Math.round((s.earned / s.max) * 100) : 0;
  });
  return map;
}

export function normalizeMockSubSectionScores(raw, questionBreakdown = []) {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length) {
    const map = {};
    Object.entries(raw).forEach(([key, value]) => {
      const s = value && typeof value === "object" ? value : {};
      const section = String(s.section || "General").trim() || "General";
      const subSection = String(s.subSection || s.subsection || "General").trim() || "General";
      const scoreKey = String(s.key || key || mockSubSectionScoreKey(section, subSection));
      const correct = Number(s.correct) || 0;
      const total = Number(s.total) || 0;
      const codingEarned = Number(s.codingEarned) || 0;
      const codingMax = Number(s.codingMax) || 0;
      const earned =
        s.earned != null ? Number(s.earned) || 0 : correct + codingEarned;
      const max = s.max != null ? Number(s.max) || 0 : total + codingMax;
      map[scoreKey] = {
        key: scoreKey,
        section,
        subSection,
        label: String(s.label || mockSubSectionScoreLabel(section, subSection)),
        correct,
        total,
        codingEarned,
        codingMax,
        earned,
        max,
        percent:
          s.percent != null
            ? Number(s.percent) || 0
            : max > 0
              ? Math.round((earned / max) * 100)
              : 0,
      };
    });
    return map;
  }
  return buildMockSubSectionScores(questionBreakdown);
}

export async function saveMockTestSubmission(companySlug, testId, payload) {
  const userId = String(payload?.userId || "").trim();
  if (!companySlug || !testId || !userId) {
    throw new Error("Company, test, and user are required to save a result.");
  }
  const percent = mockTestAttemptPercent(payload);
  const questionBreakdown = Array.isArray(payload.questionBreakdown)
    ? payload.questionBreakdown
    : [];
  const sectionScores = normalizeMockSectionScores(payload.sectionScores, questionBreakdown);
  const subSectionScores = normalizeMockSubSectionScores(
    payload.subSectionScores,
    questionBreakdown
  );
  const ref = doc(mcqDb, "mockTests", companySlug, "tests", testId, "submissions", userId);
  const data = {
    userId,
    name: String(payload.name || "").trim(),
    email: String(payload.email || "").trim(),
    mcqCorrect: Number(payload.mcqCorrect) || 0,
    mcqTotal: Number(payload.mcqTotal) || 0,
    mcqAnswered: Number(payload.mcqAnswered) || 0,
    codingScore: Number(payload.codingScore) || 0,
    codingMax: Number(payload.codingMax) || 0,
    codingAttempted: Number(payload.codingAttempted) || 0,
    percent,
    sectionScores,
    subSectionScores,
    questionBreakdown,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (payload.phone != null) data.phone = String(payload.phone || "").trim();
  if (payload.college != null) data.college = String(payload.college || "").trim();
  if (payload.branch != null) data.branch = String(payload.branch || "").trim();
  if (payload.source != null) data.source = String(payload.source || "").trim();
  if (payload.publicLinkId != null) {
    data.publicLinkId = String(payload.publicLinkId || "").trim();
  }
  await setDoc(ref, data, { merge: true });
}

export async function fetchMockTestSubmissions(companySlug, testId) {
  if (!companySlug || !testId) return [];
  const snap = await getDocs(
    collection(mcqDb, "mockTests", companySlug, "tests", testId, "submissions")
  );
  return snap.docs.map((d) => ({ id: d.id, testId, ...d.data() }));
}

export async function fetchMockTestGroupSubmissions(companySlug) {
  const tests = await fetchMockTestsForCompany(companySlug);
  const nested = await Promise.all(
    tests.map(async (test) => {
      const rows = await fetchMockTestSubmissions(companySlug, test.id);
      return rows.map((row) => ({
        ...row,
        testTitle: test.title || test.id,
      }));
    })
  );
  const submissions = nested.flat();
  submissions.sort((a, b) =>
    String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""))
  );
  return { tests, submissions };
}

export async function deleteMockTestSubmission(companySlug, testId, submissionId) {
  const id = String(submissionId || "").trim();
  if (!companySlug || !testId || !id) {
    throw new Error("Company, test, and candidate are required to delete a result.");
  }
  await deleteDoc(doc(mcqDb, "mockTests", companySlug, "tests", testId, "submissions", id));
}

function mockTestBlockRef(companySlug, testId, userId) {
  return doc(mcqDb, "mockTests", companySlug, "tests", testId, "blocks", userId);
}

export async function fetchMockTestAccountBlock(companySlug, testId, userId) {
  const uid = String(userId || "").trim();
  if (!companySlug || !testId || !uid) return null;
  const snap = await getDoc(mockTestBlockRef(companySlug, testId, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, testId, ...snap.data() };
}

export function isMockTestAccountBlocked(block) {
  return Boolean(block && block.blocked === true);
}

export async function fetchMockTestBlocks(companySlug, testId) {
  if (!companySlug || !testId) return [];
  const snap = await getDocs(
    collection(mcqDb, "mockTests", companySlug, "tests", testId, "blocks")
  );
  return snap.docs
    .map((d) => ({ id: d.id, testId, ...d.data() }))
    .filter((row) => row.blocked === true)
    .sort((a, b) => String(b.blockedAt || "").localeCompare(String(a.blockedAt || "")));
}

export async function fetchMockTestGroupBlocks(companySlug) {
  const tests = await fetchMockTestsForCompany(companySlug);
  const nested = await Promise.all(
    tests.map(async (test) => {
      const rows = await fetchMockTestBlocks(companySlug, test.id);
      return rows.map((row) => ({
        ...row,
        testTitle: test.title || test.id,
      }));
    })
  );
  return nested.flat();
}

export async function blockMockTestAccount(companySlug, testId, payload = {}) {
  const userId = String(payload.userId || "").trim();
  if (!companySlug || !testId || !userId) {
    throw new Error("Company, test, and account are required to lock this exam.");
  }
  const now = new Date().toISOString();
  await setDoc(
    mockTestBlockRef(companySlug, testId, userId),
    {
      userId,
      name: String(payload.name || "").trim(),
      email: String(payload.email || "").trim(),
      blocked: true,
      reason: String(payload.reason || "Test blocked due to 3 tab switches").trim(),
      tabSwitchCount: Number(payload.tabSwitchCount) || 0,
      blockedAt: now,
      updatedAt: now,
      unblockedAt: null,
    },
    { merge: true }
  );
}

export async function unblockMockTestAccount(companySlug, testId, userId) {
  const uid = String(userId || "").trim();
  if (!companySlug || !testId || !uid) {
    throw new Error("Company, test, and account are required to unlock this exam.");
  }
  const now = new Date().toISOString();
  const ref = mockTestBlockRef(companySlug, testId, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, {
    blocked: false,
    unblockedAt: now,
    updatedAt: now,
  });
}

export async function deleteMockTestResultsForCandidate(companySlug, candidate) {
  const userId = String(candidate?.userId || candidate?.id || "").trim();
  const email = String(candidate?.email || "").trim().toLowerCase();
  if (!companySlug || (!userId && !email)) {
    throw new Error("Candidate is required to delete results.");
  }
  const { submissions } = await fetchMockTestGroupSubmissions(companySlug);
  const matches = submissions.filter((s) => {
    if (userId && (s.userId === userId || s.id === userId)) return true;
    if (email && String(s.email || "").trim().toLowerCase() === email) return true;
    return false;
  });
  await Promise.all(
    matches.map((s) => deleteMockTestSubmission(companySlug, s.testId, s.id || s.userId))
  );
  return matches.length;
}

export function normalizeMockQuestionOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (typeof opt === "string") return opt;
    if (opt && typeof opt === "object") return opt.text ?? opt.label ?? "";
    return String(opt ?? "");
  });
}

export function getMockQuestionCorrectAnswers(question) {
  if (!question || typeof question !== "object") return [];
  if (Array.isArray(question.correctAnswers) && question.correctAnswers.length) {
    return question.correctAnswers.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  }
  if (Array.isArray(question.answers) && question.answers.length) {
    const options = normalizeMockQuestionOptions(question.options);
    return question.answers
      .map((ans) => options.findIndex((o) => String(o).trim() === String(ans).trim()))
      .filter((i) => i >= 0);
  }
  if (question.answer != null && question.answer !== "") {
    const options = normalizeMockQuestionOptions(question.options);
    const idx = options.findIndex(
      (o) => String(o).trim().toLowerCase() === String(question.answer).trim().toLowerCase()
    );
    if (idx >= 0) return [idx];
    const n = Number(question.answer);
    if (Number.isFinite(n) && n >= 1 && n <= options.length) return [n - 1];
    if (Number.isFinite(n) && n >= 0 && n < options.length) return [n];
  }
  return [];
}

export function isMockAnswerCorrect(question, selectedIndex) {
  const correct = getMockQuestionCorrectAnswers(question);
  if (!correct.length) return false;
  return correct.includes(Number(selectedIndex));
}

export function normalizeMockCompanyNames(raw) {
  if (raw == null) return [];
  const out = [];
  const seen = new Set();
  const push = (t) => {
    const x = String(t || "").trim();
    if (!x) return;
    const k = x.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(x);
  };
  if (Array.isArray(raw)) {
    raw.forEach(push);
    return out;
  }
  String(raw)
    .split(/[,;|\n/]+/)
    .forEach(push);
  return out;
}

export function getMockQuestionSubSection(question) {
  return String(question?.subSection ?? question?.subsection ?? "").trim();
}

export function buildMockSectionMap(questions) {
  const map = {};
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const section = String(q?.section || "").trim();
    const subSection = getMockQuestionSubSection(q);
    if (!section) return;
    if (!map[section]) map[section] = new Set();
    if (subSection) map[section].add(subSection);
  });
  return Object.fromEntries(
    Object.entries(map).map(([section, subs]) => [section, Array.from(subs).sort()])
  );
}

export function getMockSubSectionsForSection(questions, type, section) {
  const set = new Set();
  let hasUnassigned = false;
  const wantAll = !type || type === "all";
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const qType = q?.type === "coding" ? "coding" : "mcq";
    if (!wantAll && qType !== type) return;
    const sec = String(q?.section || "").trim() || "General";
    if (sec !== section) return;
    const sub = getMockQuestionSubSection(q);
    if (sub) set.add(sub);
    else hasUnassigned = true;
  });
  const list = Array.from(set).sort((a, b) => a.localeCompare(b));
  if (hasUnassigned) list.unshift("General");
  return list;
}

function codingDifficultyRank(name) {
  const n = String(name || "").toLowerCase();
  if (/\beasy\b/.test(n)) return 0;
  if (/\bmedium\b/.test(n)) return 1;
  if (/\bhard\b|\bheard\b/.test(n)) return 2;
  return 3;
}

export function sectionHasOnlyCodingQuestions(questions, section) {
  const sec = String(section || "").trim() || "General";
  const list = (Array.isArray(questions) ? questions : []).filter(
    (q) => (String(q?.section || "").trim() || "General") === sec
  );
  return list.length > 0 && list.every((q) => q?.type === "coding");
}

export function subSectionHasOnlyCodingQuestions(questions, section, subSection) {
  const sec = String(section || "").trim() || "General";
  const sub = String(subSection || "").trim() || "General";
  const list = (Array.isArray(questions) ? questions : []).filter((q) => {
    if ((String(q?.section || "").trim() || "General") !== sec) return false;
    return (getMockQuestionSubSection(q) || "General") === sub;
  });
  return list.length > 0 && list.every((q) => q?.type === "coding");
}

/** Sections in exam order: MCQ / mixed first, coding-only sections last. */
export function orderMockSectionsForExam(questions) {
  const order = [];
  const seen = new Set();
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const sec = String(q?.section || "").trim() || "General";
    if (seen.has(sec)) return;
    seen.add(sec);
    order.push(sec);
  });
  const nonCoding = order.filter((sec) => !sectionHasOnlyCodingQuestions(questions, sec));
  const coding = order.filter((sec) => sectionHasOnlyCodingQuestions(questions, sec));
  return [...nonCoding, ...coding];
}

/**
 * Sub-sections in exam order: non-coding first, then coding Easy → Hard last.
 * Labels for coding-only subs: "Coding Easy", "Coding Hard".
 */
export function orderMockSubSectionsForExam(questions, section) {
  const list = getMockSubSectionsForSection(questions, "all", section);
  const nonCoding = [];
  const coding = [];
  list.forEach((sub) => {
    if (subSectionHasOnlyCodingQuestions(questions, section, sub)) coding.push(sub);
    else nonCoding.push(sub);
  });
  coding.sort((a, b) => {
    const d = codingDifficultyRank(a) - codingDifficultyRank(b);
    return d !== 0 ? d : a.localeCompare(b);
  });
  return [...nonCoding, ...coding];
}

export function formatMockSubSectionLabel(questions, section, subSection) {
  const sub = String(subSection || "").trim() || "General";
  if (!subSectionHasOnlyCodingQuestions(questions, section, sub)) return sub;
  if (/^coding\b/i.test(sub)) return sub;
  return `Coding ${sub}`;
}

/** Minutes for a full section (sub-section sum wins when set). */
export function getMockFullSectionMinutes(section, questions, sectionTimings, subSectionTimings) {
  const sec = String(section || "").trim() || "General";
  const subs = getMockSubSectionsForSection(questions, "all", sec);
  const subSum = sumMockSubSectionTimingsForSection(sec, subSectionTimings, subs);
  if (subSum > 0) return subSum;
  return Number(normalizeMockSectionTimings(sectionTimings)[sec]) || 0;
}

/**
 * Remaining ms until the end of the test under section / sub-section timing
 * (current scope left + all later scopes).
 */
export function getMockRemainingSectionBasedMs({
  questions,
  sectionsOrdered,
  activeSection,
  activeSubSection,
  sectionTimings,
  subSectionTimings,
  scopeTimeLeftMs,
} = {}) {
  let total = Math.max(0, Number(scopeTimeLeftMs) || 0);
  const sections = Array.isArray(sectionsOrdered) ? sectionsOrdered : [];
  const secIdx = sections.indexOf(activeSection);
  if (secIdx < 0) return total;

  const subsNow = orderMockSubSectionsForExam(questions, activeSection);
  const subIdx = subsNow.indexOf(activeSubSection);
  const normalizedSubs = normalizeMockSubSectionTimings(subSectionTimings);

  if (subsNow.length && subIdx >= 0) {
    for (let i = subIdx + 1; i < subsNow.length; i++) {
      const key = mockSubSectionTimingKey(activeSection, subsNow[i]);
      const mins = Number(normalizedSubs[key]) || 0;
      if (mins > 0) total += mins * 60 * 1000;
    }
  }

  for (let s = secIdx + 1; s < sections.length; s++) {
    const mins = getMockFullSectionMinutes(
      sections[s],
      questions,
      sectionTimings,
      subSectionTimings
    );
    if (mins > 0) total += mins * 60 * 1000;
  }

  return total;
}

export function createEmptyMockQuestion(section = "", subSection = "") {
  return {
    type: "mcq",
    section,
    subSection,
    question: "",
    description: "",
    options: ["", "", "", ""],
    correctAnswers: [],
    isMultiple: false,
    companyNames: [],
    questionImage: "",
  };
}

export function createEmptyMockCodingQuestion(section = "", subSection = "") {
  return {
    type: "coding",
    section,
    subSection,
    question: "",
    title: "",
    description: "",
    starterCode: "",
    language: "javascript",
    maxScore: 10,
    testCases: [{ input: "", output: "", hidden: false }],
    companyNames: [],
  };
}

export function summarizeMockTestQuestions(questions) {
  const list = Array.isArray(questions) ? questions : [];
  const mcq = list.filter((q) => (q?.type || "mcq") === "mcq").length;
  const coding = list.filter((q) => q?.type === "coding").length;
  const sections = new Set();
  list.forEach((q) => {
    const s = String(q?.section || "").trim();
    if (s) sections.add(s);
  });
  return {
    mcq,
    coding,
    total: list.length,
    sections: Array.from(sections),
  };
}

export function getMockSectionsByType(questions, type) {
  const set = new Set();
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const qType = q?.type === "coding" ? "coding" : "mcq";
    if (qType !== type) return;
    set.add(String(q?.section || "").trim() || "General");
  });
  return Array.from(set);
}

export function groupMockQuestionsBySection(questions, type) {
  const groups = {};
  (Array.isArray(questions) ? questions : []).forEach((q, index) => {
    const qType = q?.type === "coding" ? "coding" : "mcq";
    if (qType !== type) return;
    const section = String(q?.section || "").trim() || "General";
    if (!groups[section]) groups[section] = [];
    groups[section].push({ ...q, index });
  });
  return groups;
}

export const MOCK_JUDGE_LANGUAGES = {
  javascript: "javascript",
  python: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
};

export function transformMockCompilerInput(input) {
  return String(input || "")
    .split("\n")
    .map((line) =>
      line
        .replace(/\[/g, "")
        .replace(/\]/g, "")
        .replace(/,/g, " ")
        .replace(/#/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join("\n");
}

export function sanitizeMockQuestions(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((q) => {
      const type = q?.type === "coding" ? "coding" : "mcq";
      const section = String(q?.section || "").trim();
      const subSection = getMockQuestionSubSection(q);

      if (type === "coding") {
        const questionText = String(q?.question || q?.title || "").trim();
        if (!questionText) return null;
        const testCases = (Array.isArray(q?.testCases) ? q.testCases : [])
          .map((tc) => ({
            input: String(tc?.input ?? ""),
            output: String(tc?.output ?? ""),
            hidden: !!tc?.hidden,
          }))
          .filter((tc) => tc.input || tc.output);
        const companyNames = normalizeMockCompanyNames(q?.companyNames ?? q?.companyName);
        return {
          type: "coding",
          section,
          ...(subSection ? { subSection } : {}),
          question: questionText,
          title: questionText,
          description: String(q?.description || "").trim(),
          starterCode: String(q?.starterCode || "").trim(),
          language: String(q?.language || "javascript").trim(),
          maxScore: Number(q?.maxScore) || 10,
          testCases,
          ...(companyNames.length ? { companyNames } : {}),
        };
      }

      const options = normalizeMockQuestionOptions(q?.options);
      while (options.length < 4) options.push("");
      const correctAnswers = getMockQuestionCorrectAnswers({ ...q, options });
      const questionText = String(q?.question || "").trim();
      if (!questionText) return null;
      const companyNames = normalizeMockCompanyNames(q?.companyNames ?? q?.companyName);
      const questionImage = String(q?.questionImage || "").trim();
      return {
        type: "mcq",
        section,
        ...(subSection ? { subSection } : {}),
        question: questionText,
        description: String(q?.description || "").trim(),
        options: options.slice(0, 6),
        correctAnswers,
        isMultiple: correctAnswers.length > 1,
        ...(companyNames.length ? { companyNames } : {}),
        ...(questionImage ? { questionImage } : {}),
      };
    })
    .filter(Boolean);
}
