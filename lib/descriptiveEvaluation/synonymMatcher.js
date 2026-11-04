import { hasPhrase, normalizeForMatch } from "./textNormalize.js";

/**
 * Build a term -> aliases map. Question-specific aliases win.
 * Terms are never treated as equivalent just because they share a word.
 */
export function buildAliasMap(globalSynonyms, criterionSynonyms) {
  const map = new Map();
  const add = (term, aliases) => {
    const key = normalizeForMatch(term);
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set([key]));
    const set = map.get(key);
    (Array.isArray(aliases) ? aliases : []).forEach((a) => {
      const n = normalizeForMatch(a);
      if (n) set.add(n);
    });
  };
  (Array.isArray(globalSynonyms) ? globalSynonyms : []).forEach((row) => {
    add(row?.term, row?.aliases);
  });
  (Array.isArray(criterionSynonyms) ? criterionSynonyms : []).forEach((row) => {
    if (typeof row === "string") add(row, []);
    else add(row?.term || row, row?.aliases);
  });
  return map;
}

export function collectSearchTerms(keywords, synonyms, aliasMap) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const n = normalizeForMatch(raw);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
    const extras = aliasMap.get(n);
    if (extras) {
      extras.forEach((a) => {
        if (!seen.has(a)) {
          seen.add(a);
          out.push(a);
        }
      });
    }
  };
  (Array.isArray(keywords) ? keywords : []).forEach(push);
  (Array.isArray(synonyms) ? synonyms : []).forEach((row) => {
    if (typeof row === "string") push(row);
    else {
      push(row?.term);
      (row?.aliases || []).forEach(push);
    }
  });
  out.sort((a, b) => b.length - a.length);
  return out;
}

export function matchAnyTerm(haystackNorm, terms) {
  const hits = [];
  const seen = new Set();
  (terms || []).forEach((term) => {
    if (hasPhrase(haystackNorm, term) && !seen.has(term)) {
      seen.add(term);
      hits.push({ term, method: "exact-or-synonym" });
    }
  });
  return hits;
}
