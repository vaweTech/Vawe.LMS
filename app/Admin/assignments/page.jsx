"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { mcqDb } from "../../../lib/firebaseMCQs";
import { collection, getDocs } from "firebase/firestore";
import CheckAdminAuth from "../../../lib/CheckAdminAuth";
import { ChartBar, Users, FileCheck, Trophy, Search, BookOpen, Layers, ChevronRight } from "lucide-react";

const TAB_PROGRESS = "progress";
const TAB_INTERNSHIP = "internship";
const TAB_ANALYTICS = "analytics";

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "examsDesc", label: "Exams attended (high first)" },
  { value: "examsAsc", label: "Exams attended (low first)" },
  { value: "avgDesc", label: "Avg score (high first)" },
  { value: "avgAsc", label: "Avg score (low first)" },
  { value: "highestDesc", label: "Highest score (high first)" },
  { value: "highestAsc", label: "Highest score (low first)" },
];

export default function AdminAssignmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TAB_PROGRESS);

  // Progress Test state
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignmentType, setSelectedAssignmentType] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Internship state
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [internshipCourses, setInternshipCourses] = useState([]);
  const [selectedInternshipCourse, setSelectedInternshipCourse] = useState(null);
  const [internshipAssignmentType, setInternshipAssignmentType] = useState(null);
  const [internshipDay, setInternshipDay] = useState(null);
  const [selectedInternshipAssignment, setSelectedInternshipAssignment] = useState(null);
  const [internshipSubmissions, setInternshipSubmissions] = useState([]);
  const [loadingInternships, setLoadingInternships] = useState(true);

  // Analytics state
  const [analyticsScope, setAnalyticsScope] = useState("progress"); // "progress" | "internship"
  const [analyticsCourse, setAnalyticsCourse] = useState(null);
  const [analyticsInternship, setAnalyticsInternship] = useState(null);
  const [analyticsInternshipCourse, setAnalyticsInternshipCourse] = useState(null);
  const [allAnalyticsSubmissions, setAllAnalyticsSubmissions] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsSortBy, setAnalyticsSortBy] = useState("avgDesc");
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [analyticsViewMode, setAnalyticsViewMode] = useState("student"); // "student" | "subject" | "batch"
  const [internshipCoursesForAnalytics, setInternshipCoursesForAnalytics] = useState([]);
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchInternships();
  }, []);

  const fetchCourses = async () => {
    try {
      // Fetch all courses from primary Firebase
      const coursesSnap = await getDocs(collection(db, "courses"));
      const coursesData = [];
      
      for (const courseDoc of coursesSnap.docs) {
        const courseData = { id: courseDoc.id, ...courseDoc.data() };
        
        // Fetch assignments for each course from MCQ Firebase
        const assignmentsSnap = await getDocs(collection(mcqDb, "courses", courseDoc.id, "assignments"));
        courseData.assignments = assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Add all courses (even if they don't have assignments yet)
        coursesData.push(courseData);
      }
      
      setCourses(coursesData);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInternships = async () => {
    try {
      const internshipsSnap = await getDocs(collection(db, "internships"));
      const list = internshipsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInternships(list);
    } catch (error) {
      console.error("Error fetching internships:", error);
    } finally {
      setLoadingInternships(false);
    }
  };

  const fetchInternshipCourses = async (internshipId) => {
    if (!internshipId) {
      setInternshipCourses([]);
      return;
    }
    try {
      const coursesSnap = await getDocs(
        collection(db, "internships", internshipId, "courses")
      );
      const coursesData = [];
      for (const courseDoc of coursesSnap.docs) {
        const courseData = { id: courseDoc.id, ...courseDoc.data() };
        const assignmentsSnap = await getDocs(
          collection(mcqDb, "copiedcourses", courseDoc.id, "assignments")
        );
        courseData.assignments = assignmentsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        coursesData.push(courseData);
      }
      setInternshipCourses(coursesData);
    } catch (error) {
      console.error("Error fetching internship courses:", error);
      setInternshipCourses([]);
    }
  };

  const fetchSubmissions = async (courseId, assignmentId) => {
    try {
      // Fetch submissions from MCQ Firebase
      const submissionsSnap = await getDocs(
        collection(mcqDb, "courses", courseId, "assignments", assignmentId, "submissions")
      );
      
      const submissionsData = submissionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate?.() || new Date()
      }));
      
      // Sort by submission date (newest first)
      submissionsData.sort((a, b) => b.submittedAt - a.submittedAt);
      
      setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    }
  };

  const fetchAllSubmissionsForAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const submissions = [];
      if (analyticsScope === "progress") {
        const coursesToFetch = analyticsCourse ? [analyticsCourse] : courses;
        for (const course of coursesToFetch) {
          const assignments = course.assignments || [];
          for (const a of assignments) {
            const snap = await getDocs(
              collection(mcqDb, "courses", course.id, "assignments", a.id, "submissions")
            );
          snap.docs.forEach((d) => {
            const data = d.data();
            submissions.push({
              id: d.id,
              ...data,
              studentId: data.studentId || "unknown",
              studentName: data.studentName || data.userId || "Unknown",
              courseName: course.title,
              courseId: course.id,
              assignmentTitle: a.title,
              submittedAt: data.submittedAt?.toDate?.() || new Date(),
              autoScore: typeof data.autoScore === "number" ? data.autoScore : null,
              testSummary: data.testSummary,
              batchId: data.batchId || null,
              batchName: data.batchName || null,
            });
          });
        }
        }
      } else if (analyticsScope === "internship" && analyticsInternship) {
        const coursesToFetch = analyticsInternshipCourse
          ? [analyticsInternshipCourse]
          : internshipCoursesForAnalytics;
        for (const course of coursesToFetch) {
          const assignments = course.assignments || [];
          for (const a of assignments) {
            const snap = await getDocs(
              collection(mcqDb, "copiedcourses", course.id, "assignments", a.id, "submissions")
            );
            snap.docs.forEach((d) => {
              const data = d.data();
              submissions.push({
                id: d.id,
                ...data,
                studentId: data.studentId || "unknown",
                studentName: data.studentName || data.userId || "Unknown",
                courseName: course.title,
                courseId: course.id,
                assignmentTitle: a.title,
                submittedAt: data.submittedAt?.toDate?.() || new Date(),
                autoScore: typeof data.autoScore === "number" ? data.autoScore : null,
                testSummary: data.testSummary,
                batchId: data.batchId || null,
                batchName: data.batchName || null,
              });
            });
          }
        }
      }
      setAllAnalyticsSubmissions(submissions);
    } catch (error) {
      console.error("Error fetching analytics submissions:", error);
      setAllAnalyticsSubmissions([]);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [analyticsScope, analyticsCourse, analyticsInternship, analyticsInternshipCourse, internshipCoursesForAnalytics, courses]);

  useEffect(() => {
    async function loadInternshipCoursesForAnalytics() {
      if (!analyticsInternship?.id) {
        setInternshipCoursesForAnalytics([]);
        return;
      }
      try {
        const coursesSnap = await getDocs(
          collection(db, "internships", analyticsInternship.id, "courses")
        );
        const courseDocs = coursesSnap.docs;
        const coursesData = await Promise.all(
          courseDocs.map(async (courseDoc) => {
            const assignmentsSnap = await getDocs(
              collection(mcqDb, "copiedcourses", courseDoc.id, "assignments")
            );
            return {
              id: courseDoc.id,
              ...courseDoc.data(),
              assignments: assignmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            };
          })
        );
        setInternshipCoursesForAnalytics(coursesData);
      } catch (e) {
        console.error(e);
        setInternshipCoursesForAnalytics([]);
      }
    }
    if (analyticsScope === "internship" && analyticsInternship) {
      loadInternshipCoursesForAnalytics();
    } else {
      setInternshipCoursesForAnalytics([]);
    }
  }, [analyticsScope, analyticsInternship]);

  useEffect(() => {
    if (
      (analyticsScope === "progress" && (analyticsCourse || courses.length > 0)) ||
      (analyticsScope === "internship" && analyticsInternship && (analyticsInternshipCourse || internshipCoursesForAnalytics.length > 0))
    ) {
      fetchAllSubmissionsForAnalytics();
    } else {
      setAllAnalyticsSubmissions([]);
    }
  }, [analyticsScope, analyticsCourse, analyticsInternship, analyticsInternshipCourse, internshipCoursesForAnalytics, courses, fetchAllSubmissionsForAnalytics]);

  const fetchInternshipSubmissions = async (courseCopyId, assignmentId) => {
    try {
      const submissionsSnap = await getDocs(
        collection(mcqDb, "copiedcourses", courseCopyId, "assignments", assignmentId, "submissions")
      );
      const submissionsData = submissionsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate?.() || new Date(),
      }));
      submissionsData.sort((a, b) => b.submittedAt - a.submittedAt);
      setInternshipSubmissions(submissionsData);
    } catch (error) {
      console.error("Error fetching internship submissions:", error);
      setInternshipSubmissions([]);
    }
  };

  // Get available assignment types for selected course
  const getAvailableTypes = (course) => {
    if (!course || !course.assignments) return [];
    const types = new Set(course.assignments.map(a => a.type));
    return Array.from(types);
  };

  // Get available days for selected course and type
  const getAvailableDays = (course, type) => {
    if (!course || !course.assignments || !type) return [];
    const filteredAssignments = course.assignments.filter(a => a.type === type);
    const days = filteredAssignments
      .map(a => a.day || 1)
      .filter((day, index, self) => self.indexOf(day) === index)
      .sort((a, b) => a - b);
    return days;
  };

  // Get assignment for selected day
  const getAssignmentForDay = (course, type, day) => {
    if (!course || !course.assignments || !type || !day) return null;
    const assignment = course.assignments.find(a => a.type === type && (a.day || 1) === day);
    return assignment || null;
  };

  const handleDaySelect = async (day) => {
    setSelectedDay(day);
    const assignment = getAssignmentForDay(selectedCourse, selectedAssignmentType, day);
    setSelectedAssignment(assignment);
    if (assignment && selectedCourse) {
      await fetchSubmissions(selectedCourse.id, assignment.id);
    } else {
      setSubmissions([]);
    }
  };

  const handleInternshipSelect = (internship) => {
    setSelectedInternship(internship);
    setSelectedInternshipCourse(null);
    setInternshipAssignmentType(null);
    setInternshipDay(null);
    setSelectedInternshipAssignment(null);
    setInternshipSubmissions([]);
    if (internship) fetchInternshipCourses(internship.id);
    else setInternshipCourses([]);
  };

  const handleInternshipCourseSelect = (course) => {
    setSelectedInternshipCourse(course);
    setInternshipAssignmentType(null);
    setInternshipDay(null);
    setSelectedInternshipAssignment(null);
    setInternshipSubmissions([]);
  };

  const handleInternshipDaySelect = async (day) => {
    setInternshipDay(day);
    const assignment = getAssignmentForDay(
      selectedInternshipCourse,
      internshipAssignmentType,
      day
    );
    setSelectedInternshipAssignment(assignment);
    if (assignment && selectedInternshipCourse) {
      await fetchInternshipSubmissions(selectedInternshipCourse.id, assignment.id);
    } else {
      setInternshipSubmissions([]);
    }
  };

  // Grading UI and handlers removed per requirements

  const analyticsTotalSubjects = useMemo(() => {
    if (analyticsScope === "progress") {
      return analyticsCourse ? 1 : courses.length;
    }
    if (analyticsScope === "internship") {
      return analyticsInternshipCourse ? 1 : internshipCoursesForAnalytics.length;
    }
    return 0;
  }, [analyticsScope, analyticsCourse, analyticsInternshipCourse, courses.length, internshipCoursesForAnalytics.length]);

  // Analytics: aggregate submissions by student
  const analyticsStudentStats = useMemo(() => {
    const byUser = new Map();
    for (const sub of allAnalyticsSubmissions) {
      const uid = sub.studentId || "unknown";
      const percent =
        sub.autoScore ??
        (sub.testSummary?.totalCount > 0
          ? (sub.testSummary.partialScore != null
            ? (sub.testSummary.partialScore / sub.testSummary.maxScore) * 100
            : (sub.testSummary.passCount / sub.testSummary.totalCount) * 100)
          : null);
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          studentId: uid,
          studentName: sub.studentName || "Unknown",
          examsAttended: 0,
          totalPercent: 0,
          maxPercent: null,
          lastSubmittedAt: null,
          bySubject: new Map(),
        });
      }
      const row = byUser.get(uid);
      row.examsAttended += 1;
      if (percent != null && !Number.isNaN(percent)) {
        row.totalPercent += percent;
        row.maxPercent = row.maxPercent == null ? percent : Math.max(row.maxPercent, percent);
      }
      if (sub.submittedAt) {
        const t = new Date(sub.submittedAt).getTime();
        if (!row.lastSubmittedAt || t > row.lastSubmittedAt) row.lastSubmittedAt = t;
      }
      const cid = sub.courseId || sub.courseName || "unknown";
      const cname = sub.courseName || "Unknown";
      if (!row.bySubject.has(cid)) {
        row.bySubject.set(cid, { courseName: cname, courseId: cid, total: 0, count: 0, max: null });
      }
      const s = row.bySubject.get(cid);
      s.count += 1;
      s.total += percent != null && !Number.isNaN(percent) ? percent : 0;
      s.max = s.max == null ? percent : (percent != null ? Math.max(s.max, percent) : s.max);
    }
    return Array.from(byUser.values()).map((row) => {
      const subjectScores = Array.from(row.bySubject.values()).map((s) => ({
        ...s,
        avgScore: s.count > 0 ? s.total / s.count : null,
      }));
      return {
        ...row,
        avgScore: row.examsAttended > 0 ? row.totalPercent / row.examsAttended : null,
        subjectsAttempted: row.bySubject.size,
        subjectScores,
      };
    });
  }, [allAnalyticsSubmissions]);

  const analyticsFilteredAndSorted = useMemo(() => {
    let list = [...analyticsStudentStats];
    if (analyticsSearch.trim()) {
      const q = analyticsSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.studentName && s.studentName.toLowerCase().includes(q)) ||
          (s.studentId && s.studentId.toLowerCase().includes(q))
      );
    }
    switch (analyticsSortBy) {
      case "name":
        list.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "", undefined, { sensitivity: "base" }));
        break;
      case "examsDesc":
        list.sort((a, b) => b.examsAttended - a.examsAttended);
        break;
      case "examsAsc":
        list.sort((a, b) => a.examsAttended - b.examsAttended);
        break;
      case "avgDesc":
        list.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
        break;
      case "avgAsc":
        list.sort((a, b) => (a.avgScore ?? -1) - (b.avgScore ?? -1));
        break;
      case "highestDesc":
        list.sort((a, b) => (b.maxPercent ?? -1) - (a.maxPercent ?? -1));
        break;
      case "highestAsc":
        list.sort((a, b) => (a.maxPercent ?? -1) - (b.maxPercent ?? -1));
        break;
      default:
        list.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
    }
    return list;
  }, [analyticsStudentStats, analyticsSortBy, analyticsSearch]);

  // Subject-wise (course-wise) aggregation
  const analyticsSubjectStats = useMemo(() => {
    const byCourse = new Map();
    for (const sub of allAnalyticsSubmissions) {
      const key = sub.courseId || sub.courseName || "unknown";
      const name = sub.courseName || "Unknown";
      const percent =
        sub.autoScore ??
        (sub.testSummary?.totalCount > 0
          ? (sub.testSummary.partialScore != null
            ? (sub.testSummary.partialScore / sub.testSummary.maxScore) * 100
            : (sub.testSummary.passCount / sub.testSummary.totalCount) * 100)
          : null);
      if (!byCourse.has(key)) {
        byCourse.set(key, {
          courseId: key,
          courseName: name,
          students: new Set(),
          examsAttended: 0,
          totalPercent: 0,
          maxPercent: null,
        });
      }
      const row = byCourse.get(key);
      row.students.add(sub.studentId);
      row.examsAttended += 1;
      if (percent != null && !Number.isNaN(percent)) {
        row.totalPercent += percent;
        row.maxPercent = row.maxPercent == null ? percent : Math.max(row.maxPercent, percent);
      }
    }
    return Array.from(byCourse.values()).map((row) => ({
      ...row,
      studentCount: row.students.size,
      avgScore: row.examsAttended > 0 ? row.totalPercent / row.examsAttended : null,
    }));
  }, [allAnalyticsSubmissions]);

  // Batch-wise aggregation (when batchId/batchName present)
  const analyticsBatchStats = useMemo(() => {
    const byBatch = new Map();
    const noBatchKey = "__no_batch__";
    for (const sub of allAnalyticsSubmissions) {
      const key = sub.batchId || sub.batchName || noBatchKey;
      const label = sub.batchName || "No batch";
      const percent =
        sub.autoScore ??
        (sub.testSummary?.totalCount > 0
          ? (sub.testSummary.partialScore != null
            ? (sub.testSummary.partialScore / sub.testSummary.maxScore) * 100
            : (sub.testSummary.passCount / sub.testSummary.totalCount) * 100)
          : null);
      if (!byBatch.has(key)) {
        byBatch.set(key, {
          batchId: key === noBatchKey ? null : key,
          batchName: label,
          students: new Set(),
          examsAttended: 0,
          totalPercent: 0,
          maxPercent: null,
        });
      }
      const row = byBatch.get(key);
      row.students.add(sub.studentId);
      row.examsAttended += 1;
      if (percent != null && !Number.isNaN(percent)) {
        row.totalPercent += percent;
        row.maxPercent = row.maxPercent == null ? percent : Math.max(row.maxPercent, percent);
      }
    }
    return Array.from(byBatch.values()).map((row) => ({
      ...row,
      studentCount: row.students.size,
      avgScore: row.examsAttended > 0 ? row.totalPercent / row.examsAttended : null,
    }));
  }, [allAnalyticsSubmissions]);

  const hasBatchData = useMemo(
    () => allAnalyticsSubmissions.some((s) => s.batchId || s.batchName),
    [allAnalyticsSubmissions]
  );

  const analyticsSummary = useMemo(() => {
    const totalStudents = analyticsStudentStats.length;
    const totalExams = allAnalyticsSubmissions.length;
    const sumPercent = analyticsStudentStats.reduce(
      (acc, s) => acc + (s.avgScore != null ? s.avgScore * (s.examsAttended || 0) : 0),
      0
    );
    const overallAvg = totalExams > 0 ? sumPercent / totalExams : null;
    const topScorer = analyticsStudentStats.reduce(
      (best, s) => ((s.maxPercent ?? -1) > (best?.maxPercent ?? -1) ? s : best),
      null
    );
    return { totalStudents, totalExams, overallAvg, topScorer };
  }, [analyticsStudentStats, allAnalyticsSubmissions.length]);

  const calculateMCQScore = (submission, assignment) => {
    // Prefer autoScore if already calculated at submit time
    if (typeof submission.autoScore === "number" && !Number.isNaN(submission.autoScore)) {
      return submission.autoScore;
    }
    // Fallback: use testSummary if available (from MCQ submit flow)
    if (submission.testSummary?.totalCount > 0) {
      const pct = submission.testSummary.partialScore != null
        ? (submission.testSummary.partialScore / submission.testSummary.maxScore) * 100
        : (submission.testSummary.passCount / submission.testSummary.totalCount) * 100;
      return Math.round(pct * 10) / 10;
    }
    if (assignment.type !== "mcq" || !submission.mcqAnswers) return null;

    let correctAnswers = 0;
    const totalQuestions = assignment.questions?.length || 0;
    if (totalQuestions === 0) return 0;

    assignment.questions?.forEach((question, index) => {
      const studentAnswer = submission.mcqAnswers[index];

      // Handle multiple correct answers (correctAnswers array)
      if (Array.isArray(question.correctAnswers)) {
        if (Array.isArray(studentAnswer)) {
          const sortedCorrect = [...question.correctAnswers].map(Number).sort((a, b) => a - b);
          const sortedStudent = [...studentAnswer].map(Number).sort((a, b) => a - b);
          if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedStudent)) {
            correctAnswers++;
          }
        } else if (question.correctAnswers.length === 1) {
          if (Number(studentAnswer) === Number(question.correctAnswers[0])) {
            correctAnswers++;
          }
        }
      }
      // Handle single correct answer (correctAnswer number)
      else if (question.correctAnswer !== undefined) {
        if (Number(studentAnswer) === Number(question.correctAnswer)) {
          correctAnswers++;
        }
      }
    });

    return totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  };

  if (loading || loadingInternships) return (
    <CheckAdminAuth>
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading courses...</p>
        </div>
      </div>
    </CheckAdminAuth>
  );

  const renderSubmissionsList = (subs, assignment) => {
    if (!assignment) return null;
    return (
      <div className="divide-y divide-gray-200">
        {subs.map((submission) => {
          const mcqScore = assignment.type === "mcq"
            ? calculateMCQScore(submission, assignment)
            : null;
          const codingScore = assignment.type === "coding"
            ? (typeof submission.autoScore === "number"
                ? submission.autoScore
                : submission.testSummary?.totalCount
                  ? Math.round((submission.testSummary.passCount / submission.testSummary.totalCount) * 100)
                  : null)
            : null;
          const displayAutoScore = assignment.type === "mcq"
            ? (mcqScore != null ? `${mcqScore.toFixed(1)}%` : "N/A")
            : (codingScore != null ? `${codingScore}%` : "N/A");
          return (
            <div key={submission.id} className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">
                    {submission.studentName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Submitted: {submission.submittedAt.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Auto Score</p>
                  <p className="text-xl font-semibold text-gray-800">{displayAutoScore}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <CheckAdminAuth>
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={() => router.back()}
          className="mb-4 px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
        >
          ⬅ Back
        </button>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">Assignment Reports</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab(TAB_PROGRESS)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === TAB_PROGRESS
                    ? "bg-cyan-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                Progress Tests
              </button>
              <button
                onClick={() => setActiveTab(TAB_INTERNSHIP)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === TAB_INTERNSHIP
                    ? "bg-cyan-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                Internship Assignments
              </button>
              <button
                onClick={() => setActiveTab(TAB_ANALYTICS)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  activeTab === TAB_ANALYTICS
                    ? "bg-cyan-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                <ChartBar className="w-4 h-4" />
                Analytics
              </button>
            </div>
          </div>

          {activeTab === TAB_PROGRESS && (
            <>
              <div className="mb-6">
                {courses.length > 0 && (
                  <p className="text-gray-600">
                    {courses.length} total {courses.length === 1 ? "course" : "courses"}
                  </p>
                )}
              </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Courses Available Yet</h3>
              <p className="text-gray-500">
                Please create courses first in the Admin Tutorials section.
              </p>
            </div>
          ) : (
            <>
              {/* Three-Step Selection: Course → Type → Day */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Step 1: Course Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">1. Select Course</h2>
              <select
                id="courseSelect"
                name="courseSelect"
                value={selectedCourse?.id || ""}
                onChange={(e) => {
                  const course = courses.find(c => c.id === e.target.value);
                  setSelectedCourse(course);
                  setSelectedAssignmentType(null);
                  setSelectedDay(null);
                  setSelectedAssignment(null);
                  setSubmissions([]);
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">Choose a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Assignment Type Selection */}
            {selectedCourse && getAvailableTypes(selectedCourse).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">2. Select Type</h2>
                <select
                  id="typeSelect"
                  name="typeSelect"
                  value={selectedAssignmentType || ""}
                  onChange={(e) => {
                    setSelectedAssignmentType(e.target.value);
                    setSelectedDay(null);
                    setSelectedAssignment(null);
                    setSubmissions([]);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="">Choose MCQ or Coding...</option>
                  {getAvailableTypes(selectedCourse).map((type) => (
                    <option key={type} value={type}>
                      {type.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Day Selection */}
            {selectedCourse && selectedAssignmentType && getAvailableDays(selectedCourse, selectedAssignmentType).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">3. Select Day</h2>
                <select
                  id="daySelect"
                  name="daySelect"
                  value={selectedDay || ""}
                  onChange={(e) => handleDaySelect(parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="">Choose a day...</option>
                  {getAvailableDays(selectedCourse, selectedAssignmentType).map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Submissions List */}
          {selectedAssignment && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Submissions for: {selectedAssignment.title}
                </h2>
                <p className="text-gray-600 mt-2">
                  Course: {selectedCourse.title} | Type: {selectedAssignment.type.toUpperCase()} | Day: {selectedAssignment.day || 1}
                </p>
              </div>

              {submissions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No submissions yet for this assignment.
                </div>
              ) : (
                renderSubmissionsList(submissions, selectedAssignment)
              )}
            </div>
          )}
            </>
          )}
            </>
          )}

          {activeTab === TAB_INTERNSHIP && (
            <>
              <div className="mb-6">
                {internships.length > 0 && (
                  <p className="text-gray-600">
                    {internships.length} total {internships.length === 1 ? "internship" : "internships"}
                  </p>
                )}
              </div>

              {internships.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No Internships Available Yet</h3>
                  <p className="text-gray-500">
                    Create internships in the Admin Internships section first.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-xl font-semibold mb-4">1. Select Internship</h2>
                      <select
                        value={selectedInternship?.id || ""}
                        onChange={(e) => {
                          const internship = internships.find((i) => i.id === e.target.value);
                          handleInternshipSelect(internship || null);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                      >
                        <option value="">Choose an internship...</option>
                        {internships.map((internship) => (
                          <option key={internship.id} value={internship.id}>
                            {internship.name || internship.title || internship.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedInternship && internshipCourses.length > 0 && (
                      <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">2. Select Course</h2>
                        <select
                          value={selectedInternshipCourse?.id || ""}
                          onChange={(e) => {
                            const course = internshipCourses.find((c) => c.id === e.target.value);
                            handleInternshipCourseSelect(course || null);
                          }}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="">Choose a course...</option>
                          {internshipCourses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedInternshipCourse && getAvailableTypes(selectedInternshipCourse).length > 0 && (
                      <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">3. Select Type</h2>
                        <select
                          value={internshipAssignmentType || ""}
                          onChange={(e) => {
                            setInternshipAssignmentType(e.target.value);
                            setInternshipDay(null);
                            setSelectedInternshipAssignment(null);
                            setInternshipSubmissions([]);
                          }}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="">Choose MCQ or Coding...</option>
                          {getAvailableTypes(selectedInternshipCourse).map((type) => (
                            <option key={type} value={type}>
                              {type.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedInternshipCourse &&
                      internshipAssignmentType &&
                      getAvailableDays(selectedInternshipCourse, internshipAssignmentType).length > 0 && (
                      <div className="bg-white rounded-lg shadow p-6 lg:col-span-1">
                        <h2 className="text-xl font-semibold mb-4">4. Select Day</h2>
                        <select
                          value={internshipDay || ""}
                          onChange={(e) => handleInternshipDaySelect(parseInt(e.target.value))}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="">Choose a day...</option>
                          {getAvailableDays(
                            selectedInternshipCourse,
                            internshipAssignmentType
                          ).map((day) => (
                            <option key={day} value={day}>
                              Day {day}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {selectedInternshipAssignment && (
                    <div className="bg-white rounded-lg shadow">
                      <div className="p-6 border-b">
                        <h2 className="text-2xl font-semibold text-gray-800">
                          Submissions for: {selectedInternshipAssignment.title}
                        </h2>
                        <p className="text-gray-600 mt-2">
                          Internship: {selectedInternship?.name || selectedInternship?.title} | Course:{" "}
                          {selectedInternshipCourse?.title} | Type:{" "}
                          {selectedInternshipAssignment.type?.toUpperCase()} | Day:{" "}
                          {selectedInternshipAssignment.day || 1}
                        </p>
                      </div>

                      {internshipSubmissions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          No submissions yet for this assignment.
                        </div>
                      ) : (
                        renderSubmissionsList(
                          internshipSubmissions,
                          selectedInternshipAssignment
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === TAB_ANALYTICS && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <ChartBar className="w-6 h-6 text-cyan-600" />
                  Submission Analytics
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Student-wise, subject-wise, and batch-wise performance analytics.
                </p>
              </div>

              {/* Internship: Show clickable cards when scope is internship and no selection */}
              {analyticsScope === "internship" && !analyticsInternship && internships.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Select an Internship</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {internships.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => setAnalyticsInternship(i)}
                        className="group p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-cyan-500 hover:shadow-xl transition-all duration-200 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <Layers className="w-6 h-6 text-white" />
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-600 group-hover:translate-x-1 transition-all" />
                        </div>
                        <h4 className="mt-4 font-bold text-gray-900 truncate">
                          {i.name || i.title || i.id}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">View analytics →</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
                  <select
                    value={analyticsScope}
                    onChange={(e) => {
                      setAnalyticsScope(e.target.value);
                      setAnalyticsCourse(null);
                      setAnalyticsInternship(null);
                      setAnalyticsInternshipCourse(null);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="progress">Progress Tests</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>

                {analyticsScope === "progress" && (
                  <div className="bg-white rounded-lg shadow p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject / Course</label>
                    <select
                      value={analyticsCourse?.id || "__all__"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAnalyticsCourse(v === "__all__" ? null : courses.find((x) => x.id === v) || null);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                    >
                      <option value="__all__">All courses (subject-wise view)</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {analyticsScope === "internship" && analyticsInternship && (
                  <>
                    <div className="bg-white rounded-lg shadow p-4 flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject / Course</label>
                      <select
                        value={analyticsInternshipCourse?.id || "__all__"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAnalyticsInternshipCourse(v === "__all__" ? null : internshipCoursesForAnalytics.find((x) => x.id === v) || null);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                      >
                        <option value="__all__">All courses (subject-wise view)</option>
                        {internshipCoursesForAnalytics.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-end">
                      <button
                        type="button"
                        onClick={() => setAnalyticsInternship(null)}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        ← Change internship
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* View mode toggle when we have data */}
              {((analyticsScope === "progress" && (analyticsCourse || courses.length > 0)) || (analyticsScope === "internship" && analyticsInternship && (analyticsInternshipCourse || internshipCoursesForAnalytics.length > 0))) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-600 self-center">View by:</span>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode("student")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      analyticsViewMode === "student" ? "bg-cyan-600 text-white" : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode("subject")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      analyticsViewMode === "subject" ? "bg-cyan-600 text-white" : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Subject
                  </button>
                  {hasBatchData && (
                    <button
                      type="button"
                      onClick={() => setAnalyticsViewMode("batch")}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        analyticsViewMode === "batch" ? "bg-cyan-600 text-white" : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      Batch
                    </button>
                  )}
                </div>
              )}

              {loadingAnalytics ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600" />
                </div>
              ) : (analyticsScope === "progress" && courses.length === 0) || (analyticsScope === "internship" && !analyticsInternship) ? (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                  Select a {analyticsScope === "progress" ? "course" : "internship"} to view analytics.
                </div>
              ) : analyticsScope === "internship" && analyticsInternship && internshipCoursesForAnalytics.length === 0 && !loadingAnalytics ? (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                  No courses in this internship yet.
                </div>
              ) : allAnalyticsSubmissions.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                  No submissions yet for this selection.
                </div>
              ) : analyticsViewMode === "subject" ? (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-cyan-600" />
                    Subject-wise Analytics
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyticsSubjectStats.map((row) => (
                      <div
                        key={row.courseId}
                        className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="font-bold text-gray-900 truncate">{row.courseName}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500">Students</p>
                            <p className="font-semibold text-gray-800">{row.studentCount}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Exams</p>
                            <p className="font-semibold text-gray-800">{row.examsAttended}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Avg score</p>
                            <p className={`font-semibold ${(row.avgScore ?? 0) >= 70 ? "text-emerald-600" : (row.avgScore ?? 0) >= 40 ? "text-amber-600" : "text-red-600"}`}>
                              {row.avgScore != null ? `${Math.round(row.avgScore)}%` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Highest</p>
                            <p className={`font-semibold ${(row.maxPercent ?? 0) >= 70 ? "text-emerald-600" : (row.maxPercent ?? 0) >= 40 ? "text-amber-600" : "text-red-600"}`}>
                              {row.maxPercent != null ? `${Math.round(row.maxPercent)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : analyticsViewMode === "batch" ? (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-600" />
                    Batch-wise Analytics
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyticsBatchStats.map((row) => (
                      <div
                        key={row.batchId || "__no_batch__"}
                        className="p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Layers className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="font-bold text-gray-900 truncate">{row.batchName}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500">Students</p>
                            <p className="font-semibold text-gray-800">{row.studentCount}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Exams</p>
                            <p className="font-semibold text-gray-800">{row.examsAttended}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Avg score</p>
                            <p className={`font-semibold ${(row.avgScore ?? 0) >= 70 ? "text-emerald-600" : (row.avgScore ?? 0) >= 40 ? "text-amber-600" : "text-red-600"}`}>
                              {row.avgScore != null ? `${Math.round(row.avgScore)}%` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Highest</p>
                            <p className={`font-semibold ${(row.maxPercent ?? 0) >= 70 ? "text-emerald-600" : (row.maxPercent ?? 0) >= 40 ? "text-amber-600" : "text-red-600"}`}>
                              {row.maxPercent != null ? `${Math.round(row.maxPercent)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-100">
                        <Users className="w-6 h-6 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Students</p>
                        <p className="text-xl font-bold text-gray-800">{analyticsSummary.totalStudents}</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-100">
                        <FileCheck className="w-6 h-6 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total exam attempts</p>
                        <p className="text-xl font-bold text-gray-800">{analyticsSummary.totalExams}</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100">
                        <ChartBar className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Overall avg score</p>
                        <p className="text-xl font-bold text-gray-800">
                          {analyticsSummary.overallAvg != null ? `${Math.round(analyticsSummary.overallAvg)}%` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <Trophy className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Top scorer</p>
                        <p className="text-lg font-bold text-gray-800 truncate" title={analyticsSummary.topScorer?.studentName}>
                          {analyticsSummary.topScorer?.studentName || "—"}
                        </p>
                        {analyticsSummary.topScorer?.maxPercent != null && (
                          <p className="text-sm text-amber-700 font-medium">
                            {Math.round(analyticsSummary.topScorer.maxPercent)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search by name..."
                          value={analyticsSearch}
                          onChange={(e) => setAnalyticsSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-gray-800 placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-600">Sort by</label>
                        <select
                          value={analyticsSortBy}
                          onChange={(e) => setAnalyticsSortBy(e.target.value)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        >
                          {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600 text-sm">
                            <th className="px-4 py-3 font-semibold">#</th>
                            <th className="px-4 py-3 font-semibold">Student</th>
                            <th className="px-4 py-3 font-semibold text-center">Subjects</th>
                            <th className="px-4 py-3 font-semibold text-center">Exams</th>
                            <th className="px-4 py-3 font-semibold text-center">Avg score</th>
                            <th className="px-4 py-3 font-semibold text-center">Highest</th>
                            <th className="px-4 py-3 font-semibold">Last attempt</th>
                            <th className="px-4 py-3 font-semibold w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsFilteredAndSorted.map((row, i) => (
                            <React.Fragment key={row.studentId}>
                              <tr className="border-t border-gray-100 hover:bg-cyan-50/30 transition-colors">
                                <td className="px-4 py-3 text-gray-500 tabular-nums font-medium">{i + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-800">{row.studentName || row.studentId || "—"}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold text-sm" title={`${row.subjectsAttempted ?? 0} of ${analyticsTotalSubjects} subjects attempted`}>
                                    {(row.subjectsAttempted ?? 0)}/{analyticsTotalSubjects}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold text-sm">
                                    {row.examsAttended}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                                    (row.avgScore ?? 0) >= 70 ? "bg-emerald-100 text-emerald-800" :
                                    (row.avgScore ?? 0) >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                  }`}>
                                    {row.avgScore != null ? `${Math.round(row.avgScore)}%` : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                                    (row.maxPercent ?? 0) >= 70 ? "bg-emerald-100 text-emerald-800" :
                                    (row.maxPercent ?? 0) >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                                  }`}>
                                    {row.maxPercent != null ? `${Math.round(row.maxPercent)}%` : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {row.lastSubmittedAt
                                    ? new Date(row.lastSubmittedAt).toLocaleDateString(undefined, {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {row.subjectScores?.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedStudentId(expandedStudentId === row.studentId ? null : row.studentId)}
                                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-medium"
                                      title="View subject-wise scores"
                                    >
                                      {expandedStudentId === row.studentId ? "−" : "+"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {expandedStudentId === row.studentId && row.subjectScores?.length > 0 && (
                                <tr key={`${row.studentId}-exp`} className="bg-slate-50/80">
                                  <td colSpan={8} className="px-4 py-3">
                                    <div className="flex flex-wrap gap-3">
                                      {row.subjectScores.map((s) => (
                                        <div key={s.courseId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                                          <span className="font-medium text-gray-800 text-sm truncate max-w-[140px]">{s.courseName}</span>
                                          <span className={`text-sm font-semibold ${(s.avgScore ?? 0) >= 70 ? "text-emerald-600" : (s.avgScore ?? 0) >= 40 ? "text-amber-600" : "text-red-600"}`}>
                                            {s.avgScore != null ? `${Math.round(s.avgScore)}%` : "—"}
                                          </span>
                                          <span className="text-xs text-gray-500">({s.count} exam{s.count !== 1 ? "s" : ""})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </CheckAdminAuth>
  );
}
