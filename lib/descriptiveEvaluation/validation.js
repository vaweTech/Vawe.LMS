import { MAX_ALIASES_PER_TERM, MAX_CRITERIA, MAX_PHRASE_LENGTH, round1 } from "./constants.js";

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

function asSynonymRows(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (typeof row === "string") {
        const term = row.trim();
        return term ? { term, aliases: [] } : null;
      }
      const term = String(row?.term || "").trim();
      if (!term) return null;
      const aliases = asStringArray(row?.aliases).slice(0, MAX_ALIASES_PER_TERM);
      return { term, aliases };
    })
    .filter(Boolean);
}

function asMisconceptions(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((row, i) => {
      const phrases = asStringArray(row?.phrases).filter((p) => p.length <= MAX_PHRASE_LENGTH);
      if (!phrases.length) return null;
      const penalty = Number(row?.penalty);
      return {
        id: String(row?.id || `mis-${i + 1}`),
        phrases,
        penalty: Number.isFinite(penalty) && penalty >= 0 ? penalty : null,
        allowNegation: row?.allowNegation !== false,
        criterionId: row?.criterionId ? String(row.criterionId) : null,
      };
    })
    .filter(Boolean);
}

export function emptyCriterion(index, marks) {
  const m = Number.isFinite(Number(marks)) && Number(marks) > 0 ? Number(marks) : 2;
  return {
    id: `c${index + 1}`,
    label: "",
    marks: m,
    mentionMarks: round1(m / 2),
    keywords: [],
    synonyms: [],
    requiredPhrases: [],
    alternativePhrases: [],
    optionalPhrases: [],
    explanationPhrases: [],
    requireExplanation: true,
    critical: false,
    misconceptions: [],
  };
}

export function emptyContentRubric() {
  return {
    version: 1,
    modelAnswer: "",
    contentWeight: null,
    writingWeight: null,
    synonyms: [],
    criteria: [],
    contradictions: [],
  };
}

/**
 * Validates and normalizes a question rubric. Never throws.
 * ok=false means content marks must stay 0 (do not award full marks).
 */
export function validateRubric(raw, questionMaxScore) {
  const errors = [];
  const max = Number(questionMaxScore);
  if (!Number.isFinite(max) || max <= 0) {
    return { ok: false, errors: ["Question maximum marks are missing or invalid."], rubric: emptyContentRubric() };
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["No content rubric configured."], rubric: emptyContentRubric() };
  }

  const criteriaIn = Array.isArray(raw.criteria) ? raw.criteria.slice(0, MAX_CRITERIA) : [];
  if (criteriaIn.length === 0) {
    return { ok: false, errors: ["Rubric has no criteria."], rubric: { ...emptyContentRubric(), version: Number(raw.version) || 1, modelAnswer: String(raw.modelAnswer || "") } };
  }

  const seenIds = new Set();
  const criteria = [];
  criteriaIn.forEach((c, i) => {
    const id = String(c?.id || `c${i + 1}`).trim() || `c${i + 1}`;
    if (seenIds.has(id)) errors.push(`Duplicate criterion id "${id}".`);
    seenIds.add(id);
    const marks = Number(c?.marks);
    if (!Number.isFinite(marks) || marks <= 0) {
      errors.push(`Criterion ${id}: marks must be a positive number.`);
      return;
    }
    let mentionMarks = Number(c?.mentionMarks);
    if (!Number.isFinite(mentionMarks) || mentionMarks < 0) mentionMarks = round1(marks / 2);
    if (mentionMarks > marks) mentionMarks = marks;
    const keywords = asStringArray(c?.keywords);
    const alternativePhrases = asStringArray(c?.alternativePhrases);
    const explanationPhrases = asStringArray(c?.explanationPhrases);
    const requiredPhrases = asStringArray(c?.requiredPhrases);
    if (
      keywords.length === 0 &&
      alternativePhrases.length === 0 &&
      explanationPhrases.length === 0 &&
      requiredPhrases.length === 0 &&
      asStringArray(c?.synonyms).length === 0
    ) {
      errors.push(`Criterion ${id}: add keywords or phrases.`);
    }
    criteria.push({
      id,
      label: String(c?.label || `Criterion ${i + 1}`).trim(),
      marks,
      mentionMarks,
      keywords,
      synonyms: asSynonymRows(c?.synonyms),
      requiredPhrases,
      alternativePhrases,
      optionalPhrases: asStringArray(c?.optionalPhrases),
      explanationPhrases,
      requireExplanation: c?.requireExplanation !== false,
      critical: Boolean(c?.critical),
      misconceptions: asMisconceptions(c?.misconceptions),
    });
  });

  const criteriaTotal = criteria.reduce((s, c) => s + c.marks, 0);
  if (criteriaTotal - max > 0.05) {
    errors.push(`Criterion marks (${round1(criteriaTotal)}) exceed the question maximum (${max}).`);
  }

  const rubric = {
    version: Number.isFinite(Number(raw.version)) && Number(raw.version) > 0 ? Math.floor(Number(raw.version)) : 1,
    modelAnswer: String(raw.modelAnswer || "").slice(0, 8000),
    contentWeight: Number.isFinite(Number(raw.contentWeight)) ? Number(raw.contentWeight) : null,
    writingWeight: Number.isFinite(Number(raw.writingWeight)) ? Number(raw.writingWeight) : null,
    synonyms: asSynonymRows(raw.synonyms),
    criteria,
    contradictions: asMisconceptions(raw.contradictions),
  };

  return { ok: errors.length === 0 && criteria.length > 0, errors, rubric, criteriaTotal: round1(criteriaTotal) };
}

export function parseSynonymLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, rest] = line.split("=");
      if (!String(term || "").trim()) return null;
      return {
        term: String(term).trim(),
        aliases: String(rest || "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      };
    })
    .filter(Boolean);
}

export function formatSynonymLines(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const term = String(r?.term || "").trim();
      if (!term) return "";
      const aliases = Array.isArray(r.aliases) ? r.aliases.filter(Boolean).join(", ") : "";
      return aliases ? `${term} = ${aliases}` : term;
    })
    .filter(Boolean)
    .join("\n");
}
