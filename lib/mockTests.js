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
  await updateDoc(ref, data);
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
  await setDoc(
    ref,
    {
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
    },
    { merge: true }
  );
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
  (Array.isArray(questions) ? questions : []).forEach((q) => {
    const qType = q?.type === "coding" ? "coding" : "mcq";
    if (qType !== type) return;
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
