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

export function findLinkPaper(papers, paperExamId) {
  if (!paperExamId) return papers[0] || null;
  return papers.find((p) => p.id === paperExamId || p.examId === paperExamId) || papers[0] || null;
}

export function pickRandomLinkPaper(papers) {
  if (!papers?.length) return null;
  return papers[Math.floor(Math.random() * papers.length)];
}

export function buildInterviewJoinUrl(linkId, origin) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/interview/join/${encodeURIComponent(linkId)}`;
}

export function qrCodeImageUrl(text, size = 240) {
  const data = encodeURIComponent(String(text || ""));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}&margin=8`;
}
