/**
 * Question papers for interview exam links.
 * Each selected exam in a link is one question paper (full exam document).
 */

/** Normalize paper exam ids from a link document (new + legacy). */
export function getLinkPaperExamIds(linkData) {
  if (!linkData) return [];
  const fromArray = Array.isArray(linkData.paperExamIds)
    ? linkData.paperExamIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  if (fromArray.length > 0) return [...new Set(fromArray)];
  const legacy = String(linkData.examId || "").trim();
  return legacy ? [legacy] : [];
}

/** Build paper list from link + optional exam docs (id, title, questions). */
export function getLinkQuestionPapers(linkData, examDocs = []) {
  const ids = getLinkPaperExamIds(linkData);
  const byId = new Map((examDocs || []).map((ex) => [ex.id, ex]));

  const titles = Array.isArray(linkData?.paperExamTitles) ? linkData.paperExamTitles : [];

  return ids.map((examId, i) => {
    const ex = byId.get(examId);
    const name =
      String(ex?.title || titles[i] || "").trim() || `Exam ${i + 1}`;
    const questions = Array.isArray(ex?.questions) ? ex.questions : [];
    return {
      id: examId,
      examId,
      name,
      questions,
    };
  });
}

/** Unbiased random index using crypto when available. */
export function secureRandomInt(max) {
  const n = Number(max);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n === 1) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bucket = new Uint32Array(1);
    crypto.getRandomValues(bucket);
    return bucket[0] % n;
  }
  return Math.floor(Math.random() * n);
}

export function pickCryptographicRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[secureRandomInt(items.length)];
}

export function pickRandomLinkPaper(papers) {
  return pickCryptographicRandom(papers);
}

/**
 * Prefer papers with the fewest prior assignments for this link (load balancing).
 * Ties are broken with cryptographic random.
 */
export function pickBalancedLinkPaper(papers, assignmentCounts = {}) {
  if (!papers?.length) return null;
  if (papers.length === 1) return papers[0];

  let minCount = Infinity;
  for (const paper of papers) {
    const id = paper.examId || paper.id;
    const count = Number(assignmentCounts[id]) || 0;
    if (count < minCount) minCount = count;
  }

  const candidates = papers.filter((paper) => {
    const id = paper.examId || paper.id;
    return (Number(assignmentCounts[id]) || 0) === minCount;
  });

  return pickCryptographicRandom(candidates);
}

export function findLinkPaper(papers, paperExamId) {
  if (!paperExamId) return papers[0] || null;
  return papers.find((p) => p.id === paperExamId || p.examId === paperExamId) || papers[0] || null;
}

export function buildInterviewJoinUrl(linkId, origin) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/interview/join/${encodeURIComponent(linkId)}`;
}

export function qrCodeImageUrl(text, size = 240) {
  const data = encodeURIComponent(String(text || ""));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}&margin=8`;
}
