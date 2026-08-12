import { adminDb } from "@/lib/firebaseAdmin";
import { withAdminAuth } from "@/lib/apiAuth";
import {
  DEFAULT_COLLEGE_SUBDOMAIN,
  getScopedInternshipRole,
  getScopedStudentRole,
  resolveCollegeSubdomain,
} from "@/lib/studentRole";

const BATCH_LIMIT = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableNetworkError(e) {
  const msg = `${e?.message || ""} ${e?.code || ""}`;
  return /socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|fetch failed|ENOTFOUND/i.test(
    msg
  );
}

async function withFirestoreRetry(fn, maxAttempts = 4) {
  const backoffMs = [300, 800, 1500, 3000];
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableNetworkError(e)) {
        await sleep(backoffMs[attempt - 1] ?? 3000);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function countByRole(legacyRole) {
  return withFirestoreRetry(async () => {
    const snap = await adminDb
      .collection("students")
      .where("role", "==", legacyRole)
      .count()
      .get();
    return snap.data().count || 0;
  });
}

async function safeCountByRole(legacyRole) {
  try {
    return await countByRole(legacyRole);
  } catch (e) {
    console.warn(`countByRole(${legacyRole}) failed:`, e?.message || e);
    return null;
  }
}

async function migrateRoleBatch({
  legacyRole,
  scopedRole,
  collegeSubdomain,
  dryRun,
  limit,
  onlyMissingSubdomain,
}) {
  let query = adminDb.collection("students").where("role", "==", legacyRole).limit(limit);

  const snap = await withFirestoreRetry(() => query.get());
  const batch = adminDb.batch();
  let updated = 0;
  let skipped = 0;
  const samples = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const existingSub = String(data.collegeSubdomain || "").trim().toLowerCase();

    if (onlyMissingSubdomain && existingSub && existingSub !== collegeSubdomain) {
      skipped += 1;
      continue;
    }

    if (existingSub && existingSub !== collegeSubdomain) {
      skipped += 1;
      continue;
    }

    const patch = { role: scopedRole };
    if (!existingSub) {
      patch.collegeSubdomain = collegeSubdomain;
    }
    if (legacyRole === "internship") {
      patch.isInternship = true;
    }

    if (!dryRun) {
      batch.update(docSnap.ref, patch);
    }
    updated += 1;
    if (samples.length < 5) {
      samples.push({ id: docSnap.id, email: data.email, from: legacyRole, to: scopedRole });
    }
  }

  if (!dryRun && updated > 0) {
    await batch.commit();
  }

  return { updated, skipped, samples, fetched: snap.size, hasMore: snap.size >= limit };
}

function assertInstituteAdmin(req) {
  const role = req.user?.role;
  if (role !== "admin" && role !== "superadmin") {
    return new Response(
      JSON.stringify({ error: "Admin or superadmin access required." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}

async function migrateHandler(req) {
  const denied = assertInstituteAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const collegeSubdomain = resolveCollegeSubdomain(
      body.collegeSubdomain || DEFAULT_COLLEGE_SUBDOMAIN
    );
    const dryRun = body.dryRun !== false;
    const limit = Math.min(Math.max(Number(body.limit) || BATCH_LIMIT, 1), BATCH_LIMIT);
    const onlyMissingSubdomain = !!body.onlyMissingSubdomain;

    const scopedStudent = getScopedStudentRole(collegeSubdomain);
    const scopedInternship = getScopedInternshipRole(collegeSubdomain);

    const [pendingStudents, pendingInternships] = await Promise.all([
      safeCountByRole("student"),
      safeCountByRole("internship"),
    ]);

    const studentResult = await migrateRoleBatch({
      legacyRole: "student",
      scopedRole: scopedStudent,
      collegeSubdomain,
      dryRun,
      limit,
      onlyMissingSubdomain,
    });

    const internshipResult = await migrateRoleBatch({
      legacyRole: "internship",
      scopedRole: scopedInternship,
      collegeSubdomain,
      dryRun,
      limit,
      onlyMissingSubdomain,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        collegeSubdomain,
        targetRoles: {
          student: scopedStudent,
          internship: scopedInternship,
        },
        pendingBeforeRun: {
          legacyStudent: pendingStudents,
          legacyInternship: pendingInternships,
        },
        student: studentResult,
        internship: internshipResult,
        message: dryRun
          ? "Dry run only — no documents were changed. Set dryRun: false to apply."
          : "Migration batch applied.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("migrate-student-roles error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Migration failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req) {
  return withAdminAuth(req, migrateHandler);
}

export async function GET(req) {
  return withAdminAuth(req, async (authReq) => {
    const denied = assertInstituteAdmin(authReq);
    if (denied) return denied;

    const [pendingStudents, pendingInternships] = await Promise.all([
      safeCountByRole("student"),
      safeCountByRole("internship"),
    ]);

    const countsUnavailable =
      pendingStudents === null || pendingInternships === null;

    return new Response(
      JSON.stringify({
        pendingLegacyRoles: {
          student: pendingStudents,
          internship: pendingInternships,
        },
        countsUnavailable,
        targetRoles: {
          student: getScopedStudentRole(DEFAULT_COLLEGE_SUBDOMAIN),
          internship: getScopedInternshipRole(DEFAULT_COLLEGE_SUBDOMAIN),
        },
        usage: {
          dryRun: 'POST { "dryRun": true, "collegeSubdomain": "vawe", "limit": 500 }',
          apply: 'POST { "dryRun": false, "collegeSubdomain": "vawe", "limit": 500 }',
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
}
