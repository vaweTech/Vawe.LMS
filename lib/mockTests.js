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
  await updateDoc(ref, data);
}

export async function deleteMockTest(companySlug, testId) {
  if (!companySlug || !testId) return;
  await deleteDoc(doc(mcqDb, "mockTests", companySlug, "tests", testId));
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
