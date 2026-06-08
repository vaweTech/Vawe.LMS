"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp, updateDoc, query, where, arrayUnion } from "firebase/firestore";
import CheckTrainerAuth from "@/lib/CheckTrainerAuth";

export default function TrainerHome() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [internships, setInternships] = useState([]);
  const [students, setStudents] = useState([]);
  const [allowedClasses, setAllowedClasses] = useState([]);
  const [allowedInternships, setAllowedInternships] = useState([]);
  const [selectedInternshipId, setSelectedInternshipId] = useState("");
  const [internshipCourses, setInternshipCourses] = useState([]);
  const [internshipChapters, setInternshipChapters] = useState([]);
  const [selectedInternshipCourseForUnlock, setSelectedInternshipCourseForUnlock] = useState(null);
  const [selectedInternshipChapters, setSelectedInternshipChapters] = useState([]);
  const [showInternshipChapterModal, setShowInternshipChapterModal] = useState(false);
  const [internshipStudents, setInternshipStudents] = useState([]);
  const [showInternshipAttendanceModal, setShowInternshipAttendanceModal] = useState(false);
  const [internshipAttendanceCourse, setInternshipAttendanceCourse] = useState(null);
  const [internshipAttendanceChapterId, setInternshipAttendanceChapterId] = useState("");
  const [internshipAttendanceSelectedIds, setInternshipAttendanceSelectedIds] = useState([]);
  const [internshipAttendanceSaving, setInternshipAttendanceSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classCourses, setClassCourses] = useState([]);
  const [unlockStatus, setUnlockStatus] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedCourseForUnlock, setSelectedCourseForUnlock] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [unlockStudents, setUnlockStudents] = useState(false);
  const [unlockInternshipStudents, setUnlockInternshipStudents] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceCourse, setAttendanceCourse] = useState(null);
  const [attendanceChapterId, setAttendanceChapterId] = useState("");
  const [attendanceSelectedIds, setAttendanceSelectedIds] = useState([]);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [showClassDocumentsModal, setShowClassDocumentsModal] = useState(false);
  const [classDocumentsCourse, setClassDocumentsCourse] = useState(null);
  const [classChapterDocuments, setClassChapterDocuments] = useState({}); // chapterId -> document URL
  const [classDocumentsSaving, setClassDocumentsSaving] = useState(false);
  const [showInternshipDocumentsModal, setShowInternshipDocumentsModal] = useState(false);
  const [internshipDocumentsCourse, setInternshipDocumentsCourse] = useState(null);
  const [chapterDocuments, setChapterDocuments] = useState({}); // chapterId -> document URL
  const [documentsSaving, setDocumentsSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUserId(u.uid);
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const data = uSnap.exists() ? uSnap.data() : {};
      setAllowedClasses(data.trainerClasses || []);
      setAllowedInternships(data.trainerInternships || []);
      // Trainer-level course assignment not used for class view

      const [cSnap, crSnap, iSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "internships")),
      ]);
      setClasses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const allCourses = crSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCourses(allCourses);
      setInternships(iSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Load all students once for attendance
      try {
        const sSnap = await getDocs(collection(db, "students"));
        setStudents(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (_) {}
      // Do not auto-select a class; require explicit click
    });
    return () => unsub();
  }, []);

  // Load class-based courses after selecting a class
  useEffect(() => {
    async function loadClassCourses() {
      if (!selectedClassId) { setClassCourses([]); return; }
      try {
        const cRef = doc(db, 'classes', selectedClassId);
        const cSnap = await getDoc(cRef);
        if (!cSnap.exists()) { setClassCourses([]); return; }
        const cData = cSnap.data() || {};
        const ids = Array.isArray(cData.courseIds) ? cData.courseIds : [];
        const titles = Array.isArray(cData.courseTitles) ? cData.courseTitles : [];
        const byId = new Map(courses.map((x) => [x.id, x]));
        const list = ids.map((id, idx) => {
          const found = byId.get(id);
          return found ? found : { id, title: titles[idx] || cData.name || id };
        });
        setClassCourses(list);
      } catch {
        setClassCourses([]);
      }
    }
    loadClassCourses();
  }, [selectedClassId, courses]);

  // Load internship courses and students when an internship is selected
  useEffect(() => {
    async function loadInternshipData() {
      if (!selectedInternshipId) {
        setInternshipCourses([]);
        setInternshipStudents([]);
        setInternshipChapters([]);
        return;
      }
      try {
        const [cSnap, sSnap] = await Promise.all([
          getDocs(collection(db, "internships", selectedInternshipId, "courses")),
          getDocs(collection(db, "internships", selectedInternshipId, "students")),
        ]);
        setInternshipCourses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setInternshipStudents(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error loading internship data:", error);
        setInternshipCourses([]);
        setInternshipStudents([]);
      }
    }
    loadInternshipData();
  }, [selectedInternshipId]);

  // Load chapters for an internship course
  const loadInternshipChapters = async (internshipId, courseId, preselectUnlocked = false) => {
    if (!internshipId || !courseId) {
      setInternshipChapters([]);
      setSelectedInternshipChapters([]);
      return;
    }
    try {
      const snap = await getDocs(
        collection(db, "internships", internshipId, "courses", courseId, "chapters")
      );
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return 0;
      });
      setInternshipChapters(items);
      // Optionally preselect chapters that are already unlocked for internship students
      if (preselectUnlocked && internshipStudents.length > 0) {
        try {
          // Take the first internship student and read their chapterAccess for this course
          const first = internshipStudents.find(
            (s) => typeof s.studentId === "string" && s.studentId.length > 0
          );
          if (first) {
            const sSnap = await getDoc(doc(db, "students", first.studentId));
            if (sSnap.exists()) {
              const data = sSnap.data() || {};
              const access = data.chapterAccess || {};
              const unlocked = Array.isArray(access[courseId]) ? access[courseId] : [];
              setSelectedInternshipChapters(unlocked);
            } else {
              setSelectedInternshipChapters([]);
            }
          } else {
            setSelectedInternshipChapters([]);
          }
        } catch (e) {
          console.error("Error preselecting internship unlocked chapters:", e);
          setSelectedInternshipChapters([]);
        }
      } else {
        setSelectedInternshipChapters([]);
      }
    } catch (error) {
      console.error("Error loading internship chapters:", error);
      setInternshipChapters([]);
      setSelectedInternshipChapters([]);
    }
  };

  // Load chapters for a course
  const loadChapters = async (courseId) => {
    if (!courseId) {
      setChapters([]);
      setSelectedChapters([]);
      return;
    }
    try {
      const snap = await getDocs(collection(db, "courses", courseId, "chapters"));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return 0;
      });
      setChapters(items);

      // Preselect chapters that were already unlocked by this trainer today for this course
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (userId) {
        const trainerKey = `trainer:${userId}`;
        const unlocksCol = collection(db, 'unlocks');
        const qUnlocked = query(unlocksCol, where('key', '==', trainerKey), where('courseId', '==', courseId), where('date', '==', ymd));
        const unlockedSnap = await getDocs(qUnlocked);
        const unlockedChapterIds = unlockedSnap.docs
          .map((d) => d.data()?.chapterId)
          .filter(Boolean);
        setSelectedChapters(unlockedChapterIds);
      } else {
        setSelectedChapters([]);
      }
    } catch (error) {
      console.error("Error loading chapters:", error);
      setChapters([]);
    }
  };

  // Unlock functionality
  const unlockToday = async (courseId = null) => {
    setUnlockLoading(true);
    setUnlockStatus("");
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      
      const classKey = selectedClassId ? `class:${selectedClassId}` : null;
      const courseKey = courseId ? `course:${courseId}` : null;
      const trainerKey = userId ? `trainer:${userId}` : null;

      if (courseId && selectedChapters.length > 0) {
        // Unlock specific chapters for class, course and trainer
        for (const chId of selectedChapters) {
          if (unlockStudents && classKey) {
            const ref = doc(db, "unlocks", `${classKey}|chapter:${chId}|${ymd}`);
            await setDoc(ref, { key: classKey, chapterId: chId, date: ymd, createdAt: serverTimestamp() }, { merge: true });
          }
          if (unlockStudents && courseKey) {
            const ref = doc(db, "unlocks", `${courseKey}|chapter:${chId}|${ymd}`);
            await setDoc(ref, { key: courseKey, chapterId: chId, date: ymd, createdAt: serverTimestamp() }, { merge: true });
          }
          if (trainerKey) {
            const ref = doc(db, "unlocks", `${trainerKey}|course:${courseId}|chapter:${chId}|${ymd}`);
            await setDoc(ref, { key: trainerKey, courseId, chapterId: chId, date: ymd, createdAt: serverTimestamp() }, { merge: true });
          }
        }

        // Also write per-student chapterAccess when unlocking chapters
        if (unlockStudents && selectedClassId && courseId) {
          // Fetch students in this class by both schemas (classId and classIds contains)
          const studentsCol = collection(db, 'students');
          const q1 = query(studentsCol, where('classId', '==', selectedClassId));
          const q2 = query(studentsCol, where('classIds', 'array-contains', selectedClassId));
          const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          const seen = new Set();
          const studentDocs = [];
          [...s1.docs, ...s2.docs].forEach((d) => { if (!seen.has(d.id)) { seen.add(d.id); studentDocs.push(d); } });

          // Update each student's chapterAccess for the selected course
          const updates = [];
          for (const sd of studentDocs) {
            const sRef = doc(db, 'students', sd.id);
            for (const chId of selectedChapters) {
              updates.push(updateDoc(sRef, { [`chapterAccess.${courseId}`]: arrayUnion(chId) }));
            }
          }
          // Run updates in parallel and fail if any fails
          await Promise.all(updates);

          // Set due dates for progress tests associated with unlocked chapters (3 days from today)
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + 3);
          const dueDateString = dueDate.toISOString().split('T')[0];
          
          // Get all chapters to map chapter IDs to their order
          const chaptersSnap = await getDocs(collection(db, 'courses', courseId, 'chapters'));
          const chapterMap = new Map();
          chaptersSnap.docs.forEach(doc => {
            const data = doc.data();
            chapterMap.set(doc.id, data.order || 0);
          });

          // Get all assignments for this course
          const assignmentsSnap = await getDocs(collection(db, 'courses', courseId, 'assignments'));
          
          // Update due dates for assignments matching the unlocked chapters
          const assignmentUpdates = [];
          for (const assignmentDoc of assignmentsSnap.docs) {
            const assignmentData = assignmentDoc.data();
            const assignmentDay = assignmentData.day || 1;
            
            // Check if this assignment corresponds to any of the unlocked chapters
            for (const chId of selectedChapters) {
              const chapterOrder = chapterMap.get(chId);
              if (chapterOrder === assignmentDay) {
                const assignmentRef = doc(db, 'courses', courseId, 'assignments', assignmentDoc.id);
                assignmentUpdates.push(
                  updateDoc(assignmentRef, { dueDate: dueDateString, unlockDate: ymd })
                );
                break;
              }
            }
          }
          
          if (assignmentUpdates.length > 0) {
            await Promise.all(assignmentUpdates);
          }
        }
        setUnlockStatus(`Unlocked ${selectedChapters.length} chapters for today.`);
      } else {
        // Unlock entire day for class, and also mark course and trainer if provided
        if (unlockStudents && classKey) {
          const ref = doc(db, "unlocks", `${classKey}|${ymd}`);
          await setDoc(ref, { key: classKey, date: ymd, createdAt: serverTimestamp() }, { merge: true });
        }
        if (unlockStudents && courseKey) {
          const ref = doc(db, "unlocks", `${courseKey}|${ymd}`);
          await setDoc(ref, { key: courseKey, date: ymd, createdAt: serverTimestamp() }, { merge: true });
        }
        if (trainerKey) {
          const ref = doc(db, "unlocks", `${trainerKey}${courseId ? `|course:${courseId}` : ""}|${ymd}`);
          await setDoc(ref, { key: trainerKey, ...(courseId ? { courseId } : {}), date: ymd, createdAt: serverTimestamp() }, { merge: true });
        }

        // If a course is provided and students should be unlocked, give students access to all chapters
        if (unlockStudents && selectedClassId && courseId) {
          try {
            const chaptersSnap = await getDocs(collection(db, 'courses', courseId, 'chapters'));
            const chapterIds = chaptersSnap.docs.map((d) => d.id);
            const studentsCol = collection(db, 'students');
            const q1 = query(studentsCol, where('classId', '==', selectedClassId));
            const q2 = query(studentsCol, where('classIds', 'array-contains', selectedClassId));
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const seen = new Set();
            const studentDocs = [];
            [...s1.docs, ...s2.docs].forEach((d) => { if (!seen.has(d.id)) { seen.add(d.id); studentDocs.push(d); } });
            const updates = [];
            for (const sd of studentDocs) {
              const sRef = doc(db, 'students', sd.id);
              for (const chId of chapterIds) {
                updates.push(updateDoc(sRef, { [`chapterAccess.${courseId}`]: arrayUnion(chId) }));
              }
            }
            await Promise.all(updates);

            // Set due dates for all progress tests (3 days from today)
            const dueDate = new Date(today);
            dueDate.setDate(dueDate.getDate() + 3);
            const dueDateString = dueDate.toISOString().split('T')[0];
            
            // Update all assignments for this course
            const assignmentsSnap = await getDocs(collection(db, 'courses', courseId, 'assignments'));
            const assignmentUpdates = assignmentsSnap.docs.map(assignmentDoc => {
              const assignmentRef = doc(db, 'courses', courseId, 'assignments', assignmentDoc.id);
              return updateDoc(assignmentRef, { dueDate: dueDateString, unlockDate: ymd });
            });
            
            if (assignmentUpdates.length > 0) {
              await Promise.all(assignmentUpdates);
            }
          } catch (e) {
            throw e;
          }
        }
        setUnlockStatus("Unlocked for today.");
      }
    } catch (error) {
      setUnlockStatus(error.message || "Failed to unlock");
    } finally {
      setUnlockLoading(false);
    }
  };

  // Handle class unlock
  // Handle course unlock
  const handleCourseUnlock = async (course) => {
    if (!selectedClassId) {
      setUnlockStatus('Please select a class first.');
      return;
    }
    setSelectedCourseForUnlock(course);
    await loadChapters(course.id);
    setShowChapterModal(true);
  };

  // Handle chapter selection and unlock
  const handleChapterUnlock = async () => {
    if (selectedCourseForUnlock) {
      await unlockToday(selectedCourseForUnlock.id);
      setShowChapterModal(false);
      setSelectedChapters([]);
      setSelectedCourseForUnlock(null);
    }
  };

  // Load existing attendance from Firebase when chapter is selected (so it persists after refresh)
  useEffect(() => {
    if (!attendanceCourse || !attendanceChapterId || !selectedClassId) return;
    const loadExistingAttendance = async () => {
      try {
        const today = new Date();
        const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const key = `class:${selectedClassId}|course:${attendanceCourse.id}|chapter:${attendanceChapterId}|${ymd}`;
        const ref = doc(db, "attendance", key);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().type === "trainer" && Array.isArray(snap.data().present)) {
          setAttendanceSelectedIds(snap.data().present);
        } else {
          setAttendanceSelectedIds([]);
        }
      } catch (e) {
        setAttendanceSelectedIds([]);
      }
    };
    loadExistingAttendance();
  }, [attendanceCourse, attendanceChapterId, selectedClassId]);

  // Attendance helpers
  const openAttendanceForCourse = async (course) => {
    if (!selectedClassId) {
      setUnlockStatus('Please select a class first.');
      return;
    }
    setAttendanceCourse(course);
    // Load chapters for this course into existing chapters state
    await loadChapters(course.id);
    setAttendanceChapterId("");
    setAttendanceSelectedIds([]);
    setShowAttendanceModal(true);
  };

  const toggleAttendanceStudent = (studentId) => {
    setAttendanceSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const saveAttendance = async () => {
    if (!attendanceCourse || !attendanceChapterId || !selectedClassId) {
      alert("Select a chapter and class first.");
      return;
    }
    setAttendanceSaving(true);
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const key = `class:${selectedClassId}|course:${attendanceCourse.id}|chapter:${attendanceChapterId}|${ymd}`;
      const ref = doc(db, "attendance", key);
      await setDoc(
        ref,
        {
          type: "trainer",
          classId: selectedClassId,
          courseId: attendanceCourse.id,
          chapterId: attendanceChapterId,
          date: ymd,
          present: attendanceSelectedIds,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      setShowAttendanceModal(false);
      setAttendanceCourse(null);
      setAttendanceChapterId("");
      setAttendanceSelectedIds([]);
      alert("Attendance saved.");
    } catch (e) {
      alert(e?.message || "Failed to save attendance");
    } finally {
      setAttendanceSaving(false);
    }
  };

  // Open a 5-minute self-attendance window (students can mark themselves)
  const giveAttendanceWindow = async () => {
    if (!attendanceCourse || !attendanceChapterId || !selectedClassId) {
      alert("Select a chapter and class first.");
      return;
    }
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const key = `window:class:${selectedClassId}|course:${attendanceCourse.id}|chapter:${attendanceChapterId}|${ymd}`;
      const ref = doc(db, "attendance", key);
      await setDoc(ref, {
        type: "window",
        classId: selectedClassId,
        courseId: attendanceCourse.id,
        chapterId: attendanceChapterId,
        date: ymd,
        openedAt: serverTimestamp(),
        durationMs: 5 * 60 * 1000,
      }, { merge: true });
      alert("Self attendance enabled for 5 minutes for this day.");
      // Keep modal open so trainer can also save later if needed
    } catch (e) {
      alert(e?.message || "Failed to enable self attendance window");
    }
  };

  // Open documents management modal for class course
  const openClassDocumentsForCourse = async (course) => {
    if (!selectedClassId) {
      setUnlockStatus("Please select a class first.");
      return;
    }
    setClassDocumentsCourse(course);
    await loadChapters(course.id);

    // Load current documents for all chapters
    const docsMap = {};
    try {
      const chaptersSnap = await getDocs(collection(db, "courses", course.id, "chapters"));
      chaptersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.referenceDocument) {
          docsMap[d.id] = data.referenceDocument;
        }
      });
    } catch (e) {
      console.error("Error loading class chapter documents:", e);
    }
    setClassChapterDocuments(docsMap);
    setShowClassDocumentsModal(true);
  };

  // Save documents for all class course chapters
  const saveClassDocuments = async () => {
    if (!classDocumentsCourse) {
      alert("Select class and course first.");
      return;
    }
    setClassDocumentsSaving(true);
    try {
      const updates = [];
      for (const [chapterId, docUrl] of Object.entries(classChapterDocuments)) {
        const chapterRef = doc(db, "courses", classDocumentsCourse.id, "chapters", chapterId);
        if (docUrl && docUrl.trim()) {
          updates.push(updateDoc(chapterRef, { referenceDocument: docUrl.trim() }));
        } else {
          updates.push(updateDoc(chapterRef, { referenceDocument: null }));
        }
      }
      await Promise.all(updates);
      alert("Documents saved successfully.");
      setShowClassDocumentsModal(false);
      setClassDocumentsCourse(null);
      setClassChapterDocuments({});
    } catch (e) {
      alert(e?.message || "Failed to save documents");
    } finally {
      setClassDocumentsSaving(false);
    }
  };

  // Internship: open chapter unlock modal for a course
  const handleInternshipCourseUnlock = async (course) => {
    if (!selectedInternshipId) {
      setUnlockStatus("Please select an internship first.");
      return;
    }
    setSelectedInternshipCourseForUnlock(course);
    // Load chapters and preselect ones already unlocked for this internship course
    await loadInternshipChapters(selectedInternshipId, course.id, true);
    setShowInternshipChapterModal(true);
  };

  // Internship: unlock selected chapters for all students in this internship
  const handleInternshipChapterUnlock = async () => {
    if (!selectedInternshipId || !selectedInternshipCourseForUnlock) {
      setUnlockStatus("Select an internship and course first.");
      return;
    }
    setUnlockLoading(true);
    setUnlockStatus("");
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate()
      ).padStart(2, "0")}`;

      const studentIds = internshipStudents
        .map((s) => s.studentId)
        .filter((x) => typeof x === "string" && x.length > 0);

      const internshipKey = `internship:${selectedInternshipId}`;
      const courseKey = `course:${selectedInternshipCourseForUnlock.id}`;
      const trainerKey = userId ? `trainer:${userId}` : null;

      if (selectedInternshipChapters.length > 0) {
        // Unlock specific chapters for internship, course and trainer
        // First, remove any existing unlock docs for this trainer+internship+course+today
        if (trainerKey) {
          const existingQ = query(
            collection(db, "unlocks"),
            where("key", "==", trainerKey),
            where("internshipId", "==", selectedInternshipId),
            where("courseId", "==", selectedInternshipCourseForUnlock.id),
            where("date", "==", ymd)
          );
          const existingSnap = await getDocs(existingQ);
          await Promise.all(existingSnap.docs.map((d) => setDoc(d.ref, {}, { merge: false })));
        }

        for (const chId of selectedInternshipChapters) {
          if (unlockInternshipStudents && internshipKey) {
            const ref = doc(db, "unlocks", `${internshipKey}|chapter:${chId}|${ymd}`);
            await setDoc(ref, { 
              key: internshipKey, 
              internshipId: selectedInternshipId,
              chapterId: chId, 
              date: ymd, 
              createdAt: serverTimestamp() 
            }, { merge: true });
          }
          if (unlockInternshipStudents && courseKey) {
            const ref = doc(db, "unlocks", `${courseKey}|chapter:${chId}|${ymd}`);
            await setDoc(ref, { 
              key: courseKey, 
              chapterId: chId, 
              date: ymd, 
              createdAt: serverTimestamp() 
            }, { merge: true });
          }
          if (trainerKey) {
            const ref = doc(
              db,
              "unlocks",
              `${trainerKey}|internship:${selectedInternshipId}|course:${selectedInternshipCourseForUnlock.id}|chapter:${chId}|${ymd}`
            );
            await setDoc(
              ref,
              {
                key: trainerKey,
                internshipId: selectedInternshipId,
                courseId: selectedInternshipCourseForUnlock.id,
                chapterId: chId,
                date: ymd,
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        // Update student chapterAccess when unlocking chapters:
        // overwrite with exactly the selected chapters (so unselected days become locked)
        if (studentIds.length > 0) {
          const updates = [];
          for (const sid of studentIds) {
            const sRef = doc(db, "students", sid);
            updates.push(
              updateDoc(sRef, {
                [`chapterAccess.${selectedInternshipCourseForUnlock.id}`]:
                  selectedInternshipChapters,
              })
            );
          }
          if (updates.length > 0) {
            await Promise.all(updates);
          }
        }
        setUnlockStatus(
          `Unlocked ${selectedInternshipChapters.length} chapters for internship${unlockInternshipStudents ? ' and students' : ''} on ${ymd}.`
        );
      } else {
        // Save empty unlock record for internship, course and trainer
        if (unlockInternshipStudents && internshipKey) {
          const ref = doc(db, "unlocks", `${internshipKey}|${ymd}`);
          await setDoc(ref, { 
            key: internshipKey, 
            internshipId: selectedInternshipId,
            date: ymd, 
            createdAt: serverTimestamp() 
          }, { merge: true });
        }
        if (unlockInternshipStudents && courseKey) {
          const ref = doc(db, "unlocks", `${courseKey}|${ymd}`);
          await setDoc(ref, { 
            key: courseKey, 
            date: ymd, 
            createdAt: serverTimestamp() 
          }, { merge: true });
        }
        if (trainerKey) {
          const ref = doc(db, "unlocks", `${trainerKey}|internship:${selectedInternshipId}|course:${selectedInternshipCourseForUnlock.id}|${ymd}`);
          await setDoc(ref, { 
            key: trainerKey, 
            internshipId: selectedInternshipId,
            courseId: selectedInternshipCourseForUnlock.id, 
            date: ymd, 
            createdAt: serverTimestamp() 
          }, { merge: true });
        }
        // Clear all chapterAccess for this internship course for all internship students (lock all)
        if (studentIds.length > 0) {
          const updates = [];
          for (const sid of studentIds) {
            const sRef = doc(db, "students", sid);
            // Reset the chapterAccess for this internship course to an empty array (locked)
            updates.push(
              updateDoc(sRef, {
                [`chapterAccess.${selectedInternshipCourseForUnlock.id}`]: []
              })
            );
          }
          if (updates.length > 0) {
            await Promise.all(updates);
          }
        }
        setUnlockStatus(`All chapters locked for this internship course on ${ymd}.`);
      }
      setShowInternshipChapterModal(false);
      setSelectedInternshipChapters([]);
      setSelectedInternshipCourseForUnlock(null);
    } catch (error) {
      console.error("Failed to unlock internship chapters:", error);
      setUnlockStatus(error?.message || "Failed to unlock internship chapters.");
    } finally {
      setUnlockLoading(false);
    }
  };

  // Load existing internship attendance from Firebase when chapter is selected
  useEffect(() => {
    if (!selectedInternshipId || !internshipAttendanceCourse || !internshipAttendanceChapterId) return;
    const loadExistingInternshipAttendance = async () => {
      try {
        const today = new Date();
        const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const key = `internship:${selectedInternshipId}|course:${internshipAttendanceCourse.id}|chapter:${internshipAttendanceChapterId}|${ymd}`;
        const ref = doc(db, "attendance", key);
        const snap = await getDoc(ref);
        if (snap.exists() && Array.isArray(snap.data().present)) {
          setInternshipAttendanceSelectedIds(snap.data().present);
        } else {
          setInternshipAttendanceSelectedIds([]);
        }
      } catch (e) {
        setInternshipAttendanceSelectedIds([]);
      }
    };
    loadExistingInternshipAttendance();
  }, [selectedInternshipId, internshipAttendanceCourse, internshipAttendanceChapterId]);

  // Internship: open attendance modal for a course
  const openInternshipAttendanceForCourse = async (course) => {
    if (!selectedInternshipId) {
      setUnlockStatus("Please select an internship first.");
      return;
    }
    setInternshipAttendanceCourse(course);
    await loadInternshipChapters(selectedInternshipId, course.id);
    setInternshipAttendanceChapterId("");
    setInternshipAttendanceSelectedIds([]);
    setShowInternshipAttendanceModal(true);
  };

  const toggleInternshipAttendanceStudent = (studentId) => {
    setInternshipAttendanceSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const saveInternshipAttendance = async () => {
    if (
      !selectedInternshipId ||
      !internshipAttendanceCourse ||
      !internshipAttendanceChapterId
    ) {
      alert("Select internship, course and chapter first.");
      return;
    }
    setInternshipAttendanceSaving(true);
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate()
      ).padStart(2, "0")}`;
      const key = `internship:${selectedInternshipId}|course:${internshipAttendanceCourse.id}|chapter:${internshipAttendanceChapterId}|${ymd}`;
      const ref = doc(db, "attendance", key);
      await setDoc(
        ref,
        {
          type: "trainer_internship",
          internshipId: selectedInternshipId,
          courseId: internshipAttendanceCourse.id,
          chapterId: internshipAttendanceChapterId,
          date: ymd,
          present: internshipAttendanceSelectedIds,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      setShowInternshipAttendanceModal(false);
      setInternshipAttendanceCourse(null);
      setInternshipAttendanceChapterId("");
      setInternshipAttendanceSelectedIds([]);
      alert("Internship attendance saved.");
    } catch (e) {
      alert(e?.message || "Failed to save internship attendance");
    } finally {
      setInternshipAttendanceSaving(false);
    }
  };

  // Open documents management modal for internship course
  const openInternshipDocumentsForCourse = async (course) => {
    if (!selectedInternshipId) {
      setUnlockStatus("Please select an internship first.");
      return;
    }
    setInternshipDocumentsCourse(course);
    await loadInternshipChapters(selectedInternshipId, course.id);
    
    // Load current documents for all chapters
    const docsMap = {};
    try {
      const chaptersSnap = await getDocs(
        collection(db, "internships", selectedInternshipId, "courses", course.id, "chapters")
      );
      chaptersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.referenceDocument) {
          docsMap[d.id] = data.referenceDocument;
        }
      });
    } catch (e) {
      console.error("Error loading chapter documents:", e);
    }
    setChapterDocuments(docsMap);
    setShowInternshipDocumentsModal(true);
  };

  // Save documents for all chapters
  const saveInternshipDocuments = async () => {
    if (!selectedInternshipId || !internshipDocumentsCourse) {
      alert("Select internship and course first.");
      return;
    }
    setDocumentsSaving(true);
    try {
      const updates = [];
      for (const [chapterId, docUrl] of Object.entries(chapterDocuments)) {
        const chapterRef = doc(
          db,
          "internships",
          selectedInternshipId,
          "courses",
          internshipDocumentsCourse.id,
          "chapters",
          chapterId
        );
        if (docUrl && docUrl.trim()) {
          updates.push(updateDoc(chapterRef, { referenceDocument: docUrl.trim() }));
        } else {
          // Remove document if URL is empty
          updates.push(updateDoc(chapterRef, { referenceDocument: null }));
        }
      }
      await Promise.all(updates);
      alert("Documents saved successfully.");
      setShowInternshipDocumentsModal(false);
      setInternshipDocumentsCourse(null);
      setChapterDocuments({});
    } catch (e) {
      alert(e?.message || "Failed to save documents");
    } finally {
      setDocumentsSaving(false);
    }
  };

  return (
    <CheckTrainerAuth>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Trainer Panel</h1>
        <p className="text-gray-600 mb-4">Pick a class to see its assigned courses and unlock sessions.</p>
        
        {unlockStatus && (
          <div className={`mb-4 p-3 rounded ${unlockStatus.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {unlockStatus}
          </div>
        )}

       

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded p-4">
            <h2 className="font-semibold mb-2">Your Classes</h2>
            {allowedClasses.length === 0 ? (
              <p className="text-sm text-gray-500">No class access yet.</p>
            ) : (
              <ul className="space-y-2">
                {allowedClasses.map((id) => {
                  const c = classes.find((x) => x.id === id);
                  const selected = id === selectedClassId;
                  return (
                    <li key={id} className={`flex items-center justify-between border rounded p-2 ${selected ? 'bg-blue-50 border-blue-300' : ''}`}>
                      <button className="text-left flex-1" onClick={() => setSelectedClassId(id)}>
                        {c?.name || id}
                      </button>
                     
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">Assigned Courses</h2>
                {selectedClassId && (
                  <p className="text-xs text-gray-500 mt-1">
                    {classCourses.length} course{classCourses.length !== 1 ? "s" : ""} available
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={unlockStudents}
                  onChange={(e) => setUnlockStudents(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Also unlock for students
              </label>
            </div>
            {!selectedClassId ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 bg-gray-50">
                Select a class to view its courses.
              </div>
            ) : classCourses.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 bg-gray-50">
                No assigned courses.
              </div>
            ) : (
              <ul className="space-y-3">
                {classCourses.map((cr) => (
                  <li
                    key={cr.id}
                    className="group rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-gray-900 leading-tight tracking-tight whitespace-normal break-words">
                            {cr.title || cr.id}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Daily controls for unlock, attendance, and documents
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button 
                        className="h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg disabled:bg-emerald-300 disabled:cursor-not-allowed shadow-sm"
                        onClick={() => handleCourseUnlock(cr)}
                        disabled={unlockLoading}
                      >
                        {unlockLoading ? 'Unlocking...' : 'Click to Unlock'}
                      </button>
                      <button
                        className="h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-lg shadow-sm"
                        onClick={() => openAttendanceForCourse(cr)}
                      >
                        Take Attendance
                      </button>
                      <button
                        className="h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg shadow-sm"
                        onClick={() => openClassDocumentsForCourse(cr)}
                        title="Manage reference documents for each day"
                      >
                        Manage Documents
                      </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {allowedInternships.length > 0 && (
          <div className="bg-white border rounded p-4 mb-4">
            <h2 className="font-semibold mb-2">Your Internships</h2>
            <div className="flex flex-wrap gap-2">
              {allowedInternships.map((id) => {
                const it = internships.find((x) => x.id === id);
                const selected = id === selectedInternshipId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSelectedInternshipId((current) =>
                        current === id ? "" : id
                      )
                    }
                    className={`text-xs sm:text-sm px-3 py-1.5 rounded-md border transition-colors
                      ${selected
                        ? "bg-gray-300 border-gray-500 text-gray-900"
                        : "bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200"
                      }`}
                  >
                    {it?.name || id}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {selectedInternshipId && (
          <div className="mt-6 bg-white border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Internship Courses</h2>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">
                  {internshipCourses.length} course(s) in{" "}
                  {internships.find((i) => i.id === selectedInternshipId)?.name || selectedInternshipId}
                </span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={unlockInternshipStudents}
                    onChange={(e) => setUnlockInternshipStudents(e.target.checked)}
                    className="rounded"
                  />
                  Also unlock for students
                </label>
              </div>
            </div>
            {internshipCourses.length === 0 ? (
              <p className="text-sm text-gray-500">No courses copied into this internship yet.</p>
            ) : (
              <ul className="space-y-2">
                {internshipCourses.map((cr) => (
                  <li
                    key={cr.id}
                    className="flex items-center justify-between border rounded p-2"
                  >
                    <span>{cr.title || cr.id}</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded"
                        onClick={() => handleInternshipCourseUnlock(cr)}
                        disabled={unlockLoading}
                      >
                        {unlockLoading ? "Unlocking..." : "Unlock Daywise"}
                      </button>
                      <button
                        className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded"
                        onClick={() => openInternshipAttendanceForCourse(cr)}
                      >
                        Take Attendance
                      </button>
                      <button
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                        onClick={() => openInternshipDocumentsForCourse(cr)}
                        title="Manage reference documents for each day"
                      >
                        Manage Documents
                      </button>
                      <button
                        className="text-sm bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded"
                        onClick={() => router.push(`/internships/${selectedInternshipId}/courses/${cr.id}`)}
                        title="Open the internship course view as students see it"
                      >
                        Open Course
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Chapter Selection Modal */}
        {showChapterModal && selectedCourseForUnlock && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                Select Chapters for {selectedCourseForUnlock.title || selectedCourseForUnlock.id}
              </h2>
              
              {chapters.length > 0 ? (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => setSelectedChapters(chapters.map(c => c.id))}
                      className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedChapters([])}
                      className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Clear All
                    </button>
                  </div>
                  {chapters.map((ch) => (
                    <label key={ch.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedChapters.includes(ch.id)}
                        onChange={(e) => {
                          setSelectedChapters((prev) => 
                            e.target.checked 
                              ? [...prev, ch.id] 
                              : prev.filter((id) => id !== ch.id)
                          );
                        }}
                        className="rounded"
                      />
                      <span className="flex-1">{ch.title || ch.id}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-4">No chapters found for this course.</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowChapterModal(false);
                    setSelectedChapters([]);
                    setSelectedCourseForUnlock(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChapterUnlock}
                  disabled={unlockLoading}
                  className={`px-4 py-2 rounded text-white ${
                    unlockLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {unlockLoading 
                    ? 'Saving...' 
                    : selectedChapters.length > 0
                    ? `Unlock ${selectedChapters.length} Chapter${selectedChapters.length !== 1 ? 's' : ''}`
                    : 'Save Empty Unlock'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Modal */}
        {showAttendanceModal && attendanceCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl mx-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Take Attendance — {attendanceCourse.title || attendanceCourse.id}</h2>
                <button
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setAttendanceCourse(null);
                    setAttendanceChapterId("");
                    setAttendanceSelectedIds([]);
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-gray-600 mb-3">
                Today: {(() => {
                  const d = new Date();
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                })()}
              </div>

              {/* Select Chapter */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Chapter (Day)</label>
                <select
                  value={attendanceChapterId}
                  onChange={(e) => setAttendanceChapterId(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Select chapter...</option>
                  {chapters.map((ch, idx) => (
                    <option key={ch.id} value={ch.id}>
                      Day {idx + 1}: {ch.title || ch.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Students list */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Students in selected class</h3>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm bg-gray-200 px-3 py-1 rounded"
                      onClick={() => {
                        const studentsInClass = classes.length
                          ? students.filter((s) =>
                              Array.isArray(s.classIds) ? s.classIds.includes(selectedClassId) : s.classId === selectedClassId
                            )
                          : [];
                        setAttendanceSelectedIds(studentsInClass.map((s) => s.id));
                      }}
                    >
                      Select All
                    </button>
                    <button
                      className="text-sm bg-gray-200 px-3 py-1 rounded"
                      onClick={() => setAttendanceSelectedIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left">Present</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students
                        .filter((s) =>
                          Array.isArray(s.classIds) ? s.classIds.includes(selectedClassId) : s.classId === selectedClassId
                        )
                        .map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={attendanceSelectedIds.includes(s.id)}
                                onChange={() => toggleAttendanceStudent(s.id)}
                              />
                            </td>
                            <td className="p-2">{s.name || '-'}</td>
                            <td className="p-2">{s.email || '-'}</td>
                            <td className="p-2">{s.phone || s.phone1 || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setAttendanceCourse(null);
                    setAttendanceChapterId("");
                    setAttendanceSelectedIds([]);
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={giveAttendanceWindow}
                  disabled={!attendanceChapterId}
                  className={`px-4 py-2 rounded border ${
                    !attendanceChapterId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
                  }`}
                  title="Open self attendance for 5 minutes (no need to select students)"
                >
                  Give Attendance
                </button>
                <button
                  onClick={saveAttendance}
                  disabled={attendanceSaving || !attendanceChapterId || attendanceSelectedIds.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    attendanceSaving || !attendanceChapterId || attendanceSelectedIds.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {attendanceSaving ? 'Saving...' : `Save Attendance (${attendanceSelectedIds.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Class Documents Management Modal */}
        {showClassDocumentsModal && classDocumentsCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-6 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    Manage Reference Documents — {classDocumentsCourse.title || classDocumentsCourse.id}
                  </h2>
                  <button
                    onClick={() => {
                      setShowClassDocumentsModal(false);
                      setClassDocumentsCourse(null);
                      setClassChapterDocuments({});
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-sm text-gray-600">
                  Add reference documents (Google Drive links) for each day. These documents will be visible to students.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-4">
                {chapters.length > 0 ? (
                  <div className="space-y-4">
                    {chapters.map((ch, idx) => (
                      <div key={ch.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Day {typeof ch.order === "number" ? ch.order : idx + 1}: {ch.title || ch.id}
                          </label>
                        </div>
                        <input
                          type="text"
                          placeholder="Google Drive URL or document link"
                          value={classChapterDocuments[ch.id] || ""}
                          onChange={(e) =>
                            setClassChapterDocuments({
                              ...classChapterDocuments,
                              [ch.id]: e.target.value,
                            })
                          }
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        {classChapterDocuments[ch.id] && (
                          <p className="text-xs text-gray-500 mt-1">
                            Current: {classChapterDocuments[ch.id].length > 50
                              ? `${classChapterDocuments[ch.id].substring(0, 50)}...`
                              : classChapterDocuments[ch.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No chapters found for this course.</p>
                )}
              </div>

              <div className="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-lg flex-shrink-0 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowClassDocumentsModal(false);
                    setClassDocumentsCourse(null);
                    setClassChapterDocuments({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveClassDocuments}
                  disabled={classDocumentsSaving}
                  className={`px-4 py-2 rounded text-white ${
                    classDocumentsSaving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {classDocumentsSaving ? "Saving..." : "Save Documents"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Internship Chapter Selection Modal */}
        {showInternshipChapterModal && selectedInternshipCourseForUnlock && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                Select Chapters for Internship Course{" "}
                {selectedInternshipCourseForUnlock.title || selectedInternshipCourseForUnlock.id}
              </h2>

              {internshipChapters.length > 0 ? (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() =>
                        setSelectedInternshipChapters(internshipChapters.map((c) => c.id))
                      }
                      className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedInternshipChapters([])}
                      className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Clear All
                    </button>
                  </div>
                  {internshipChapters.map((ch) => (
                    <label
                      key={ch.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInternshipChapters.includes(ch.id)}
                        onChange={(e) => {
                          setSelectedInternshipChapters((prev) =>
                            e.target.checked
                              ? [...prev, ch.id]
                              : prev.filter((id) => id !== ch.id)
                          );
                        }}
                        className="rounded"
                      />
                      <span className="flex-1">
                        {typeof ch.order === "number" ? `Day ${ch.order}: ` : ""}
                        {ch.title || ch.id}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-4">No chapters found for this internship course.</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowInternshipChapterModal(false);
                    setSelectedInternshipChapters([]);
                    setSelectedInternshipCourseForUnlock(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInternshipChapterUnlock}
                  disabled={unlockLoading}
                  className={`px-4 py-2 rounded text-white ${
                    unlockLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {unlockLoading
                    ? "Saving..."
                    : selectedInternshipChapters.length > 0
                    ? `Unlock ${selectedInternshipChapters.length} Chapter${
                        selectedInternshipChapters.length !== 1 ? "s" : ""
                      } for Internship`
                    : "Save Empty Unlock"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Internship Attendance Modal */}
        {showInternshipAttendanceModal && internshipAttendanceCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl mx-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">
                  Internship Attendance — {internshipAttendanceCourse.title || internshipAttendanceCourse.id}
                </h2>
                <button
                  onClick={() => {
                    setShowInternshipAttendanceModal(false);
                    setInternshipAttendanceCourse(null);
                    setInternshipAttendanceChapterId("");
                    setInternshipAttendanceSelectedIds([]);
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-gray-600 mb-3">
                Today:{" "}
                {(() => {
                  const d = new Date();
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                })()}
              </div>

              {/* Select Chapter */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Chapter (Day)
                </label>
                <select
                  value={internshipAttendanceChapterId}
                  onChange={(e) => setInternshipAttendanceChapterId(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Select chapter...</option>
                  {internshipChapters.map((ch, idx) => (
                    <option key={ch.id} value={ch.id}>
                      Day {typeof ch.order === "number" ? ch.order : idx + 1}:{" "}
                      {ch.title || ch.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Students list */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Students in this internship</h3>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm bg-gray-200 px-3 py-1 rounded"
                      onClick={() =>
                        setInternshipAttendanceSelectedIds(
                          internshipStudents
                            .map((s) => s.studentId)
                            .filter((x) => typeof x === "string" && x.length > 0)
                        )
                      }
                    >
                      Select All
                    </button>
                    <button
                      className="text-sm bg-gray-200 px-3 py-1 rounded"
                      onClick={() => setInternshipAttendanceSelectedIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left">Present</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Regd</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internshipStudents.map((s) => {
                        const sid = s.studentId;
                        return (
                          <tr key={s.id} className="border-t">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={internshipAttendanceSelectedIds.includes(sid)}
                                onChange={() => toggleInternshipAttendanceStudent(sid)}
                              />
                            </td>
                            <td className="p-2">{s.studentName || "-"}</td>
                            <td className="p-2">{s.regdNo || "-"}</td>
                            <td className="p-2">{s.email || "-"}</td>
                            <td className="p-2">{s.phone || "-"}</td>
                          </tr>
                        );
                      })}
                      {internshipStudents.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-gray-500 text-sm"
                            colSpan={5}
                          >
                            No students assigned to this internship.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowInternshipAttendanceModal(false);
                    setInternshipAttendanceCourse(null);
                    setInternshipAttendanceChapterId("");
                    setInternshipAttendanceSelectedIds([]);
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={saveInternshipAttendance}
                  disabled={
                    internshipAttendanceSaving ||
                    !internshipAttendanceChapterId ||
                    internshipAttendanceSelectedIds.length === 0
                  }
                  className={`px-4 py-2 rounded text-white ${
                    internshipAttendanceSaving ||
                    !internshipAttendanceChapterId ||
                    internshipAttendanceSelectedIds.length === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {internshipAttendanceSaving
                    ? "Saving..."
                    : `Save Attendance (${internshipAttendanceSelectedIds.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Internship Documents Management Modal */}
        {showInternshipDocumentsModal && internshipDocumentsCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-6 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    Manage Reference Documents — {internshipDocumentsCourse.title || internshipDocumentsCourse.id}
                  </h2>
                  <button
                    onClick={() => {
                      setShowInternshipDocumentsModal(false);
                      setInternshipDocumentsCourse(null);
                      setChapterDocuments({});
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-sm text-gray-600">
                  Add reference documents (Google Drive links) for each day. These documents will be visible to students.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-4">
                {internshipChapters.length > 0 ? (
                  <div className="space-y-4">
                    {internshipChapters.map((ch) => (
                      <div key={ch.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            {typeof ch.order === "number" ? `Day ${ch.order}: ` : ""}
                            {ch.title || ch.id}
                          </label>
                        </div>
                        <input
                          type="text"
                          placeholder="Google Drive URL or document link"
                          value={chapterDocuments[ch.id] || ""}
                          onChange={(e) =>
                            setChapterDocuments({
                              ...chapterDocuments,
                              [ch.id]: e.target.value,
                            })
                          }
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        {chapterDocuments[ch.id] && (
                          <p className="text-xs text-gray-500 mt-1">
                            Current: {chapterDocuments[ch.id].length > 50 
                              ? `${chapterDocuments[ch.id].substring(0, 50)}...` 
                              : chapterDocuments[ch.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No chapters found for this internship course.</p>
                )}
              </div>

              <div className="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-lg flex-shrink-0 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowInternshipDocumentsModal(false);
                    setInternshipDocumentsCourse(null);
                    setChapterDocuments({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveInternshipDocuments}
                  disabled={documentsSaving}
                  className={`px-4 py-2 rounded text-white ${
                    documentsSaving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {documentsSaving ? "Saving..." : "Save Documents"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CheckTrainerAuth>
  );
}


