/**
 * Persist in-progress mock test answers so a locked attempt can resume
 * after admin unlock (same browser). Also mirrored onto the Firestore
 * block document when the account is locked.
 */

function storageKey(companySlug, testId, candidateId) {
  return `mock-test-progress:${String(companySlug || "").trim()}:${String(testId || "").trim()}:${String(candidateId || "").trim()}`;
}

export function buildMockTestProgressSnapshot({
  companySlug,
  testId,
  candidateId,
  answers = {},
  visited = {},
  reviewMap = {},
  codeLanguages = {},
  activeSection = "General",
  activeSubSection = "General",
  activeIndex = 0,
  questionShuffleRank = {},
  tabSwitchCount = 0,
  timeLeftMs = null,
  scopeTimeLeftMs = null,
  scopeKey = "",
  instructionsStep = 2,
} = {}) {
  return {
    version: 1,
    companySlug: String(companySlug || "").trim(),
    testId: String(testId || "").trim(),
    candidateId: String(candidateId || "").trim(),
    answers: answers && typeof answers === "object" ? answers : {},
    visited: visited && typeof visited === "object" ? visited : {},
    reviewMap: reviewMap && typeof reviewMap === "object" ? reviewMap : {},
    codeLanguages:
      codeLanguages && typeof codeLanguages === "object" ? codeLanguages : {},
    activeSection: String(activeSection || "General").trim() || "General",
    activeSubSection: String(activeSubSection || "General").trim() || "General",
    activeIndex: Number(activeIndex) || 0,
    questionShuffleRank:
      questionShuffleRank && typeof questionShuffleRank === "object"
        ? questionShuffleRank
        : {},
    tabSwitchCount: Math.max(0, Math.min(3, Number(tabSwitchCount) || 0)),
    timeLeftMs: timeLeftMs == null ? null : Math.max(0, Number(timeLeftMs) || 0),
    scopeTimeLeftMs:
      scopeTimeLeftMs == null ? null : Math.max(0, Number(scopeTimeLeftMs) || 0),
    scopeKey: String(scopeKey || "").trim(),
    instructionsStep: Number(instructionsStep) === 1 ? 1 : 2,
    updatedAt: Date.now(),
  };
}

export function saveMockTestProgress(companySlug, testId, candidateId, progress) {
  if (typeof window === "undefined") return false;
  const key = storageKey(companySlug, testId, candidateId);
  if (!key.endsWith(":") && !String(candidateId || "").trim()) return false;
  if (!String(companySlug || "").trim() || !String(testId || "").trim()) return false;
  if (!String(candidateId || "").trim()) return false;
  try {
    const payload =
      progress && typeof progress === "object"
        ? { ...progress, updatedAt: Date.now() }
        : null;
    if (!payload) return false;
    sessionStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function readMockTestProgress(companySlug, testId, candidateId) {
  if (typeof window === "undefined") return null;
  if (
    !String(companySlug || "").trim() ||
    !String(testId || "").trim() ||
    !String(candidateId || "").trim()
  ) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(storageKey(companySlug, testId, candidateId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (String(data.testId || "") !== String(testId)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearMockTestProgress(companySlug, testId, candidateId) {
  if (typeof window === "undefined") return;
  if (
    !String(companySlug || "").trim() ||
    !String(testId || "").trim() ||
    !String(candidateId || "").trim()
  ) {
    return;
  }
  try {
    sessionStorage.removeItem(storageKey(companySlug, testId, candidateId));
  } catch {
    /* ignore */
  }
}

/** Prefer local snapshot; fall back to progress stored on a block/unlock doc. */
export function pickResumeProgress(localProgress, blockDoc) {
  const fromBlock =
    blockDoc?.progress && typeof blockDoc.progress === "object"
      ? blockDoc.progress
      : null;
  if (!localProgress && !fromBlock) return null;
  if (!localProgress) return fromBlock;
  if (!fromBlock) return localProgress;
  const localTs = Number(localProgress.updatedAt) || 0;
  const blockTs = Number(fromBlock.updatedAt) || 0;
  return blockTs > localTs ? fromBlock : localProgress;
}
