"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Search, Users, TrendingUp, CalendarDays, Trophy } from "lucide-react";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { db } from "@/lib/firebase";
import { mcqDb } from "@/lib/firebaseMCQs";
import {
  isCrtStudentRole,
  isScopedInternshipRole,
  isSkillwinsStudentDoc,
} from "@/lib/studentRole";

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const formatPercent = (value) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
};

const getSubmissionPercent = (submission, assignment) => {
  if (typeof submission.autoScore === "number" && !Number.isNaN(submission.autoScore)) {
    return submission.autoScore;
  }
  if (submission.testSummary?.totalCount > 0) {
    if (submission.testSummary.partialScore != null && submission.testSummary.maxScore) {
      return (submission.testSummary.partialScore / submission.testSummary.maxScore) * 100;
    }
    return (submission.testSummary.passCount / submission.testSummary.totalCount) * 100;
  }
  if (assignment?.type !== "mcq" || !submission.mcqAnswers) return null;

  const questions = assignment.questions || [];
  if (questions.length === 0) return null;

  let correctCount = 0;
  questions.forEach((question, index) => {
    const studentAnswer = submission.mcqAnswers[index];
    if (Array.isArray(question.correctAnswers)) {
      if (Array.isArray(studentAnswer)) {
        const sortedCorrect = [...question.correctAnswers].map(Number).sort((a, b) => a - b);
        const sortedStudent = [...studentAnswer].map(Number).sort((a, b) => a - b);
        if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedStudent)) correctCount += 1;
      } else if (question.correctAnswers.length === 1) {
        if (Number(studentAnswer) === Number(question.correctAnswers[0])) correctCount += 1;
      }
    } else if (question.correctAnswer !== undefined) {
      if (Number(studentAnswer) === Number(question.correctAnswer)) correctCount += 1;
    }
  });

  return (correctCount / questions.length) * 100;
};

const looksLikeDayTestTitle = (text) => /^day\s*\d+/i.test(String(text || "").trim());

const getAssignmentTopicTitle = (assignment, chapterTitleById) => {
  const byChapterId = assignment.chapterId ? chapterTitleById.get(assignment.chapterId) : null;
  if (byChapterId) return byChapterId;

  const fromQuestionCategory = Array.isArray(assignment.questions)
    ? assignment.questions.find((q) => q?.category || q?.chapterTitle || q?.topic)
    : null;
  const questionTopic =
    fromQuestionCategory?.category ||
    fromQuestionCategory?.chapterTitle ||
    fromQuestionCategory?.topic ||
    null;
  if (questionTopic && !looksLikeDayTestTitle(questionTopic)) return questionTopic;

  const candidates = [
    assignment.category,
    assignment.chapterTitle,
    assignment.chapterName,
    assignment.title,
  ];
  for (const item of candidates) {
    if (item && !looksLikeDayTestTitle(item)) return item;
  }

  // Last fallback if only day-style names exist in old docs
  return questionTopic || assignment.title || assignment.category || "Untitled topic";
};

export default function StudentAnalyticsPage() {
  const [students, setStudents] = useState([]);
  const [classType, setClassType] = useState("course"); // "course" | "internship" | "crt" | "skillwins"
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [studentAnalytics, setStudentAnalytics] = useState([]);

  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "students"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStudents(list);

      } catch (error) {
        console.error("Error loading students:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  const typeFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const isCrtStudent = student.isCrt === true || isCrtStudentRole(student.role);
      if (classType === "skillwins") return isSkillwinsStudentDoc(student);
      const isInternshipStudent =
        student.isInternship === true || isScopedInternshipRole(student.role);
      if (classType === "internship") return isInternshipStudent;
      if (classType === "crt") return isCrtStudent;
      return !isInternshipStudent && !isCrtStudent && !isSkillwinsStudentDoc(student);
    });
  }, [students, classType]);

  useEffect(() => {
    const classSet = new Set();
    typeFilteredStudents.forEach((student) => {
      const studentClasses = Array.isArray(student.classIds)
        ? student.classIds
        : student.classId
          ? [student.classId]
          : [];
      studentClasses.forEach((value) => {
        if (value) classSet.add(value);
      });
    });
    const sorted = Array.from(classSet).sort((a, b) => String(a).localeCompare(String(b)));
    setClasses(sorted);
    setSelectedClass((prev) => (prev && sorted.includes(prev) ? prev : sorted[0] || ""));
  }, [typeFilteredStudents]);

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClass) return [];
    return typeFilteredStudents.filter((student) => {
      const studentClasses = Array.isArray(student.classIds)
        ? student.classIds
        : student.classId
          ? [student.classId]
          : [];
      return studentClasses.includes(selectedClass);
    });
  }, [typeFilteredStudents, selectedClass]);

  const selectedStudentIdsKey = useMemo(
    () =>
      studentsInSelectedClass
        .map((student) => String(student.id || student.uid || ""))
        .sort((a, b) => a.localeCompare(b))
        .join("|"),
    [studentsInSelectedClass]
  );

  useEffect(() => {
    async function loadClassAnalytics() {
      if (!selectedClass || studentsInSelectedClass.length === 0) {
        setStudentAnalytics([]);
        return;
      }

      setLoadingAnalytics(true);
      try {
        const studentMap = new Map();
        const studentKeys = new Set();

        studentsInSelectedClass.forEach((student) => {
          const studentName = student.name || student.studentName || student.email || student.id;
          const row = {
            id: student.id,
            studentName,
            examsAttended: 0,
            totalPercent: 0,
            avgScore: null,
            weekAreaScores: new Map(),
            courseScores: new Map(),
            strongArea: "—",
          };
          studentMap.set(student.id, row);
          studentKeys.add(student.id);
          if (student.uid) studentKeys.add(student.uid);
        });

        const classCourseTitles = new Set(
          studentsInSelectedClass.flatMap((student) => {
            const titles = Array.isArray(student.coursesTitle)
              ? student.coursesTitle
              : student.courseTitle
                ? [student.courseTitle]
                : [];
            return titles.filter(Boolean);
          })
        );

        let courseSources = [];
        if (classType === "internship") {
          const internshipsSnap = await getDocs(collection(db, "internships"));
          for (const internshipDoc of internshipsSnap.docs) {
            const internshipCoursesSnap = await getDocs(
              collection(db, "internships", internshipDoc.id, "courses")
            );
            internshipCoursesSnap.docs.forEach((courseDoc) => {
              const courseData = courseDoc.data() || {};
              courseSources.push({
                key: `internship-${internshipDoc.id}-${courseDoc.id}`,
                title: courseData.title || courseDoc.id,
                chapterPath: ["internships", internshipDoc.id, "courses", courseDoc.id, "chapters"],
                assignmentPath: ["copiedcourses", courseDoc.id],
              });
            });
          }
        } else {
          const coursesSnap = await getDocs(collection(db, "courses"));
          let courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (classCourseTitles.size > 0) {
            courses = courses.filter((course) => classCourseTitles.has(course.title));
          }
          courseSources = courses.map((course) => ({
            key: `course-${course.id}`,
            title: course.title || course.id,
            chapterPath: ["courses", course.id, "chapters"],
            assignmentPath: ["courses", course.id],
          }));
        }

        for (const courseSource of courseSources) {
          const [chaptersSnap, assignmentsSnap] = await Promise.all([
            getDocs(collection(db, ...courseSource.chapterPath)),
            getDocs(collection(mcqDb, ...courseSource.assignmentPath, "assignments")),
          ]);

          const chapterTitleById = new Map(
            chaptersSnap.docs.map((chapterDoc) => [chapterDoc.id, chapterDoc.data()?.title || "Untitled topic"])
          );
          const assignments = assignmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const assignmentBatches = chunkArray(assignments, 8);

          for (const assignmentBatch of assignmentBatches) {
            const batchResults = await Promise.all(
              assignmentBatch.map(async (assignment) => {
                const submissionsSnap = await getDocs(
                  collection(mcqDb, ...courseSource.assignmentPath, "assignments", assignment.id, "submissions")
                );
                return { assignment, submissionsDocs: submissionsSnap.docs };
              })
            );

            batchResults.forEach(({ assignment, submissionsDocs }) => {
              submissionsDocs.forEach((submissionDoc) => {
                const submission = submissionDoc.data();
                const submissionStudentId = submission.studentId || submission.userId || submission.uid || submissionDoc.id;
                if (!studentKeys.has(submissionStudentId)) return;

                const targetStudent =
                  studentMap.get(submissionStudentId) ||
                  studentsInSelectedClass.find((s) => s.uid === submissionStudentId || s.id === submissionStudentId);

                if (!targetStudent) return;
                const row = studentMap.get(targetStudent.id);
                if (!row) return;

                const percent = getSubmissionPercent(submission, assignment);
                if (percent == null || Number.isNaN(percent)) return;

                row.examsAttended += 1;
                row.totalPercent += percent;

                const chapterTitle = getAssignmentTopicTitle(assignment, chapterTitleById);
                if (!row.weekAreaScores.has(chapterTitle)) {
                  row.weekAreaScores.set(chapterTitle, { topicTitle: chapterTitle, total: 0, count: 0 });
                }
                const topicEntry = row.weekAreaScores.get(chapterTitle);
                topicEntry.total += percent;
                topicEntry.count += 1;

                const courseKey = courseSource.key;
                if (!row.courseScores.has(courseKey)) {
                  row.courseScores.set(courseKey, { courseTitle: courseSource.title, total: 0, count: 0 });
                }
                const courseEntry = row.courseScores.get(courseKey);
                courseEntry.total += percent;
                courseEntry.count += 1;
              });
            });
          }
        }

        const rows = Array.from(studentMap.values()).map((row) => {
          const avgScore = row.examsAttended > 0 ? row.totalPercent / row.examsAttended : null;
          const weekArea = Array.from(row.weekAreaScores.values())
            .map((entry) => ({
              topicTitle: entry.topicTitle,
              avg: entry.count > 0 ? entry.total / entry.count : null,
              count: entry.count,
            }))
            .sort((a, b) => a.topicTitle.localeCompare(b.topicTitle, undefined, { sensitivity: "base" }));

          const strongestCourse = Array.from(row.courseScores.values()).reduce((best, current) => {
            const currentAvg = current.count > 0 ? current.total / current.count : -1;
            const bestAvg = best ? best.total / best.count : -1;
            return currentAvg > bestAvg ? current : best;
          }, null);

          return {
            ...row,
            avgScore,
            weekArea,
            strongArea: strongestCourse?.courseTitle || "—",
          };
        });

        setStudentAnalytics(rows);
      } catch (error) {
        console.error("Error loading student analytics:", error);
        setStudentAnalytics([]);
      } finally {
        setLoadingAnalytics(false);
      }
    }

    loadClassAnalytics();
  }, [
    selectedClass,
    classType,
    selectedStudentIdsKey,
    studentsInSelectedClass,
  ]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let list = [...studentAnalytics];
    if (query) {
      list = list.filter(
        (row) =>
          String(row.studentName || "").toLowerCase().includes(query) ||
          String(row.id || "").toLowerCase().includes(query)
      );
    }
    return list.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
  }, [studentAnalytics, searchTerm]);

  const overview = useMemo(() => {
    const totalStudents = studentsInSelectedClass.length;
    const activeStudents = studentAnalytics.filter((s) => s.examsAttended > 0).length;
    const totalExams = studentAnalytics.reduce((sum, s) => sum + s.examsAttended, 0);
    const sumScore = studentAnalytics.reduce((sum, s) => sum + (s.avgScore ?? 0) * s.examsAttended, 0);
    const overallAvg = totalExams > 0 ? sumScore / totalExams : null;
    return { totalStudents, activeStudents, overallAvg };
  }, [studentsInSelectedClass.length, studentAnalytics]);

  return (
    <CheckAdminAuth>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900">Student Analytics</h1>
            <p className="text-gray-600 mt-1">
              Search by class, review student progress-test scores, topic-wise chapter performance, and strong areas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Class type</label>
              <select
                value={classType}
                onChange={(e) => setClassType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="course">Course</option>
                <option value="internship">Internship</option>
                <option value="crt">CRT</option>
                <option value="skillwins">vawe.skillwins</option>
              </select>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
              >
                {classes.length === 0 && <option value="">No class/batch found</option>}
                {classes.map((classValue) => (
                  <option key={classValue} value={classValue}>
                    {classValue}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search student</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by student name or id..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100">
                <Users className="w-5 h-5 text-cyan-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Students in class</p>
                <p className="text-xl font-bold text-gray-800">{overview.totalStudents}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <CalendarDays className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Students attempted tests</p>
                <p className="text-xl font-bold text-gray-800">{overview.activeStudents}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall average</p>
                <p className="text-xl font-bold text-gray-800">{formatPercent(overview.overallAvg)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            {loading || loadingAnalytics ? (
              <div className="p-10 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No students or submissions found for this class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-sm text-gray-600">
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold text-center">Progress tests</th>
                      <th className="px-4 py-3 font-semibold text-center">Avg score</th>
                      <th className="px-4 py-3 font-semibold text-center">Topic-wise performance</th>
                      <th className="px-4 py-3 font-semibold">Strong area in course</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{row.studentName}</p>
                          <p className="text-xs text-gray-500">{row.id}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-800">
                          {row.examsAttended}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${
                              (row.avgScore ?? 0) >= 70
                                ? "bg-emerald-100 text-emerald-800"
                                : (row.avgScore ?? 0) >= 40
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {formatPercent(row.avgScore)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.weekArea.length === 0 ? (
                            <span className="text-sm text-gray-400">No topic-wise data</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {row.weekArea.map((item) => (
                                <span
                                  key={`${row.id}-${item.topicTitle}`}
                                  className="inline-flex items-center rounded-full bg-slate-100 text-slate-800 px-2.5 py-1 text-xs font-medium"
                                >
                                  {item.topicTitle}: {formatPercent(item.avg)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-50 text-cyan-800 px-3 py-1.5 text-sm font-medium">
                            <Trophy className="w-4 h-4" />
                            {row.strongArea}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </CheckAdminAuth>
  );
}

