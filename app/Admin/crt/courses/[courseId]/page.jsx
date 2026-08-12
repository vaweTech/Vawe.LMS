"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { auth, db, firestoreHelpers } from "../../../../../lib/firebase";
import { mcqDb } from "../../../../../lib/firebaseMCQs";
import {
  downloadDayMcqSampleCsv,
  parseDayMcqRows,
} from "@/lib/dayMcqUpload";
import {
  collection as mcqCollection,
  getDocs as mcqGetDocs,
  doc as mcqDoc,
  updateDoc as mcqUpdateDoc,
  deleteDoc as mcqDeleteDoc,
  addDoc as mcqAddDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAdminAccess } from "../../../AdminAccessContext";
import {
  sortChaptersByOrder,
  chaptersNeedRenumbering,
  buildChapterOrderRemap,
  renumberChaptersSequential,
  remapProgressTestsAfterDayDelete,
  remapProgressTestsByOrderMap,
  healProgressTestTitles,
} from "@/lib/crtChapterOrder";

export default function CourseSyllabusDays() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId;

  const { user, loading, hasCrtManagerAccess: canManageCourse } = useAdminAccess();

  const [course, setCourse] = useState(null);

  // Chapters (day-wise content) stored under crtCourses/{courseId}/chapters
  const [chapters, setChapters] = useState([]);
  const [chapterSavingId, setChapterSavingId] = useState("");
  const [newChapter, setNewChapter] = useState({
    title: "",
    topics: "",
    video: "",
    pptUrl: "",
    pdfDocument: "",
    liveClassLink: "",
    recordedClassLink: "",
    classDocs: "",
    order: 1,
  });

  const [crts, setCrts] = useState([]);
  const [selectedCrtId, setSelectedCrtId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Progress tests mapped by course (same structure as in manage page)
  const [progressTests, setProgressTests] = useState([]);
  const [loadingProgressTests, setLoadingProgressTests] = useState(false);
  const [editingTestId, setEditingTestId] = useState(null);
  const [editingTest, setEditingTest] = useState(null);
  const [questionEditTestId, setQuestionEditTestId] = useState(null);
  const [questionDrafts, setQuestionDrafts] = useState([]);
  const [mcqUploading, setMcqUploading] = useState(false);
  const [mcqUploadInfo, setMcqUploadInfo] = useState("");
  const [mcqUploadPreview, setMcqUploadPreview] = useState(null);
  const [expandedChapterId, setExpandedChapterId] = useState(null);

  const [editingCourseInfo, setEditingCourseInfo] = useState(false);
  const [courseInfoDraft, setCourseInfoDraft] = useState({ title: "", courseCode: "", description: "" });
  const [savingCourseInfo, setSavingCourseInfo] = useState(false);

  const sortedChapters = useMemo(
    () =>
      sortChaptersByOrder(chapters).map((ch, index) => ({
        ...ch,
        order: index + 1,
      })),
    [chapters]
  );

  const loadAndNormalizeChapters = useCallback(async () => {
    if (!courseId) return [];
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, "crtCourses", courseId, "chapters")
    );
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!chaptersNeedRenumbering(list)) {
      return sortChaptersByOrder(list);
    }
    const orderRemap = buildChapterOrderRemap(list);
    list = await renumberChaptersSequential(list, (chapterId, newOrder) =>
      firestoreHelpers.updateDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId, "chapters", chapterId),
        { order: newOrder }
      )
    );
    if (orderRemap.size > 0) {
      const testSnap = await mcqGetDocs(
        mcqCollection(mcqDb, "copiedcourses", courseId, "assignments")
      );
      const tests = testSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      await remapProgressTestsByOrderMap(tests, orderRemap, {
        updateTestDay: (testId, day, title) =>
          mcqUpdateDoc(
            mcqDoc(mcqDb, "copiedcourses", courseId, "assignments", testId),
            title ? { day, title } : { day }
          ),
      });
    }
    return list;
  }, [courseId]);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    try {
      const snap = await firestoreHelpers.getDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId)
      );
      if (snap.exists()) {
        const data = snap.data();
        setCourse({
          id: snap.id,
          title: data.title || "",
          description: data.description || "",
          courseCode: data.courseCode || "",
          isNonTechnical: data.isNonTechnical === true,
        });
      }
    } catch (e) {
      console.error("Failed to fetch course:", e);
      alert("Failed to load course.");
    }
  }, [courseId]);

  const fetchCrts = useCallback(async () => {
    try {
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, "crt")
      );
      setCrts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to fetch CRTs:", e);
    }
  }, []);

  const fetchChapters = useCallback(async () => {
    if (!courseId) return;
    try {
      const list = await loadAndNormalizeChapters();
      setChapters(list);
    } catch (e) {
      console.error("Failed to fetch chapters:", e);
      setChapters([]);
    }
  }, [courseId, loadAndNormalizeChapters]);

  const fetchProgressTests = useCallback(async () => {
    try {
      if (!courseId) {
        setProgressTests([]);
        return;
      }
      setLoadingProgressTests(true);
      const snap = await mcqGetDocs(
        mcqCollection(mcqDb, "copiedcourses", courseId, "assignments")
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.day || 0) - (b.day || 0));
      const healed = await healProgressTestTitles(list, {
        updateTest: (testId, patch) =>
          mcqUpdateDoc(
            mcqDoc(mcqDb, "copiedcourses", courseId, "assignments", testId),
            patch
          ),
      });
      healed.sort((a, b) => (a.day || 0) - (b.day || 0));
      setProgressTests(healed);
    } catch (e) {
      console.error("Failed to load progress tests:", e);
      setProgressTests([]);
    } finally {
      setLoadingProgressTests(false);
    }
  }, [courseId]);

  async function saveProgressTestMeta() {
    if (!courseId || !editingTestId || !editingTest) return;
    try {
      const ref = mcqDoc(
        mcqDb,
        "copiedcourses",
        courseId,
        "assignments",
        editingTestId
      );
      await mcqUpdateDoc(ref, {
        title: editingTest.title || "",
        dueDate: editingTest.dueDate || "",
        day: Number(editingTest.day) || 1,
        type: editingTest.type || "mcq",
      });
      alert("Progress test updated.");
      setEditingTestId(null);
      setEditingTest(null);
      await fetchProgressTests();
    } catch (e) {
      console.error("Failed to update progress test:", e);
      alert("Failed to update progress test.");
    }
  }

  async function deleteProgressTest(id) {
    if (!courseId || !id) return;
    if (!confirm("Delete this progress test?")) return;
    try {
      const ref = mcqDoc(mcqDb, "copiedcourses", courseId, "assignments", id);
      await mcqDeleteDoc(ref);
      setProgressTests((prev) => prev.filter((t) => t.id !== id));
      if (editingTestId === id) {
        setEditingTestId(null);
        setEditingTest(null);
      }
      if (questionEditTestId === id) {
        setQuestionEditTestId(null);
        setQuestionDrafts([]);
      }
      alert("Progress test deleted.");
    } catch (e) {
      console.error("Failed to delete progress test:", e);
      alert("Failed to delete progress test.");
    }
  }

  async function saveTestQuestions() {
    if (!courseId || !questionEditTestId) return;
    try {
      const invalidMcq = questionDrafts.find(
        (question) =>
          (question.type || "mcq") === "mcq" &&
          (!String(question.question || "").trim() ||
            (question.options || []).filter((option) => String(option || "").trim())
              .length < 2 ||
            !Array.isArray(question.correctAnswers) ||
            question.correctAnswers.length === 0)
      );
      if (invalidMcq) {
        alert(
          "Please verify every MCQ has a question, at least 2 options, and a correct answer."
        );
        return;
      }
      const questions = questionDrafts.map((question) => {
        const { _uploadWarning, ...savedQuestion } = question;
        return savedQuestion;
      });
      const ref = mcqDoc(
        mcqDb,
        "copiedcourses",
        courseId,
        "assignments",
        questionEditTestId
      );
      await mcqUpdateDoc(ref, {
        questions,
      });
      alert("Questions updated.");
      setQuestionEditTestId(null);
      setQuestionDrafts([]);
      setMcqUploadPreview(null);
      setMcqUploadInfo("");
      await fetchProgressTests();
    } catch (e) {
      console.error("Failed to update questions:", e);
      alert("Failed to update questions.");
    }
  }

  function processDayMcqUploadRows(rows) {
    const result = parseDayMcqRows(rows);
    if (result.questions.length === 0) {
      setMcqUploadPreview(null);
      setMcqUploadInfo(
        "No valid MCQs found. Check question, options, and answer columns."
      );
      return;
    }
    setMcqUploadPreview(result);
    setMcqUploadInfo(
      `Parsed ${result.questions.length} question(s)${
        result.errors.length ? ` with ${result.errors.length} warning(s)` : ""
      }. Verify the preview before applying.`
    );
  }

  function handleDayMcqFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    setMcqUploading(true);
    setMcqUploadInfo("");
    setMcqUploadPreview(null);

    const finish = () => {
      setMcqUploading(false);
      event.target.value = "";
    };

    if (extension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          try {
            processDayMcqUploadRows(result.data || []);
          } finally {
            finish();
          }
        },
        error: () => {
          setMcqUploadInfo("Failed to read CSV file.");
          finish();
        },
      });
      return;
    }

    if (extension === "xlsx" || extension === "xls") {
      (async () => {
        try {
          const rows = await readXlsxFile(file);
          if (!rows?.length) {
            setMcqUploadInfo("The Excel file is empty.");
            return;
          }
          const [header, ...dataRows] = rows;
          const keys = header.map((value) => String(value || "").trim());
          processDayMcqUploadRows(
            dataRows.map((row) =>
              Object.fromEntries(
                keys.map((key, index) => [
                  key,
                  row[index] == null ? "" : String(row[index]),
                ])
              )
            )
          );
        } catch (error) {
          console.error("Failed to read MCQ Excel file:", error);
          setMcqUploadInfo("Failed to read Excel file.");
        } finally {
          finish();
        }
      })();
      return;
    }

    setMcqUploadInfo("Upload a .csv, .xlsx, or .xls file.");
    finish();
  }

  function applyDayMcqUpload(mode) {
    const questions = mcqUploadPreview?.questions || [];
    if (!questions.length) return;
    setQuestionDrafts((current) =>
      mode === "replace" ? questions : [...current, ...questions]
    );
    setMcqUploadPreview(null);
    setMcqUploadInfo(
      `${questions.length} MCQ(s) ${
        mode === "replace" ? "replaced" : "appended"
      }. Review/edit them and click Save All Questions.`
    );
  }

  useEffect(() => {
    if (!user) return;
    fetchCourse();
    fetchCrts();
    fetchChapters();
    fetchProgressTests();
  }, [user, fetchCourse, fetchCrts, fetchChapters, fetchProgressTests]);

  async function addChapter(e) {
    e.preventDefault();
    if (!courseId) return;
    try {
      setChapterSavingId("new");
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(db, "crtCourses", courseId, "chapters"),
        {
          title: newChapter.title || "",
          topics: newChapter.topics || "",
          video: newChapter.video || "",
          pptUrl: newChapter.pptUrl || "",
          pdfDocument: newChapter.pdfDocument || "",
          liveClassLink: newChapter.liveClassLink || "",
          recordedClassLink: newChapter.recordedClassLink || "",
          classDocs: newChapter.classDocs || "",
          order: Number(newChapter.order) || 1,
          createdAt: new Date().toISOString(),
        }
      );
      setNewChapter({
        title: "",
        topics: "",
        video: "",
        pptUrl: "",
        pdfDocument: "",
        liveClassLink: "",
        recordedClassLink: "",
        classDocs: "",
        order: 1,
      });
      await fetchChapters();
    } finally {
      setChapterSavingId("");
    }
  }

  async function updateChapter(ch) {
    if (!courseId) return;
    try {
      setChapterSavingId(ch.id);
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId, "chapters", ch.id),
        {
          title: ch.title || "",
          topics: ch.topics || "",
          video: ch.video || "",
          pptUrl: ch.pptUrl || "",
          pdfDocument: ch.pdfDocument || "",
          liveClassLink: ch.liveClassLink || "",
          recordedClassLink: ch.recordedClassLink || "",
          classDocs: ch.classDocs || "",
          order: Number(ch.order) || 1,
          updatedAt: new Date().toISOString(),
        }
      );
      await fetchChapters();
    } finally {
      setChapterSavingId("");
    }
  }

  async function deleteChapter(id) {
    if (!courseId) return;
    if (!confirm("Delete this chapter?")) return;

    const deleted = chapters.find((c) => c.id === id);
    const deletedOrder = Number(deleted?.order) || 0;

    await firestoreHelpers.deleteDoc(
      firestoreHelpers.doc(db, "crtCourses", courseId, "chapters", id)
    );

    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, "crtCourses", courseId, "chapters")
    );
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list = await renumberChaptersSequential(list, (chapterId, newOrder) =>
      firestoreHelpers.updateDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId, "chapters", chapterId),
        { order: newOrder }
      )
    );
    setChapters(list);

    if (deletedOrder > 0) {
      const testSnap = await mcqGetDocs(
        mcqCollection(mcqDb, "copiedcourses", courseId, "assignments")
      );
      const tests = testSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      await remapProgressTestsAfterDayDelete(tests, deletedOrder, {
        deleteTest: (testId) =>
          mcqDeleteDoc(
            mcqDoc(mcqDb, "copiedcourses", courseId, "assignments", testId)
          ),
        updateTestDay: (testId, day, title) =>
          mcqUpdateDoc(
            mcqDoc(mcqDb, "copiedcourses", courseId, "assignments", testId),
            title ? { day, title } : { day }
          ),
      });
    }

    await fetchProgressTests();
  }

  async function toggleNonTechnical() {
    if (!courseId) return;
    const next = !course?.isNonTechnical;
    try {
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId),
        { isNonTechnical: next, updatedAt: new Date().toISOString() }
      );
      setCourse((c) => (c ? { ...c, isNonTechnical: next } : c));
    } catch (e) {
      console.error("Failed to update course:", e);
      alert("Failed to update.");
    }
  }

  function startEditCourseInfo() {
    setCourseInfoDraft({
      title: course?.title || "",
      courseCode: course?.courseCode || "",
      description: course?.description || "",
    });
    setEditingCourseInfo(true);
  }

  async function saveCourseInfo() {
    if (!courseId) return;
    try {
      setSavingCourseInfo(true);
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId),
        {
          title: (courseInfoDraft.title || "").trim(),
          courseCode: (courseInfoDraft.courseCode || "").trim(),
          description: (courseInfoDraft.description || "").trim(),
          updatedAt: new Date().toISOString(),
        }
      );
      setCourse((c) =>
        c
          ? {
              ...c,
              title: (courseInfoDraft.title || "").trim(),
              courseCode: (courseInfoDraft.courseCode || "").trim(),
              description: (courseInfoDraft.description || "").trim(),
            }
          : c
      );
      setEditingCourseInfo(false);
      alert("Course information updated.");
    } catch (e) {
      console.error("Failed to update course info:", e);
      alert("Failed to update course information.");
    } finally {
      setSavingCourseInfo(false);
    }
  }

  async function addProgressTestForDay(dayNumber, type) {
    if (!courseId) return;
    try {
      const ref = mcqCollection(mcqDb, "copiedcourses", courseId, "assignments");
      await mcqAddDoc(ref, {
        title:
          type === "coding"
            ? `Day ${dayNumber} Coding Test`
            : `Day ${dayNumber} MCQ Test`,
        dueDate: "",
        day: Number(dayNumber) || 1,
        type,
        questions: [],
      });
      await fetchProgressTests();
      alert(
        type === "coding"
          ? `Coding progress test created for Day ${dayNumber}.`
          : `MCQ progress test created for Day ${dayNumber}.`
      );
    } catch (e) {
      console.error("Failed to add progress test:", e);
      alert("Failed to add progress test.");
    }
  }

  async function assignCourseToCrt() {
    if (!selectedCrtId || !courseId) {
      alert("Please select a CRT program.");
      return;
    }
    try {
      setAssigning(true);
      const coursesCol = firestoreHelpers.collection(
        db,
        "crt",
        selectedCrtId,
        "courses"
      );

      // Check if already assigned
      const existingSnap = await firestoreHelpers.getDocs(coursesCol);
      const existingSourceIds = new Set(
        existingSnap.docs.map((d) => d.data().sourceCourseId).filter(Boolean)
      );

      if (existingSourceIds.has(courseId)) {
        alert("This course is already assigned to the selected CRT.");
        return;
      }

      // Get the master course data
      const masterCourseSnap = await firestoreHelpers.getDoc(
        firestoreHelpers.doc(db, "crtCourses", courseId)
      );

      if (masterCourseSnap.exists()) {
        const masterData = masterCourseSnap.data();
        // Create a copy of the course under this CRT
        await firestoreHelpers.addDoc(coursesCol, {
          title: masterData.title || "",
          description: masterData.description || "",
          courseCode: masterData.courseCode || "",
          syllabus: masterData.syllabus || [],
          sourceCourseId: courseId,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || null,
        });
        alert("Course assigned to CRT successfully!");
        router.push(`/Admin/crt/${selectedCrtId}/manage`);
      }
    } catch (e) {
      console.error("Failed to assign course:", e);
      alert("Failed to assign course to CRT.");
    } finally {
      setAssigning(false);
    }
  }

  function logout() {
    signOut(auth);
  }

  if (loading) return <div>Loading...</div>;
  if (!user || !canManageCourse) return <div>Access Denied</div>;
  if (!course) return <div>Course not found</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Course Syllabus Days</h1>
          <p className="text-sm text-slate-600">
            {course.title} - Add syllabus days and assign to CRT
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/Admin/crt"
            className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200"
          >
            Back
          </Link>
          <button
            onClick={logout}
            className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Chapters / Days</h2>
            </div>

            {chapters.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                No chapters added yet. Use the form below to add the first
                chapter.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedChapters.map((ch, chapterIndex) => {
                    const dayNumber = chapterIndex + 1;
                    const dayTests = progressTests.filter(
                      (t) => (t.day || 1) === dayNumber
                    );
                    const isExpanded = expandedChapterId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        className="border rounded-lg overflow-hidden bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChapterId((id) =>
                              id === ch.id ? null : ch.id
                            )
                          }
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
                        >
                          <span className="font-medium text-slate-800">
                            Day {dayNumber}
                            {ch.title ? `: ${ch.title}` : ""}
                          </span>
                          <span
                            className={`text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            aria-hidden
                          >
                            ▼
                          </span>
                        </button>

                        {isExpanded && (
                        <div className="p-3 space-y-3 border-t-0">
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="1"
                            className="w-20 border rounded-md px-2 py-1.5 text-sm"
                            value={ch.order}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, order: Number(e.target.value) }
                                    : x
                                )
                              )
                            }
                            placeholder="Day"
                          />
                          <input
                            type="text"
                            className="flex-1 border rounded-md px-3 py-1.5 text-sm"
                            value={ch.title || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, title: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Title"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <textarea
                            rows={3}
                            className="border rounded-md px-3 py-1.5 text-sm w-full min-h-[80px] resize-y md:col-span-2"
                            value={ch.topics || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, topics: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder={"e.g. This chapter covers:\nTopic one\nTopic two\n..."}
                          />
                          <input
                            className="border rounded-md px-3 py-1.5 text-sm"
                            value={ch.video || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, video: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Video URL"
                          />
                          <input
                            className="border rounded-md px-3 py-1.5 text-sm"
                            value={ch.pptUrl || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, pptUrl: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="PPT URL (Google Slides)"
                          />
                          <input
                            className="border rounded-md px-3 py-1.5 text-sm"
                            value={ch.pdfDocument || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, pdfDocument: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="PDF URL (Google Drive)"
                          />
                          <input
                            className="border rounded-md px-3 py-1.5 text-sm"
                            value={ch.liveClassLink || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, liveClassLink: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Live Class Link"
                          />
                          <input
                            className="border rounded-md px-3 py-1.5 text-sm"
                            value={ch.recordedClassLink || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? {
                                        ...x,
                                        recordedClassLink: e.target.value,
                                      }
                                    : x
                                )
                              )
                            }
                            placeholder="Recorded Class Link"
                          />
                          <input
                            className="border rounded-md px-3 py-1.5 text-sm md:col-span-2"
                            value={ch.classDocs || ""}
                            onChange={(e) =>
                              setChapters((cs) =>
                                cs.map((x) =>
                                  x.id === ch.id
                                    ? { ...x, classDocs: e.target.value }
                                    : x
                                )
                              )
                            }
                            placeholder="Docs URL"
                          />
                        </div>

                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={chapterSavingId === ch.id}
                            onClick={() => updateChapter(ch)}
                            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
                          >
                            {chapterSavingId === ch.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteChapter(ch.id)}
                            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-2 border-t border-slate-200 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-slate-800">
                              Progress Tests for Day {dayNumber}
                            </h4>
                          </div>
                          {loadingProgressTests ? (
                            <p className="text-xs text-slate-500">
                              Loading progress tests...
                            </p>
                          ) : dayTests.length === 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-500 italic">
                                No progress tests mapped to this day. You can
                                add one here:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    addProgressTestForDay(dayNumber, "mcq")
                                  }
                                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                                >
                                  + Add MCQ Test
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addProgressTestForDay(dayNumber, "coding")
                                  }
                                  className="px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs hover:bg-purple-700"
                                >
                                  + Add Coding Test
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {dayTests.map((test) => (
                                <div
                                  key={test.id}
                                  className="border rounded-md p-2 bg-slate-50"
                                >
                                  {editingTestId === test.id ? (
                                    <div className="space-y-2 text-xs">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <input
                                          className="border rounded-md px-2 py-1 text-xs"
                                          value={editingTest?.title || ""}
                                          onChange={(e) =>
                                            setEditingTest((s) => ({
                                              ...s,
                                              title: e.target.value,
                                            }))
                                          }
                                          placeholder="Title"
                                        />
                                        <input
                                          type="date"
                                          className="border rounded-md px-2 py-1 text-xs"
                                          value={editingTest?.dueDate || ""}
                                          onChange={(e) =>
                                            setEditingTest((s) => ({
                                              ...s,
                                              dueDate: e.target.value,
                                            }))
                                          }
                                        />
                                        <input
                                          type="number"
                                          className="border rounded-md px-2 py-1 text-xs"
                                          value={editingTest?.day || dayNumber}
                                          onChange={(e) =>
                                            setEditingTest((s) => ({
                                              ...s,
                                              day: Number(e.target.value) || 1,
                                            }))
                                          }
                                          placeholder="Day"
                                        />
                                        <select
                                          className="border rounded-md px-2 py-1 text-xs"
                                          value={editingTest?.type || "mcq"}
                                          onChange={(e) =>
                                            setEditingTest((s) => ({
                                              ...s,
                                              type: e.target.value,
                                            }))
                                          }
                                        >
                                          <option value="mcq">MCQ</option>
                                          <option value="coding">Coding</option>
                                        </select>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={saveProgressTestMeta}
                                          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingTestId(null);
                                            setEditingTest(null);
                                          }}
                                          className="px-3 py-1.5 rounded-md bg-slate-400 text-white text-xs"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1 text-xs">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                              Day {test.day || dayNumber}
                                            </span>
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                                              {test.type === "coding"
                                                ? "Coding"
                                                : "MCQ"}
                                            </span>
                                          </div>
                                          <p className="text-xs font-medium mt-1">
                                            {test.title ||
                                              test.name ||
                                              "Untitled Progress Test"}
                                          </p>
                                          {test.dueDate && (
                                            <p className="text-[11px] text-slate-500">
                                              Due: {test.dueDate}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingTestId(test.id);
                                              setEditingTest({
                                                title:
                                                  test.title ||
                                                  test.name ||
                                                  "",
                                                dueDate: test.dueDate || "",
                                                day: test.day || dayNumber,
                                                type: test.type || "mcq",
                                              });
                                            }}
                                            className="px-2 py-1 rounded-md bg-yellow-500 text-white text-[11px]"
                                          >
                                            Edit Meta
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              deleteProgressTest(test.id)
                                            }
                                            className="px-2 py-1 rounded-md bg-red-600 text-white text-[11px]"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>

                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (questionEditTestId === test.id) {
                                              setQuestionEditTestId(null);
                                              setQuestionDrafts([]);
                                              setMcqUploadPreview(null);
                                              setMcqUploadInfo("");
                                            } else {
                                              setQuestionEditTestId(test.id);
                                              setQuestionDrafts(
                                                Array.isArray(test.questions)
                                                  ? test.questions
                                                  : []
                                              );
                                              setMcqUploadPreview(null);
                                              setMcqUploadInfo("");
                                            }
                                          }}
                                          className="px-2 py-1 rounded-md bg-slate-200 text-slate-800 text-[11px]"
                                        >
                                          {questionEditTestId === test.id
                                            ? "Close Questions Editor"
                                            : "Edit / Add Questions"}
                                        </button>
                                      </div>

                                      {questionEditTestId === test.id && (
                                        <div className="mt-2 border-t pt-2 space-y-2">
                                          <p className="text-[11px] font-semibold text-slate-700">
                                            Questions ({questionDrafts.length})
                                          </p>

                                          {(test.type || "mcq") !== "coding" && (
                                            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-2">
                                              <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                  <p className="text-[11px] font-semibold text-emerald-900">
                                                    Upload CSV / Excel MCQs
                                                  </p>
                                                  <p className="mt-0.5 text-[10px] leading-relaxed text-emerald-800">
                                                    Required: question, option1,
                                                    option2, answer. Supports up
                                                    to option6. Answer may be
                                                    option text, A–F, or 1–6;
                                                    separate multiple answers
                                                    with commas.
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={downloadDayMcqSampleCsv}
                                                  className="rounded border border-emerald-300 bg-white px-2 py-1 text-[10px] text-emerald-800 hover:bg-emerald-100"
                                                >
                                                  Download sample CSV
                                                </button>
                                              </div>
                                              <input
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                disabled={mcqUploading}
                                                onChange={handleDayMcqFileChange}
                                                className="block w-full text-[11px] file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-emerald-600 file:px-2 file:py-1 file:text-[11px] file:text-white"
                                              />
                                              {mcqUploadInfo && (
                                                <p className="rounded border border-emerald-200 bg-white/80 px-2 py-1 text-[10px] text-emerald-900">
                                                  {mcqUploading
                                                    ? "Reading file..."
                                                    : mcqUploadInfo}
                                                </p>
                                              )}
                                              {mcqUploadPreview?.errors?.length >
                                                0 && (
                                                <ul className="max-h-20 list-disc overflow-y-auto pl-4 text-[10px] text-amber-800">
                                                  {mcqUploadPreview.errors
                                                    .slice(0, 8)
                                                    .map((message, index) => (
                                                      <li key={index}>
                                                        {message}
                                                      </li>
                                                    ))}
                                                </ul>
                                              )}
                                              {mcqUploadPreview?.questions
                                                ?.length > 0 && (
                                                <div className="space-y-2">
                                                  <p className="text-[10px] font-semibold text-slate-700">
                                                    Verify preview (
                                                    {
                                                      mcqUploadPreview.questions
                                                        .length
                                                    }
                                                    )
                                                  </p>
                                                  <div className="max-h-52 space-y-2 overflow-y-auto rounded border bg-white p-2">
                                                    {mcqUploadPreview.questions.map(
                                                      (question, index) => (
                                                        <div
                                                          key={index}
                                                          className="rounded border px-2 py-1.5 text-[10px]"
                                                        >
                                                          <p className="font-medium text-slate-800">
                                                            Q{index + 1}.{" "}
                                                            {question.question}
                                                          </p>
                                                          {question._uploadWarning && (
                                                            <p className="mt-0.5 text-amber-700">
                                                              {
                                                                question._uploadWarning
                                                              }
                                                            </p>
                                                          )}
                                                          <ul className="mt-1 space-y-0.5">
                                                            {question.options.map(
                                                              (option, optionIndex) => {
                                                                if (!option)
                                                                  return null;
                                                                const correct =
                                                                  question.correctAnswers.includes(
                                                                    optionIndex
                                                                  );
                                                                return (
                                                                  <li
                                                                    key={
                                                                      optionIndex
                                                                    }
                                                                    className={
                                                                      correct
                                                                        ? "font-semibold text-emerald-700"
                                                                        : "text-slate-600"
                                                                    }
                                                                  >
                                                                    {String.fromCharCode(
                                                                      65 +
                                                                        optionIndex
                                                                    )}
                                                                    . {option}
                                                                    {correct
                                                                      ? " ✓"
                                                                      : ""}
                                                                  </li>
                                                                );
                                                              }
                                                            )}
                                                          </ul>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                  <div className="flex flex-wrap gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        applyDayMcqUpload(
                                                          "append"
                                                        )
                                                      }
                                                      className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] text-white"
                                                    >
                                                      Append to editor
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (
                                                          questionDrafts.length &&
                                                          !confirm(
                                                            "Replace all current questions?"
                                                          )
                                                        )
                                                          return;
                                                        applyDayMcqUpload(
                                                          "replace"
                                                        );
                                                      }}
                                                      className="rounded-md bg-blue-600 px-2 py-1 text-[11px] text-white"
                                                    >
                                                      Replace all
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setMcqUploadPreview(null);
                                                        setMcqUploadInfo("");
                                                      }}
                                                      className="rounded-md bg-slate-400 px-2 py-1 text-[11px] text-white"
                                                    >
                                                      Cancel preview
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                            {questionDrafts.map((q, qIndex) => (
                                              <div
                                                key={qIndex}
                                                className="bg-white rounded border px-2 py-2 space-y-1"
                                              >
                                                <div className="flex justify-between items-center">
                                                  <span className="text-[11px] font-medium text-slate-800">
                                                    Q{qIndex + 1} •{" "}
                                                    {(q.type || test.type || "mcq").toUpperCase()}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const next = questionDrafts.filter(
                                                        (_qq, idx) => idx !== qIndex
                                                      );
                                                      setQuestionDrafts(next);
                                                    }}
                                                    className="text-[11px] text-red-600"
                                                  >
                                                    Remove
                                                  </button>
                                                </div>

                                                {(q.type || test.type) !== "coding" && (
                                                  <div className="space-y-1">
                                                    <textarea
                                                      className="border rounded px-2 py-1 w-full text-[11px]"
                                                      rows={2}
                                                      placeholder="Question text"
                                                      value={q.question || ""}
                                                      onChange={(e) => {
                                                        const next = [...questionDrafts];
                                                        next[qIndex] = {
                                                          ...next[qIndex],
                                                          type: "mcq",
                                                          question: e.target.value,
                                                        };
                                                        setQuestionDrafts(next);
                                                      }}
                                                    />
                                                    {q._uploadWarning && (
                                                      <p className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                                                        {q._uploadWarning}
                                                      </p>
                                                    )}
                                                    <p className="text-[10px] text-slate-500">
                                                      Options & correct answers:
                                                    </p>
                                                    {Array.from(
                                                      {
                                                        length: Math.min(
                                                          6,
                                                          Math.max(
                                                            4,
                                                            Array.isArray(
                                                              q.options
                                                            )
                                                              ? q.options.length
                                                              : 4
                                                          )
                                                        ),
                                                      },
                                                      (_, optIdx) =>
                                                        q.options?.[optIdx] ?? ""
                                                    ).map((opt, optIdx) => (
                                                      <div
                                                        key={optIdx}
                                                        className="flex items-center gap-1 mb-0.5"
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          className="w-3 h-3"
                                                          checked={Array.isArray(
                                                            q.correctAnswers
                                                          )
                                                            ? q.correctAnswers.includes(
                                                                optIdx
                                                              )
                                                            : false}
                                                          onChange={() => {
                                                            const next = [...questionDrafts];
                                                            const current =
                                                              Array.isArray(
                                                                next[qIndex]
                                                                  .correctAnswers
                                                              )
                                                                ? [
                                                                    ...next[qIndex]
                                                                      .correctAnswers,
                                                                  ]
                                                                : [];
                                                            const exists =
                                                              current.includes(
                                                                optIdx
                                                              );
                                                            next[qIndex] = {
                                                              ...next[qIndex],
                                                              type: "mcq",
                                                              correctAnswers: exists
                                                                ? current.filter(
                                                                    (i) => i !== optIdx
                                                                  )
                                                                : [...current, optIdx],
                                                              _uploadWarning: "",
                                                            };
                                                            setQuestionDrafts(next);
                                                          }}
                                                        />
                                                        <input
                                                          className="border rounded px-2 py-0.5 flex-1 text-[11px]"
                                                          placeholder={`Option ${
                                                            optIdx + 1
                                                          }`}
                                                          value={opt}
                                                          onChange={(e) => {
                                                            const next = [...questionDrafts];
                                                            const opts =
                                                              Array.isArray(
                                                                next[qIndex].options
                                                              )
                                                                ? [
                                                                    ...next[qIndex]
                                                                      .options,
                                                                  ]
                                                                : [];
                                                            opts[optIdx] =
                                                              e.target.value;
                                                            next[qIndex] = {
                                                              ...next[qIndex],
                                                              type: "mcq",
                                                              options: opts,
                                                            };
                                                            setQuestionDrafts(next);
                                                          }}
                                                        />
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}

                                                {(q.type || test.type) === "coding" && (
                                                  <div className="space-y-1">
                                                    <input
                                                      className="border rounded px-2 py-1 w-full text-[11px]"
                                                      placeholder="Coding question title"
                                                      value={q.question || ""}
                                                      onChange={(e) => {
                                                        const next = [...questionDrafts];
                                                        next[qIndex] = {
                                                          ...next[qIndex],
                                                          type: "coding",
                                                          question: e.target.value,
                                                        };
                                                        setQuestionDrafts(next);
                                                      }}
                                                    />
                                                    <textarea
                                                      className="border rounded px-2 py-1 w-full text-[11px] font-mono"
                                                      rows={3}
                                                      placeholder="Description"
                                                      value={q.description || ""}
                                                      onChange={(e) => {
                                                        const next = [...questionDrafts];
                                                        next[qIndex] = {
                                                          ...next[qIndex],
                                                          type: "coding",
                                                          description: e.target.value,
                                                        };
                                                        setQuestionDrafts(next);
                                                      }}
                                                    />
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                      Test cases:
                                                    </p>
                                                    {Array.isArray(q.testCases) &&
                                                      q.testCases.map(
                                                        (tc, tcIdx) => (
                                                          <div
                                                            key={tcIdx}
                                                            className="border rounded px-2 py-1 mb-1 bg-slate-50"
                                                          >
                                                            <p className="text-[10px] font-medium">
                                                              Test Case {tcIdx + 1}
                                                            </p>
                                                            <textarea
                                                              className="border rounded px-2 py-1 w-full text-[10px] font-mono mb-1"
                                                              rows={2}
                                                              placeholder="Input"
                                                              value={tc.input || ""}
                                                              onChange={(e) => {
                                                                const next = [...questionDrafts];
                                                                const tcs =
                                                                  Array.isArray(
                                                                    next[qIndex]
                                                                      .testCases
                                                                  )
                                                                    ? [
                                                                        ...next[
                                                                          qIndex
                                                                        ].testCases,
                                                                      ]
                                                                    : [];
                                                                tcs[tcIdx] = {
                                                                  ...tcs[tcIdx],
                                                                  input:
                                                                    e.target
                                                                      .value,
                                                                };
                                                                next[qIndex] = {
                                                                  ...next[qIndex],
                                                                  type: "coding",
                                                                  testCases: tcs,
                                                                };
                                                                setQuestionDrafts(
                                                                  next
                                                                );
                                                              }}
                                                            />
                                                            <textarea
                                                              className="border rounded px-2 py-1 w-full text-[10px] font-mono"
                                                              rows={2}
                                                              placeholder="Expected Output"
                                                              value={
                                                                tc.expectedOutput ||
                                                                ""
                                                              }
                                                              onChange={(e) => {
                                                                const next = [...questionDrafts];
                                                                const tcs =
                                                                  Array.isArray(
                                                                    next[qIndex]
                                                                      .testCases
                                                                  )
                                                                    ? [
                                                                        ...next[
                                                                          qIndex
                                                                        ].testCases,
                                                                      ]
                                                                    : [];
                                                                tcs[tcIdx] = {
                                                                  ...tcs[tcIdx],
                                                                  expectedOutput:
                                                                    e.target
                                                                      .value,
                                                                };
                                                                next[qIndex] = {
                                                                  ...next[qIndex],
                                                                  type: "coding",
                                                                  testCases: tcs,
                                                                };
                                                                setQuestionDrafts(
                                                                  next
                                                                );
                                                              }}
                                                            />
                                                          </div>
                                                        )
                                                      )}
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const next = [...questionDrafts];
                                                        const tcs =
                                                          Array.isArray(
                                                            next[qIndex].testCases
                                                          )
                                                            ? [
                                                                ...next[qIndex]
                                                                  .testCases,
                                                              ]
                                                            : [];
                                                        tcs.push({
                                                          input: "",
                                                          expectedOutput: "",
                                                        });
                                                        next[qIndex] = {
                                                          ...next[qIndex],
                                                          type: "coding",
                                                          testCases: tcs,
                                                        };
                                                        setQuestionDrafts(next);
                                                      }}
                                                      className="mt-1 px-2 py-0.5 rounded-md bg-blue-500 text-white text-[10px]"
                                                    >
                                                      Add Test Case
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>

                                          <div className="flex gap-2 mt-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setQuestionDrafts((prev) => [
                                                  ...prev,
                                                  {
                                                    type: "mcq",
                                                    question: "",
                                                    options: ["", "", "", ""],
                                                    correctAnswers: [],
                                                  },
                                                ]);
                                              }}
                                              className="px-2 py-1 rounded-md bg-green-500 text-white text-[11px]"
                                            >
                                              + MCQ Question
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setQuestionDrafts((prev) => [
                                                  ...prev,
                                                  {
                                                    type: "coding",
                                                    question: "",
                                                    description: "",
                                                    testCases: [],
                                                  },
                                                ]);
                                              }}
                                              className="px-2 py-1 rounded-md bg-purple-500 text-white text-[11px]"
                                            >
                                              + Coding Question
                                            </button>
                                            <button
                                              type="button"
                                              onClick={saveTestQuestions}
                                              className="ml-auto px-3 py-1.5 rounded-md bg-emerald-600 text-white text-[11px]"
                                            >
                                              Save All Questions
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <form
              onSubmit={addChapter}
              className="mt-6 border-t pt-4 space-y-3"
            >
              <h4 className="font-medium">Add Chapter</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.title}
                  onChange={(e) =>
                    setNewChapter((s) => ({ ...s, title: e.target.value }))
                  }
                  placeholder="Title"
                />
                <textarea
                  rows={3}
                  className="border rounded-md px-3 py-2 text-sm w-full min-h-[80px] resize-y md:col-span-2"
                  value={newChapter.topics}
                  onChange={(e) =>
                    setNewChapter((s) => ({ ...s, topics: e.target.value }))
                  }
                  placeholder={"e.g. This chapter covers:\nTopic one\nTopic two\n..."}
                />
                <input
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.video}
                  onChange={(e) =>
                    setNewChapter((s) => ({ ...s, video: e.target.value }))
                  }
                  placeholder="Video URL"
                />
                <input
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.pptUrl}
                  onChange={(e) =>
                    setNewChapter((s) => ({ ...s, pptUrl: e.target.value }))
                  }
                  placeholder="PPT URL (Google Slides)"
                />
                <input
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.pdfDocument}
                  onChange={(e) =>
                    setNewChapter((s) => ({
                      ...s,
                      pdfDocument: e.target.value,
                    }))
                  }
                  placeholder="PDF URL (Google Drive)"
                />
                <input
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.liveClassLink}
                  onChange={(e) =>
                    setNewChapter((s) => ({
                      ...s,
                      liveClassLink: e.target.value,
                    }))
                  }
                  placeholder="Live Class Link"
                />
                <input
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.recordedClassLink}
                  onChange={(e) =>
                    setNewChapter((s) => ({
                      ...s,
                      recordedClassLink: e.target.value,
                    }))
                  }
                  placeholder="Recorded Class Link"
                />
                <input
                  className="border rounded-md px-3 py-2 text-sm md:col-span-2"
                  value={newChapter.classDocs}
                  onChange={(e) =>
                    setNewChapter((s) => ({
                      ...s,
                      classDocs: e.target.value,
                    }))
                  }
                  placeholder="Docs URL"
                />
                <input
                  type="number"
                  className="border rounded-md px-3 py-2 text-sm"
                  value={newChapter.order}
                  onChange={(e) =>
                    setNewChapter((s) => ({
                      ...s,
                      order: Number(e.target.value),
                    }))
                  }
                  placeholder="Day / Order"
                />
              </div>
              <div>
                <button
                  disabled={chapterSavingId === "new"}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50 text-sm"
                >
                  {chapterSavingId === "new" ? "Adding..." : "Add Chapter"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-4">Assign to CRT</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600 mb-2 block">
                  Select CRT Program
                </label>
                <select
                  value={selectedCrtId}
                  onChange={(e) => setSelectedCrtId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="">Choose CRT...</option>
                  {crts.map((crt) => (
                    <option key={crt.id} value={crt.id}>
                      {crt.name || crt.id}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={assignCourseToCrt}
                disabled={!selectedCrtId || assigning}
                className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Assign Course to CRT"}
              </button>
              {selectedCrtId && (
                <Link
                  href={`/Admin/crt/${selectedCrtId}/manage`}
                  className="block text-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Manage CRT Courses
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Course Information</h2>
              {!editingCourseInfo ? (
                <button
                  type="button"
                  onClick={startEditCourseInfo}
                  className="px-3 py-1.5 rounded-md bg-amber-500 text-white text-sm hover:bg-amber-600"
                >
                  Edit
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {editingCourseInfo ? (
                <>
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Title</label>
                    <input
                      type="text"
                      value={courseInfoDraft.title}
                      onChange={(e) =>
                        setCourseInfoDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Course title"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Course Code</label>
                    <input
                      type="text"
                      value={courseInfoDraft.courseCode}
                      onChange={(e) =>
                        setCourseInfoDraft((d) => ({ ...d, courseCode: e.target.value }))
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Course code"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={courseInfoDraft.description}
                      onChange={(e) =>
                        setCourseInfoDraft((d) => ({ ...d, description: e.target.value }))
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm resize-y"
                      placeholder="Course description"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={saveCourseInfo}
                      disabled={savingCourseInfo}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingCourseInfo ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCourseInfo(false)}
                      disabled={savingCourseInfo}
                      className="px-3 py-1.5 rounded-md bg-slate-400 text-white text-sm hover:bg-slate-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm text-slate-600">Title</label>
                    <div className="text-base font-medium">{course.title}</div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Course Code</label>
                    <div className="text-base">{course.courseCode || "N/A"}</div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Description</label>
                    <div className="text-base text-slate-700">
                      {course.description || "No description"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Subject type</label>
                    <div className="text-base mt-0.5">
                      {course.isNonTechnical === true ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800">
                          Non-technical (Aptitude &amp; Soft Skills)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#00448a]/10 px-2.5 py-0.5 text-sm font-medium text-[#00448a]">
                          Technical subjects
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
              <div className="pt-4 mt-4 border-t border-slate-200">
                <div className="flex items-start gap-3">
                  <input
                    id="course-non-technical"
                    type="checkbox"
                    checked={course.isNonTechnical === true}
                    onChange={toggleNonTechnical}
                    className="mt-1 w-5 h-5 min-w-[1.25rem] min-h-[1.25rem] rounded border-2 border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="course-non-technical" className="text-sm font-medium text-slate-700 cursor-pointer block">
                      Non-technical (Aptitude &amp; Soft Skills)
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When checked, this course is treated as common/non-technical in CRT programmes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold mb-2 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/Admin/crt"
                className="block w-full text-center px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
              >
                Back to CRT Manager
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
