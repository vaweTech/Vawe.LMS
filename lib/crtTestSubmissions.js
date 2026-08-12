import { mcqDb } from "@/lib/firebaseMCQs";
import {
  collection as mcqCollection,
  getDocs as mcqGetDocs,
} from "firebase/firestore";
import { tenantSegments } from "@/lib/tenantPath";
import {
  crtProgramBucketKeys,
  withSectionBucket,
  invalidateCrtProgramCache,
  serializeRoster,
  deserializeRoster,
  readBucket,
} from "@/lib/sectionStorageCache";

export { invalidateCrtProgramCache };

export const NO_BATCH_KEY = "__no_batch__";

export function normalizeSubmittedAt(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function submissionPercent(sub) {
  if (typeof sub.autoScore === "number" && !Number.isNaN(sub.autoScore)) {
    return sub.autoScore;
  }
  if (sub.score != null && sub.total > 0) {
    return Math.round((sub.score / sub.total) * 100);
  }
  if (sub.testSummary?.maxScore > 0) {
    return Math.round(
      (sub.testSummary.partialScore / sub.testSummary.maxScore) * 100
    );
  }
  return null;
}

export function resolveStudentPhone(data = {}) {
  return String(data.phone || data.phone1 || data.phone2 || "").trim();
}

export function buildStudentMatchIds(x = {}, docId = "") {
  return new Set(
    [x.studentId, x.uid, x.userId, docId]
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );
}

export function submissionMatchesStudent(sub, student) {
  const subIds = [sub.userId, sub.studentId]
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  return subIds.some((id) => student.matchIds?.has(id));
}

/** All students assigned to batches in a CRT program (with phone, batch info). */
async function fetchBatchRosterFromNetwork(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId
) {
  if (!crtId) return [];

  const batchesSnap = await firestoreHelpers.getDocs(
    firestoreHelpers.collection(
      db,
      ...tenantSegments(collegeSubdomain, "crt"),
      crtId,
      "batches"
    )
  );

  const roster = [];
  for (const batchDoc of batchesSnap.docs) {
    const batchData = batchDoc.data() || {};
    const batchName = batchData.name || batchDoc.id;
    const studentsSnap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(
        db,
        ...tenantSegments(collegeSubdomain, "crt"),
        crtId,
        "batches",
        batchDoc.id,
        "students"
      )
    );

    for (const st of studentsSnap.docs) {
      const x = st.data() || {};
      roster.push({
        rosterDocId: st.id,
        studentId: x.studentId || st.id,
        uid: x.uid || "",
        userName: x.studentName || x.name || "Unknown",
        phone: resolveStudentPhone(x),
        email: x.email || "",
        regdNo: x.regdNo || "",
        batchId: batchDoc.id,
        batchName,
        matchIds: buildStudentMatchIds(x, st.id),
      });
    }
  }

  roster.sort((a, b) => {
    const batchCmp = (a.batchName || "").localeCompare(b.batchName || "");
    if (batchCmp !== 0) return batchCmp;
    return (a.userName || "").localeCompare(b.userName || "");
  });

  return roster;
}

export async function fetchBatchRoster(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  cacheOptions = {}
) {
  if (!crtId) return [];
  const keys = crtProgramBucketKeys(collegeSubdomain, crtId);
  return withSectionBucket(
    keys.roster,
    () => fetchBatchRosterFromNetwork(db, firestoreHelpers, collegeSubdomain, crtId),
    {
      ...cacheOptions,
      serialize: serializeRoster,
      deserialize: deserializeRoster,
    }
  );
}

export function buildRosterLookup(roster) {
  const map = new Map();
  for (const student of roster) {
    for (const id of student.matchIds || []) {
      if (!map.has(id)) map.set(id, student);
    }
  }
  return map;
}

export function enrichSubmissionWithRoster(sub, rosterLookup) {
  const uid = String(sub.userId || sub.studentId || "").trim();
  const student = uid ? rosterLookup.get(uid) : null;
  return {
    ...sub,
    phone: sub.phone || student?.phone || "",
    userName: sub.userName || student?.userName || sub.userId || "Unknown",
    regdNo: sub.regdNo || student?.regdNo || "",
    batchId: sub.batchId || student?.batchId || null,
    batchName: sub.batchName || student?.batchName || null,
  };
}

export function partitionAttendance(roster, submissions) {
  const attended = [];
  const notAttended = [];
  const usedSubIds = new Set();

  for (const student of roster) {
    const submission = submissions.find(
      (sub) => !usedSubIds.has(sub.id) && submissionMatchesStudent(sub, student)
    );
    if (submission) {
      usedSubIds.add(submission.id);
      attended.push({
        student,
        submission: {
          ...submission,
          phone: submission.phone || student.phone,
          userName: submission.userName || student.userName,
          regdNo: submission.regdNo || student.regdNo,
        },
      });
    } else {
      notAttended.push(student);
    }
  }

  const orphanSubmissions = submissions.filter((sub) => !usedSubIds.has(sub.id));
  return { attended, notAttended, orphanSubmissions };
}

/** Per-batch attended submissions + not-attended roster students. */
export function buildBatchAttendanceGroups(roster, submissions) {
  const { attended, notAttended, orphanSubmissions } = partitionAttendance(
    roster,
    submissions
  );
  const map = new Map();

  function ensure(batchId, batchLabel) {
    const key = batchId || NO_BATCH_KEY;
    if (!map.has(key)) {
      map.set(key, {
        batchKey: key,
        batchLabel: batchLabel || "No batch",
        attended: [],
        notAttended: [],
      });
    }
    return map.get(key);
  }

  for (const { submission } of attended) {
    const g = ensure(submission.batchId, submission.batchName);
    g.attended.push(submission);
  }
  for (const student of notAttended) {
    const g = ensure(student.batchId, student.batchName);
    g.notAttended.push(student);
  }
  for (const sub of orphanSubmissions) {
    const g = ensure(sub.batchId, sub.batchName);
    g.attended.push(sub);
  }

  for (const group of map.values()) {
    group.attended.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });
    group.notAttended.sort((a, b) =>
      (a.userName || "").localeCompare(b.userName || "", undefined, {
        sensitivity: "base",
      })
    );
  }

  return Array.from(map.values()).sort((a, b) =>
    a.batchLabel.localeCompare(b.batchLabel || "", undefined, {
      sensitivity: "base",
    })
  );
}

/** Map student uid → { batchId, batchName } for a CRT program */
export async function buildStudentBatchMap(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  cacheOptions = {}
) {
  const map = new Map();
  if (!crtId) return map;

  const roster = await fetchBatchRoster(
    db,
    firestoreHelpers,
    collegeSubdomain,
    crtId,
    cacheOptions
  );
  for (const student of roster) {
    for (const id of student.matchIds || []) {
      if (!map.has(id)) {
        map.set(id, {
          batchId: student.batchId,
          batchName: student.batchName,
          phone: student.phone,
          userName: student.userName,
        });
      }
    }
  }

  return map;
}

function attachBatch(sub, batchMap) {
  const uid = String(sub.userId || sub.studentId || "").trim();
  const batch = uid ? batchMap.get(uid) : null;
  return {
    ...sub,
    batchId: sub.batchId || batch?.batchId || null,
    batchName: sub.batchName || batch?.batchName || null,
    phone: sub.phone || batch?.phone || "",
    userName: sub.userName || batch?.userName || sub.userId || "Unknown",
  };
}

/** CRT formal exams under crt/{crtId}/tests */
export async function fetchCrtExamTests(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId
) {
  if (!crtId) return [];
  const snap = await firestoreHelpers.getDocs(
    firestoreHelpers.collection(
      db,
      ...tenantSegments(collegeSubdomain, "crt"),
      crtId,
      "tests"
    )
  );
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      key: `crt_exam:${d.id}`,
      sourceType: "crt_exam",
      name: data.name || data.title || d.id,
      label: data.name || data.title || d.id,
      sections: Array.isArray(data.sections) ? data.sections : [],
      raw: data,
    };
  });
}

/** Day progress tests from copiedcourses for each course in the CRT program */
export async function fetchDayProgressTests(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId
) {
  if (!crtId) return [];
  const coursesSnap = await firestoreHelpers.getDocs(
    firestoreHelpers.collection(
      db,
      ...tenantSegments(collegeSubdomain, "crt"),
      crtId,
      "courses"
    )
  );

  const tests = [];
  for (const courseDoc of coursesSnap.docs) {
    const courseData = courseDoc.data() || {};
    const courseId = courseDoc.id;
    const courseTitle = courseData.title || courseId;
    const assignmentsSnap = await mcqGetDocs(
      mcqCollection(mcqDb, "copiedcourses", courseId, "assignments")
    );

    for (const assignmentDoc of assignmentsSnap.docs) {
      const a = assignmentDoc.data() || {};
      const day = Number(a.day) || 1;
      const title =
        a.title ||
        (a.type === "coding"
          ? `Day ${day} Coding Test`
          : `Day ${day} MCQ Test`);
      tests.push({
        id: assignmentDoc.id,
        key: `day_test:${courseId}:${assignmentDoc.id}`,
        sourceType: "day_test",
        courseId,
        courseTitle,
        day,
        type: a.type || "mcq",
        name: title,
        label: `${courseTitle} · Day ${day}: ${title}`,
        questions: Array.isArray(a.questions) ? a.questions : [],
        raw: a,
      });
    }
  }

  tests.sort((a, b) => {
    const courseCmp = (a.courseTitle || "").localeCompare(b.courseTitle || "");
    if (courseCmp !== 0) return courseCmp;
    return (a.day || 0) - (b.day || 0);
  });

  return tests;
}

export async function fetchAllTestOptions(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  cacheOptions = {}
) {
  if (!crtId) return [];
  const keys = crtProgramBucketKeys(collegeSubdomain, crtId);
  return withSectionBucket(
    keys.tests,
    async () => {
      const [crtExams, dayTests] = await Promise.all([
        fetchCrtExamTests(db, firestoreHelpers, collegeSubdomain, crtId),
        fetchDayProgressTests(db, firestoreHelpers, collegeSubdomain, crtId),
      ]);
      return [...crtExams, ...dayTests];
    },
    cacheOptions
  );
}

export async function fetchCrtExamSubmissions(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  testId,
  batchMap
) {
  if (!crtId || !testId) return [];
  const snap = await firestoreHelpers.getDocs(
    firestoreHelpers.collection(
      db,
      ...tenantSegments(collegeSubdomain, "crt"),
      crtId,
      "tests",
      testId,
      "submissions"
    )
  );

  return snap.docs.map((d) => {
    const data = d.data() || {};
    const row = attachBatch(
      {
        id: d.id,
        sourceType: "crt_exam",
        userId: data.userId || data.studentId || "",
        userName: data.userName || data.studentName || data.userId || "Unknown",
        score: data.score,
        total: data.total,
        autoScore: data.autoScore,
        answers: data.answers,
        submittedAt: normalizeSubmittedAt(data.submittedAt),
        testId,
        testName: data.testName || data.title || testId,
      },
      batchMap
    );
    return row;
  });
}

export async function fetchDayTestSubmissions(
  courseId,
  assignmentId,
  testMeta,
  batchMap
) {
  if (!courseId || !assignmentId) return [];
  const snap = await mcqGetDocs(
    mcqCollection(
      mcqDb,
      "copiedcourses",
      courseId,
      "assignments",
      assignmentId,
      "submissions"
    )
  );

  return snap.docs.map((d) => {
    const data = d.data() || {};
    const summary = data.testSummary || {};
    const row = attachBatch(
      {
        id: d.id,
        sourceType: "day_test",
        userId: data.studentId || data.userId || "",
        userName:
          data.studentName || data.userName || data.studentId || "Unknown",
        score: summary.partialScore ?? data.score,
        total: summary.maxScore ?? data.total,
        autoScore: data.autoScore,
        submittedAt: normalizeSubmittedAt(data.submittedAt),
        testId: assignmentId,
        testName: testMeta?.name || testMeta?.title || `Day ${testMeta?.day || ""} Test`,
        courseId,
        courseName: testMeta?.courseTitle,
        day: testMeta?.day,
        assignmentType: testMeta?.type,
        resultStatus: data.resultStatus,
      },
      batchMap
    );
    return row;
  });
}

export async function fetchSubmissionsForTestOption(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  testOption,
  batchMap,
  cacheOptions = {}
) {
  if (!testOption) return [];

  const keys = crtProgramBucketKeys(collegeSubdomain, crtId);
  if (!cacheOptions.forceRefresh) {
    const cachedAll = readBucket(keys.submissions);
    if (Array.isArray(cachedAll)) {
      return cachedAll.filter((sub) => sub.testKey === testOption.key);
    }
  }

  if (testOption.sourceType === "crt_exam") {
    return fetchCrtExamSubmissions(
      db,
      firestoreHelpers,
      collegeSubdomain,
      crtId,
      testOption.id,
      batchMap
    );
  }
  if (testOption.sourceType === "day_test") {
    return fetchDayTestSubmissions(
      testOption.courseId,
      testOption.id,
      testOption,
      batchMap
    );
  }
  return [];
}

/** All CRT exam + day test submissions for a program (analytics) */
export async function fetchAllSubmissionsForCrt(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  cacheOptions = {}
) {
  if (!crtId) return [];

  const keys = crtProgramBucketKeys(collegeSubdomain, crtId);
  return withSectionBucket(
    keys.submissions,
    async () => {
      const batchMap = await buildStudentBatchMap(
        db,
        firestoreHelpers,
        collegeSubdomain,
        crtId,
        cacheOptions
      );
      const testOptions = await fetchAllTestOptions(
        db,
        firestoreHelpers,
        collegeSubdomain,
        crtId,
        cacheOptions
      );

      const submissions = [];
      for (const testOption of testOptions) {
        const rows = await fetchSubmissionsForTestOption(
          db,
          firestoreHelpers,
          collegeSubdomain,
          crtId,
          testOption,
          batchMap,
          { forceRefresh: true }
        );
        submissions.push(
          ...rows.map((row) => ({
            ...row,
            testKey: testOption.key,
            testLabel: testOption.label,
          }))
        );
      }

      return submissions;
    },
    cacheOptions
  );
}

export async function fetchCrtBatches(
  db,
  firestoreHelpers,
  collegeSubdomain,
  crtId,
  cacheOptions = {}
) {
  if (!crtId) return [];
  const keys = crtProgramBucketKeys(collegeSubdomain, crtId);
  return withSectionBucket(
    keys.batches,
    async () => {
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          crtId,
          "batches"
        )
      );
      return snap.docs
        .map((d) => ({
          id: d.id,
          name: d.data()?.name || d.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    cacheOptions
  );
}

/** Day-only dropdown options (step 3) */
export function buildDayOptions(tests) {
  const options = [{ key: "", label: "All days (batch summary)" }];
  const dayTests = tests.filter((t) => t.sourceType === "day_test");
  const days = [...new Set(dayTests.map((t) => Number(t.day) || 0))]
    .filter((d) => d > 0)
    .sort((a, b) => a - b);

  for (const day of days) {
    options.push({ key: `day:${day}`, label: `Day ${day}` });
  }

  const crtExams = tests.filter((t) => t.sourceType === "crt_exam");
  if (crtExams.length > 0) {
    options.push({ key: "crt_exams", label: "CRT Exams" });
  }

  return options;
}

/** Subject (course) options for a selected day, or all courses when no day */
export function buildSubjectOptions(tests, dayKey) {
  if (dayKey === "crt_exams") {
    return [{ courseId: "crt_exams", courseTitle: "CRT Exams" }];
  }

  let pool = tests.filter((t) => t.sourceType === "day_test");
  if (dayKey?.startsWith("day:")) {
    const day = Number(dayKey.slice(4));
    pool = pool.filter((t) => Number(t.day) === day);
  }

  const byCourse = new Map();
  for (const t of pool) {
    if (!t.courseId) continue;
    if (!byCourse.has(t.courseId)) {
      byCourse.set(t.courseId, t.courseTitle || t.courseId);
    }
  }

  const options = [{ courseId: "", courseTitle: "— Select Subject —" }];
  for (const [courseId, courseTitle] of [...byCourse.entries()].sort((a, b) =>
    a[1].localeCompare(b[1])
  )) {
    options.push({ courseId, courseTitle });
  }
  return options;
}

/** Resolve tests for day + subject filters */
export function resolveFilteredTests(tests, { dayKey = "", subjectId = "" } = {}) {
  if (!dayKey && !subjectId) return tests;

  if (dayKey === "crt_exams") {
    return tests.filter((t) => t.sourceType === "crt_exam");
  }

  let result = [...tests];

  if (dayKey?.startsWith("day:")) {
    const day = Number(dayKey.slice(4));
    result = result.filter(
      (t) => t.sourceType === "day_test" && Number(t.day) === day
    );
  }

  if (subjectId && subjectId !== "crt_exams") {
    result = result.filter(
      (t) => t.sourceType === "day_test" && t.courseId === subjectId
    );
  }

  return result;
}

/** Dropdown options: all tests, per-day, per CRT exam */
export function buildTestFilterOptions(tests) {
  const options = [
    { key: "", label: "All tests (batch summary)", tests: [] },
  ];

  const dayTests = tests.filter((t) => t.sourceType === "day_test");
  const dayNumbers = [...new Set(dayTests.map((t) => Number(t.day) || 0))]
    .filter((d) => d > 0)
    .sort((a, b) => a - b);

  for (const day of dayNumbers) {
    const dayItems = dayTests.filter((t) => Number(t.day) === day);
    const label =
      dayItems.length === 1
        ? `Day ${day}: ${dayItems[0].name}`
        : `Day ${day} (${dayItems.length} tests)`;
    options.push({ key: `day:${day}`, label, tests: dayItems });
  }

  for (const test of tests.filter((t) => t.sourceType === "crt_exam")) {
    options.push({
      key: test.key,
      label: `CRT exam · ${test.name || test.label}`,
      tests: [test],
    });
  }

  for (const test of dayTests) {
    if (dayNumbers.includes(Number(test.day))) continue;
    options.push({
      key: test.key,
      label: `Day test · ${test.label}`,
      tests: [test],
    });
  }

  return options;
}

export function resolveTestsForFilterKey(tests, filterKey) {
  if (!filterKey) return [];
  if (filterKey.startsWith("day:")) {
    const day = Number(filterKey.slice(4));
    return tests.filter(
      (t) => t.sourceType === "day_test" && Number(t.day) === day
    );
  }
  const test = tests.find((t) => t.key === filterKey);
  return test ? [test] : [];
}

export function studentAttendedTest(student, testKey, allSubmissions) {
  return allSubmissions.some(
    (sub) => sub.testKey === testKey && submissionMatchesStudent(sub, student)
  );
}

/** Batch summary: each student's attended count vs total tests */
export function buildBatchStudentOverview(
  roster,
  tests,
  allSubmissions,
  batchId
) {
  const students = roster.filter((s) => s.batchId === batchId);
  const totalTests = tests.length;

  return students.map((student) => {
    const attended = [];
    const missed = [];

    for (const test of tests) {
      const sub = allSubmissions.find(
        (s) => s.testKey === test.key && submissionMatchesStudent(s, student)
      );
      if (sub) attended.push({ test, sub });
      else missed.push(test);
    }

    const scored = attended
      .map((a) => submissionPercent(a.sub))
      .filter((p) => p != null);
    const avgPercent =
      scored.length > 0
        ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
        : null;

    return {
      ...student,
      attendedCount: attended.length,
      totalTests,
      attended,
      missed,
      avgPercent,
    };
  });
}

export function groupSubmissionsByBatch(submissions) {
  const map = new Map();
  for (const sub of submissions) {
    const key = sub.batchId || NO_BATCH_KEY;
    const label = sub.batchName || "No batch";
    if (!map.has(key)) map.set(key, { label, submissions: [] });
    map.get(key).submissions.push(sub);
  }
  for (const entry of map.values()) {
    entry.submissions.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });
  }
  return Array.from(map.entries()).map(([batchKey, { label, submissions: subs }]) => ({
    batchKey,
    batchLabel: label,
    submissions: subs,
  }));
}
