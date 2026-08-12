/**
 * Session-scoped storage buckets with TTL to cut repeat Firestore reads.
 * Keys are namespaced per section (tenant + CRT program + data type).
 */

const BUCKET_PREFIX = "lms_section_bucket:";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isBrowser() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function bucketKey(...parts) {
  return BUCKET_PREFIX + parts.filter((p) => p != null && p !== "").join(":");
}

export function crtProgramBucketKeys(collegeSubdomain, crtId) {
  const base = bucketKey("crt", collegeSubdomain || "global", crtId);
  return {
    prefix: base,
    batches: `${base}:batches`,
    tests: `${base}:tests`,
    roster: `${base}:roster`,
    submissions: `${base}:submissions`,
  };
}

export function readBucket(key) {
  if (!isBrowser() || !key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.savedAt !== "number") {
      sessionStorage.removeItem(key);
      return null;
    }
    const ttl = entry.ttlMs ?? DEFAULT_TTL_MS;
    if (Date.now() - entry.savedAt > ttl) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data ?? null;
  } catch {
    return null;
  }
}

export function writeBucket(key, data, ttlMs = DEFAULT_TTL_MS) {
  if (!isBrowser() || !key) return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), ttlMs, data })
    );
  } catch {
    clearBucketsByPrefix(BUCKET_PREFIX);
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ savedAt: Date.now(), ttlMs, data })
      );
    } catch {
      /* storage full — skip cache */
    }
  }
}

export function removeBucket(key) {
  if (!isBrowser() || !key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearBucketsByPrefix(prefix) {
  if (!isBrowser() || !prefix) return;
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function invalidateCrtProgramCache(collegeSubdomain, crtId) {
  if (!crtId) return;
  const { prefix } = crtProgramBucketKeys(collegeSubdomain, crtId);
  clearBucketsByPrefix(prefix);
}

/** Roster entries use Set for matchIds — serialize for sessionStorage */
export function serializeRoster(roster) {
  return (roster || []).map((student) => ({
    ...student,
    matchIds: Array.from(student.matchIds || []),
  }));
}

export function deserializeRoster(raw) {
  return (raw || []).map((student) => ({
    ...student,
    matchIds: new Set(student.matchIds || []),
  }));
}

/**
 * Read-through cache: returns cached value or runs loader and stores result.
 */
export async function withSectionBucket(
  key,
  loader,
  { forceRefresh = false, ttlMs = DEFAULT_TTL_MS, serialize, deserialize } = {}
) {
  if (!forceRefresh) {
    const cached = readBucket(key);
    if (cached != null) {
      return deserialize ? deserialize(cached) : cached;
    }
  }

  const fresh = await loader();
  const toStore = serialize ? serialize(fresh) : fresh;
  writeBucket(key, toStore, ttlMs);
  return fresh;
}
