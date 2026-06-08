"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, firestoreHelpers } from "../../../../lib/firebase";
import { mcqDb } from "../../../../lib/firebaseMCQs";
import {
  collection as mcqCollection,
  getDocs as mcqGetDocs,
  addDoc as mcqAddDoc,
  deleteDoc as mcqDeleteDoc,
  doc as mcqDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import CrtProgrammeExamBuilder from "../../../crtcomponents/CrtProgrammeExamBuilder";
import { useAdminAccess } from "../../AdminAccessContext";
import { tenantSegments } from "@/lib/tenantPath";

export default function CRTManager() {
  const router = useRouter();
  const { user, loading, hasCrtManagerAccess: isAdmin, collegeSubdomain } = useAdminAccess();

  const [crts, setCrts] = useState([]);
  const [selectedCrtId, setSelectedCrtId] = useState(""); 
  const [creating, setCreating] = useState(false);
  const [showCreateCrtForm, setShowCreateCrtForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingCrtId, setDeletingCrtId] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [showCreateCourseForm, setShowCreateCourseForm] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState("");
  const [allCrtCourses, setAllCrtCourses] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [assigningCourses, setAssigningCourses] = useState(false);

  const [newCrt, setNewCrt] = useState({
    name: "",
    description: "",
    duration: "",
    image: "",
    iconKey: "code",
    totalHours: "400",
    commonHours: "200",
    commonLabel: "Aptitude, Reasoning & Soft Skills",
    commonCourses: "Aptitude, Reasoning, Soft Skills",
    technicalHours: "200",
    technicalCourses: "",
  });

  const [editingCrtId, setEditingCrtId] = useState("");
  const [savingCrt, setSavingCrt] = useState(false);
  const [editCrtForm, setEditCrtForm] = useState({
    name: "",
    description: "",
    duration: "",
    image: "",
    iconKey: "code",
    totalHours: "400",
    commonHours: "200",
    commonLabel: "Aptitude, Reasoning & Soft Skills",
    commonCourses: "Aptitude, Reasoning, Soft Skills",
    technicalHours: "200",
    technicalCourses: "",
  });

  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    courseCode: "",
  });
  const [crtStudents, setCrtStudents] = useState([]);
  const [assignedCrtStudents, setAssignedCrtStudents] = useState([]);
  const [assigningStudentId, setAssigningStudentId] = useState("");
  const [removingStudentId, setRemovingStudentId] = useState("");
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState("");
  const [crtBatches, setCrtBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [removingBatchStudentId, setRemovingBatchStudentId] = useState("");
  const [batchStudents, setBatchStudents] = useState([]);
  const [editingBatchId, setEditingBatchId] = useState("");
  const [editingBatchName, setEditingBatchName] = useState("");
  const [editingBatchCapacity, setEditingBatchCapacity] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState("");
  const [batchTests, setBatchTests] = useState([]);
  const [activeBatchTestId, setActiveBatchTestId] = useState("");
  const [showBatchTestModal, setShowBatchTestModal] = useState(false);
  const [editingBatchTestId, setEditingBatchTestId] = useState("");
  const [newBatchTest, setNewBatchTest] = useState({
    name: "",
    durationMinutes: "",
  });
  const [creatingBatchTest, setCreatingBatchTest] = useState(false);
  const [batchTestSections, setBatchTestSections] = useState([]);
  const [savingBatchTestQuestions, setSavingBatchTestQuestions] = useState(false);
  const [activeBatchSectionIndex, setActiveBatchSectionIndex] = useState(0);

  const selectedCrt = useMemo(
    () => crts.find((i) => i.id === selectedCrtId) || null,
    [crts, selectedCrtId]
  );

  const assignedStudentIds = useMemo(
    () => new Set(assignedCrtStudents.map((s) => s.studentId)),
    [assignedCrtStudents]
  );

  const availableCrtStudents = useMemo(
    () =>
      crtStudents.filter((s) => {
        if (!s) return false;
        if (assignedStudentIds.has(s.id)) return false;
        return true;
      }),
    [crtStudents, assignedStudentIds]
  );

  const batchStudentIds = useMemo(
    () => new Set(batchStudents.map((b) => b.studentId).filter(Boolean)),
    [batchStudents]
  );

  const availableForBatch = useMemo(
    () =>
      selectedBatchId
        ? crtStudents.filter((s) => s && !batchStudentIds.has(s.id))
        : [],
    [crtStudents, selectedBatchId, batchStudentIds]
  );

  const fetchCrts = useCallback(async function fetchCrts() {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crt"))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCrts(list);
    if (!selectedCrtId && list.length > 0) {
      setSelectedCrtId(list[0].id);
    }
  }, [selectedCrtId, collegeSubdomain]);

  useEffect(() => {
    if (!user) return;
    fetchCrts();
  }, [user, fetchCrts]);

  useEffect(() => {
    setSelectedStudentToAssign("");
  }, [selectedCrtId]);

  const fetchAllCrtCourses = useCallback(async function fetchAllCrtCourses() {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crtCourses"))
    );
    setAllCrtCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, [collegeSubdomain]);

  useEffect(() => {
    if (!user) return;
    fetchAllCrtCourses();
  }, [user, fetchAllCrtCourses]);

  const fetchCrtStudents = useCallback(async function fetchCrtStudents() {
    try {
      const studentsRef = firestoreHelpers.collection(
        db,
        ...tenantSegments(collegeSubdomain, "students")
      );
      const q = firestoreHelpers.query(
        studentsRef,
        firestoreHelpers.where("isCrt", "==", true)
      );
      const snap = await firestoreHelpers.getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.name || a.studentName || "").localeCompare(
            b.name || b.studentName || "",
            undefined,
            { sensitivity: "base" }
          )
        );
      setCrtStudents(list);
    } catch (e) {
      console.error("Failed to fetch CRT students", e);
      alert("Failed to load CRT students.");
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    if (!user) return;
    fetchCrtStudents();
  }, [user, fetchCrtStudents]);

  const fetchAssignedCrtStudents = useCallback(
    async function fetchAssignedCrtStudents(targetId) {
      if (!targetId) return;
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          targetId,
          "students"
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.studentName || "").localeCompare(b.studentName || "", undefined, {
            sensitivity: "base",
          })
        );
      setAssignedCrtStudents(list);
    },
    [collegeSubdomain]
  );

  useEffect(() => {
    if (!selectedCrtId) {
      setAssignedCrtStudents([]);
      return;
    }
    fetchAssignedCrtStudents(selectedCrtId);
  }, [selectedCrtId, fetchAssignedCrtStudents]);

  const fetchCrtBatches = useCallback(
    async function fetchCrtBatches(targetId) {
      if (!targetId) {
        setCrtBatches([]);
        setSelectedBatchId("");
        setBatchTests([]);
        return;
      }
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          targetId,
          "batches"
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", undefined, {
            sensitivity: "base",
          })
        );
      setCrtBatches(list);
      // If currently selected batch no longer exists, clear selection
      if (selectedBatchId && !list.some((b) => b.id === selectedBatchId)) {
        setSelectedBatchId("");
      }
    },
    [selectedBatchId, collegeSubdomain]
  );

  const fetchBatchTests = useCallback(
    async function fetchBatchTests(targetCrtId, batchId) {
      if (!targetCrtId || !batchId) {
        setBatchTests([]);
        return;
      }
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          targetCrtId,
          "batches",
          batchId,
          "tests"
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBatchTests(list);
      if (list.length === 0) {
        setActiveBatchTestId("");
        setBatchTestSections([]);
        setActiveBatchSectionIndex(0);
      } else if (!activeBatchTestId || !list.find((t) => t.id === activeBatchTestId)) {
        setActiveBatchTestId(list[0].id);
      }
    },
    [activeBatchTestId, collegeSubdomain]
  );

  const fetchBatchStudents = useCallback(
    async function fetchBatchStudents(targetCrtId, batchId) {
      if (!targetCrtId || !batchId) {
        setBatchStudents([]);
        return;
      }
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          "crt",
          targetCrtId,
          "batches",
          batchId,
          "students"
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.studentName || "").localeCompare(
            b.studentName || "",
            undefined,
            {
              sensitivity: "base",
            }
          )
        );
      setBatchStudents(list);
    },
    []
  );

  useEffect(() => {
    if (!selectedCrtId) {
      setCrtBatches([]);
      setSelectedBatchId("");
      setBatchStudents([]);
       setBatchTests([]);
       setActiveBatchTestId("");
       setBatchTestSections([]);
       setActiveBatchSectionIndex(0);
      return;
    }
    fetchCrtBatches(selectedCrtId);
  }, [selectedCrtId, fetchCrtBatches]);

  useEffect(() => {
    if (!selectedCrtId || !selectedBatchId) {
      setBatchStudents([]);
      setBatchTests([]);
      setActiveBatchTestId("");
      setBatchTestSections([]);
      setActiveBatchSectionIndex(0);
      return;
    }
    fetchBatchStudents(selectedCrtId, selectedBatchId);
    fetchBatchTests(selectedCrtId, selectedBatchId);
  }, [selectedCrtId, selectedBatchId, fetchBatchStudents, fetchBatchTests]);

  async function createCrt(e) {
    e.preventDefault();
    if (!newCrt.name.trim()) return;
    try {
      setCreating(true);
      const parseList = (s) =>
        (s || "")
          .split(/[,;]/)
          .map((x) => x.trim())
          .filter(Boolean);
      const ref = await firestoreHelpers.addDoc(
        firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crt")),
        {
          name: newCrt.name.trim(),
          description: newCrt.description.trim(),
          duration: (newCrt.duration || "").trim() || "12–16 weeks",
          image: (newCrt.image || "").trim() || "/LmsImg.jpg",
          iconKey: newCrt.iconKey === "cpu" ? "cpu" : "code",
          totalHours: Number(newCrt.totalHours) || 400,
          commonHours: Number(newCrt.commonHours) || 200,
          commonLabel: (newCrt.commonLabel || "").trim() || "Aptitude, Reasoning & Soft Skills",
          commonCourses: parseList(newCrt.commonCourses),
          technicalHours: Number(newCrt.technicalHours) || 200,
          technicalCourses: parseList(newCrt.technicalCourses),
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || null,
        }
      );
      setNewCrt({
        name: "",
        description: "",
        duration: "",
        image: "",
        iconKey: "code",
        totalHours: "400",
        commonHours: "200",
        commonLabel: "Aptitude, Reasoning & Soft Skills",
        commonCourses: "Aptitude, Reasoning, Soft Skills",
        technicalHours: "200",
        technicalCourses: "",
      });
      await fetchCrts();
      setSelectedCrtId(ref.id);
    } finally {
      setCreating(false);
    }
  }

  function startEditCrt(crt) {
    setEditingCrtId(crt.id);
    setEditCrtForm({
      name: crt.name || "",
      description: crt.description || "",
      duration: crt.duration || "12–16 weeks",
      image: crt.image || "",
      iconKey: crt.iconKey === "cpu" ? "cpu" : "code",
      totalHours: String(crt.totalHours ?? 400),
      commonHours: String(crt.commonHours ?? 200),
      commonLabel: crt.commonLabel || "Aptitude, Reasoning & Soft Skills",
      commonCourses: Array.isArray(crt.commonCourses) ? crt.commonCourses.join(", ") : "",
      technicalHours: String(crt.technicalHours ?? 200),
      technicalCourses: Array.isArray(crt.technicalCourses) ? crt.technicalCourses.join(", ") : "",
    });
  }

  async function updateCrt(e) {
    e.preventDefault();
    if (!editingCrtId || !editCrtForm.name.trim()) return;
    const parseList = (s) =>
      (s || "")
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean);
    try {
      setSavingCrt(true);
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(db, ...tenantSegments(collegeSubdomain, "crt"), editingCrtId),
        {
          name: editCrtForm.name.trim(),
          description: editCrtForm.description.trim(),
          duration: (editCrtForm.duration || "").trim() || "12–16 weeks",
          image: (editCrtForm.image || "").trim() || "/LmsImg.jpg",
          iconKey: editCrtForm.iconKey === "cpu" ? "cpu" : "code",
          totalHours: Number(editCrtForm.totalHours) || 400,
          commonHours: Number(editCrtForm.commonHours) || 200,
          commonLabel: (editCrtForm.commonLabel || "").trim() || "Aptitude, Reasoning & Soft Skills",
          commonCourses: parseList(editCrtForm.commonCourses),
          technicalHours: Number(editCrtForm.technicalHours) || 200,
          technicalCourses: parseList(editCrtForm.technicalCourses),
          updatedAt: new Date().toISOString(),
        }
      );
      setEditingCrtId("");
      await fetchCrts();
    } catch (err) {
      console.error(err);
      alert("Failed to update CRT.");
    } finally {
      setSavingCrt(false);
    }
  }

  async function createCourseInCrt(e) {
    e.preventDefault();
    if (!newCourse.title.trim()) {
      alert("Please enter a course title.");
      return;
    }
    try {
      setCreatingCourse(true);
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(db, "crtCourses"),
        {
          title: newCourse.title.trim(),
          description: newCourse.description.trim() || "",
          courseCode: newCourse.courseCode.trim() || "",
          syllabus: [],
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || null,
        }
      );
      setNewCourse({ title: "", description: "", courseCode: "" });
      await fetchAllCrtCourses();
      setShowCreateCourseForm(false);
      alert("Course created successfully.");
    } catch (e) {
      console.error(e);
      alert("Failed to create course.");
    } finally {
      setCreatingCourse(false);
    }
  }

  async function assignCoursesToCrt() {
    if (!selectedCrtId || selectedCourseIds.length === 0) {
      alert("Please select a CRT program and at least one course.");
      return;
    }
    try {
      setAssigningCourses(true);
      const coursesCol = firestoreHelpers.collection(
        db,
        ...tenantSegments(collegeSubdomain, "crt"),
        selectedCrtId,
        "courses"
      );
      
      // Check which courses are already assigned (by sourceCourseId)
      const existingSnap = await firestoreHelpers.getDocs(coursesCol);
      const existingSourceIds = new Set(
        existingSnap.docs.map((d) => d.data().sourceCourseId).filter(Boolean)
      );
      
      // Get the master course data for courses to assign
      const toAssign = selectedCourseIds.filter(
        (id) => !existingSourceIds.has(id)
      );
      
      // Create copies of courses under the CRT (including their chapters/days)
      for (const courseId of toAssign) {
        const masterCourseRef = firestoreHelpers.doc(db, "crtCourses", courseId);
        const masterCourseSnap = await firestoreHelpers.getDoc(masterCourseRef);
        
        if (masterCourseSnap.exists()) {
          const masterData = masterCourseSnap.data();

          // Create the course copy under this CRT
          const courseCopyRef = await firestoreHelpers.addDoc(coursesCol, {
            title: masterData.title || "",
            description: masterData.description || "",
            courseCode: masterData.courseCode || "",
            syllabus: masterData.syllabus || [],
            sourceCourseId: courseId, // Reference to the master course
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || null,
          });

          // Copy day-wise chapters from master course to this CRT course copy
          try {
            const masterChaptersSnap = await firestoreHelpers.getDocs(
              firestoreHelpers.collection(db, "crtCourses", courseId, "chapters")
            );

            if (!masterChaptersSnap.empty) {
              const targetChaptersCol = firestoreHelpers.collection(
                db,
                "crt",
                selectedCrtId,
                "courses",
                courseCopyRef.id,
                "chapters"
              );

              for (const ch of masterChaptersSnap.docs) {
                const chData = ch.data();
                await firestoreHelpers.addDoc(targetChaptersCol, {
                  ...chData,
                  // Ensure order is numeric and keep existing timestamps/fields
                  order: Number(chData.order) || 1,
                });
              }
            }
          } catch (chapterCopyError) {
            console.error(
              "Failed to copy chapters for course",
              courseId,
              chapterCopyError
            );
          }

          // Copy day-wise progress tests for the course copy
          try {
            const masterAssignmentsSnap = await mcqGetDocs(
              mcqCollection(mcqDb, "copiedcourses", courseId, "assignments")
            );
            const assignments = masterAssignmentsSnap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

            const copyResults = await Promise.allSettled(
              assignments.map(async (assignment) => {
                const { id: sourceAssignmentId, ...payload } = assignment;
                return mcqAddDoc(
                  mcqCollection(
                    mcqDb,
                    "copiedcourses",
                    courseCopyRef.id,
                    "assignments"
                  ),
                  {
                    ...payload,
                    day: Number(payload.day) || 1,
                    sourceAssignmentId,
                    copiedAt: new Date().toISOString(),
                    copiedBy: user?.uid || null,
                  }
                );
              })
            );

            const failures = copyResults.filter((result) => result.status === "rejected");
            if (failures.length > 0) {
              console.error(
                `Failed to copy ${failures.length} progress test(s) for course ${courseId}`,
                failures
              );
            }
          } catch (assignmentCopyError) {
            console.error(
              "Failed to copy progress tests for course",
              courseId,
              assignmentCopyError
            );
          }
        }
      }
      
      setSelectedCourseIds([]);
      await fetchAllCrtCourses();
      alert(
        toAssign.length > 0
          ? `${toAssign.length} course(s) assigned to CRT with day-wise progress tests. Each CRT has its own independent copy.`
          : "All selected courses are already assigned to this CRT."
      );
    } catch (e) {
      console.error(e);
      alert("Failed to assign courses to CRT.");
    } finally {
      setAssigningCourses(false);
    }
  }

  function toggleCourseSelection(courseId) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  }

  async function deleteCourse(courseId) {
    if (!courseId) return;
    if (
      !confirm(
        "Are you sure you want to delete this course? This will remove the course and its syllabus/chapters. CRT copies of this course will not be affected."
      )
    )
      return;
    try {
      setDeletingCourseId(courseId);
      const courseRef = firestoreHelpers.doc(db, "crtCourses", courseId);
      const chaptersCol = firestoreHelpers.collection(
        db,
        "crtCourses",
        courseId,
        "chapters"
      );
      const chaptersSnap = await firestoreHelpers.getDocs(chaptersCol);
      for (const ch of chaptersSnap.docs) {
        await firestoreHelpers.deleteDoc(ch.ref);
      }
      await firestoreHelpers.deleteDoc(courseRef);
      setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
      await fetchAllCrtCourses();
      alert("Course deleted.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete course.");
    } finally {
      setDeletingCourseId("");
    }
  }

  function clearSelectedCourses() {
    setSelectedCourseIds([]);
  }

  async function assignStudentToCrt(studentId) {
    if (!selectedCrtId || !studentId) return;
    const student = crtStudents.find((s) => s.id === studentId);
    if (!student) return;
    const alreadyAssigned = assignedCrtStudents.some(
      (s) => s.studentId === studentId
    );
    if (alreadyAssigned) {
      alert("Student already assigned to this CRT.");
      return;
    }
    try {
      setAssigningStudentId(studentId);
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(
          db,
          "crt",
          selectedCrtId,
          "students"
        ),
        {
          studentId: student.id,
          studentName: student.name || student.studentName || "Unnamed",
          regdNo: student.regdNo || "",
          email: student.email || "",
          phone: student.phone1 || student.phone || "",
          assignedAt: new Date().toISOString(),
        }
      );
      setSelectedStudentToAssign("");
      await fetchAssignedCrtStudents(selectedCrtId);
    } catch (e) {
      console.error(e);
      alert("Failed to assign student to CRT.");
    } finally {
      setAssigningStudentId("");
    }
  }

  async function removeStudentFromCrt(recordId) {
    if (!selectedCrtId || !recordId) return;
    try {
      setRemovingStudentId(recordId);
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          "crt",
          selectedCrtId,
          "students",
          recordId
        )
      );
      await fetchAssignedCrtStudents(selectedCrtId);
    } catch (e) {
      console.error(e);
      alert("Failed to remove student from CRT.");
    } finally {
      setRemovingStudentId("");
    }
  }

  async function assignStudentToBatch(studentId) {
    if (!selectedCrtId || !selectedBatchId || !studentId) return;
    const student = crtStudents.find((s) => s.id === studentId);
    if (!student) return;
    const alreadyInBatch = batchStudents.some((b) => b.studentId === studentId);
    if (alreadyInBatch) {
      alert("Student is already in this batch.");
      return;
    }
    try {
      setAssigningStudentId(studentId);
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(
          db,
          "crt",
          selectedCrtId,
          "batches",
          selectedBatchId,
          "students"
        ),
        {
          studentId: student.id,
          studentName: student.name || student.studentName || "Unnamed",
          regdNo: student.regdNo || "",
          email: student.email || "",
          phone: student.phone1 || student.phone || "",
          assignedAt: new Date().toISOString(),
        }
      );
      setSelectedStudentToAssign("");
      await fetchBatchStudents(selectedCrtId, selectedBatchId);
    } catch (e) {
      console.error(e);
      alert("Failed to assign student to batch.");
    } finally {
      setAssigningStudentId("");
    }
  }

  async function createBatch(e) {
    e.preventDefault();
    if (!selectedCrtId || !newBatchName.trim()) {
      alert("Please select a CRT and enter a batch name.");
      return;
    }
    try {
      setCreatingBatch(true);
      const rawBatchName = newBatchName.trim();
      const batchId =
        rawBatchName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "") || `batch-${Date.now()}`;
      await firestoreHelpers.setDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          batchId
        ),
        {
          name: rawBatchName,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || null,
        },
        { merge: true }
      );
      setNewBatchName("");
      await fetchCrtBatches(selectedCrtId);
      setSelectedBatchId(batchId);
    } catch (e) {
      console.error(e);
      alert("Failed to create batch.");
    } finally {
      setCreatingBatch(false);
    }
  }

  useEffect(() => {
    if (!activeBatchTestId) {
      setBatchTestSections([]);
      setActiveBatchSectionIndex(0);
      return;
    }
    const test = batchTests.find((t) => t.id === activeBatchTestId);
    if (!test) {
      setBatchTestSections([]);
      setActiveBatchSectionIndex(0);
      return;
    }
    if (Array.isArray(test.sections) && test.sections.length > 0) {
      setBatchTestSections(test.sections);
      setActiveBatchSectionIndex(0);
    } else if (Array.isArray(test.questions) && test.questions.length > 0) {
      setBatchTestSections([
        {
          title: "Section 1",
          questions: test.questions.map((q) => ({
            text: q.text || q.question || "",
            options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
            correctAnswers: Array.isArray(q.correctAnswers)
              ? q.correctAnswers
              : [],
            isMultiple:
              typeof q.isMultiple === "boolean"
                ? q.isMultiple
                : Array.isArray(q.correctAnswers) &&
                  q.correctAnswers.length > 1,
          })),
        },
      ]);
      setActiveBatchSectionIndex(0);
    } else {
      setBatchTestSections([]);
      setActiveBatchSectionIndex(0);
    }
  }, [activeBatchTestId, batchTests]);

  async function removeStudentFromBatch(recordId) {
    if (!selectedCrtId || !selectedBatchId || !recordId) return;
    try {
      setRemovingBatchStudentId(recordId);
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          selectedBatchId,
          "students",
          recordId
        )
      );
      await fetchBatchStudents(selectedCrtId, selectedBatchId);
    } catch (e) {
      console.error(e);
      alert("Failed to remove student from batch.");
    } finally {
      setRemovingBatchStudentId("");
    }
  }

  async function createOrUpdateBatchTest(e) {
    e.preventDefault();
    if (!selectedCrtId || !selectedBatchId || !newBatchTest.name.trim()) {
      alert("Please enter a test name.");
      return;
    }
    try {
      setCreatingBatchTest(true);
      const duration = Number(newBatchTest.durationMinutes) || 0;
      if (editingBatchTestId) {
        await firestoreHelpers.updateDoc(
          firestoreHelpers.doc(
            db,
            ...tenantSegments(collegeSubdomain, "crt"),
            selectedCrtId,
            "batches",
            selectedBatchId,
            "tests",
            editingBatchTestId
          ),
          {
            name: newBatchTest.name.trim(),
            durationMinutes: duration,
            updatedAt: new Date().toISOString(),
          }
        );
        setActiveBatchTestId(editingBatchTestId);
      } else {
        const ref = await firestoreHelpers.addDoc(
          firestoreHelpers.collection(
            db,
            ...tenantSegments(collegeSubdomain, "crt"),
            selectedCrtId,
            "batches",
            selectedBatchId,
            "tests"
          ),
          {
            name: newBatchTest.name.trim(),
            durationMinutes: duration,
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || null,
            sections: [],
          }
        );
        setActiveBatchTestId(ref.id);
      }
      setNewBatchTest({ name: "", durationMinutes: "" });
      setEditingBatchTestId("");
      setShowBatchTestModal(false);
      await fetchBatchTests(selectedCrtId, selectedBatchId);
    } catch (e) {
      console.error(e);
      alert(
        editingBatchTestId
          ? "Failed to update batch test."
          : "Failed to create batch test."
      );
    } finally {
      setCreatingBatchTest(false);
    }
  }

  async function saveBatchTestQuestions() {
    if (!selectedCrtId || !selectedBatchId || !activeBatchTestId) return;
    try {
      setSavingBatchTestQuestions(true);
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          selectedBatchId,
          "tests",
          activeBatchTestId
        ),
        {
          sections: batchTestSections,
          updatedAt: new Date().toISOString(),
        }
      );
      await fetchBatchTests(selectedCrtId, selectedBatchId);
      alert("Questions saved for this batch test.");
    } catch (e) {
      console.error(e);
      alert("Failed to save batch test questions.");
    } finally {
      setSavingBatchTestQuestions(false);
    }
  }

  async function deleteBatchTest(testId) {
    if (!selectedCrtId || !selectedBatchId || !testId) return;
    const confirmed = confirm(
      "Are you sure you want to delete this batch test? This will remove all its sections and questions."
    );
    if (!confirmed) return;
    try {
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          selectedBatchId,
          "tests",
          testId
        )
      );
      if (activeBatchTestId === testId) {
        setActiveBatchTestId("");
        setBatchTestSections([]);
        setActiveBatchSectionIndex(0);
      }
      await fetchBatchTests(selectedCrtId, selectedBatchId);
    } catch (e) {
      console.error(e);
      alert("Failed to delete batch test.");
    }
  }

  function startEditBatch(batch) {
    setEditingBatchId(batch.id);
    setEditingBatchName(batch.name || "");
    setEditingBatchCapacity(
      typeof batch.capacity === "number" && batch.capacity > 0
        ? String(batch.capacity)
        : ""
    );
  }

  async function saveBatchEdit(e) {
    e.preventDefault();
    if (!selectedCrtId || !editingBatchId || !editingBatchName.trim()) {
      alert("Please enter a batch name.");
      return;
    }
    try {
      setSavingBatch(true);
      const updateData = {
        name: editingBatchName.trim(),
      };
      if (editingBatchCapacity.trim()) {
        updateData.capacity = Number(editingBatchCapacity) || 0;
      }
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          editingBatchId
        ),
        updateData
      );
      setEditingBatchId("");
      setEditingBatchName("");
      setEditingBatchCapacity("");
      await fetchCrtBatches(selectedCrtId);
    } catch (e) {
      console.error(e);
      alert("Failed to update batch.");
    } finally {
      setSavingBatch(false);
    }
  }

  async function deleteBatch(batchId) {
    if (!selectedCrtId || !batchId) return;
    const confirmed = confirm(
      "Are you sure you want to delete this batch? This will remove all students assigned under this batch."
    );
    if (!confirmed) return;
    try {
      setDeletingBatchId(batchId);
      const studentsSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          batchId,
          "students"
        )
      );
      for (const studentDoc of studentsSnap.docs) {
        await firestoreHelpers.deleteDoc(studentDoc.ref);
      }
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "batches",
          batchId
        )
      );
      if (editingBatchId === batchId) {
        setEditingBatchId("");
        setEditingBatchName("");
        setEditingBatchCapacity("");
      }
      if (selectedBatchId === batchId) {
        setSelectedBatchId("");
        setBatchTests([]);
        setActiveBatchTestId("");
        setBatchTestSections([]);
        setActiveBatchSectionIndex(0);
      }
      await fetchCrtBatches(selectedCrtId);
    } catch (e) {
      console.error(e);
      alert("Failed to delete batch.");
    } finally {
      setDeletingBatchId("");
    }
  }

  async function deleteCrt(id) {
    const targetId = id || selectedCrtId;
    if (!targetId) return;
    if (!confirm("Are you sure you want to delete this CRT? This will remove all course assignments and student assignments.")) return;
    try {
      setDeleting(true);
      setDeletingCrtId(targetId);

      // Delete course copies and their chapters/assignments
      const coursesSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          targetId,
          "courses"
        )
      );
      for (const courseDoc of coursesSnap.docs) {
        // Delete chapters
        const chaptersSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            ...tenantSegments(collegeSubdomain, "crt"),
            targetId,
            "courses",
            courseDoc.id,
            "chapters"
          )
        );
        for (const ch of chaptersSnap.docs) {
          await firestoreHelpers.deleteDoc(ch.ref);
        }
        
        // Delete assignments/progress tests
        try {
          const assignmentsSnap = await mcqGetDocs(
            mcqCollection(mcqDb, "copiedcourses", courseDoc.id, "assignments")
          );
          for (const assignmentDoc of assignmentsSnap.docs) {
            await mcqDeleteDoc(
              mcqDoc(mcqDb, "copiedcourses", courseDoc.id, "assignments", assignmentDoc.id)
            );
          }
        } catch (assignError) {
          console.error("Error deleting assignments:", assignError);
        }
        
        // Delete the course copy
        await firestoreHelpers.deleteDoc(courseDoc.ref);
      }

      // Delete student assignments
      const studentsSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          targetId,
          "students"
        )
      );
      for (const studentDoc of studentsSnap.docs) {
        await firestoreHelpers.deleteDoc(studentDoc.ref);
      }

      // Delete CRT itself
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(db, ...tenantSegments(collegeSubdomain, "crt"), targetId)
      );

      if (selectedCrtId === targetId) {
        setSelectedCrtId("");
      }
      await fetchCrts();
      alert("CRT deleted.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete CRT.");
    } finally {
      setDeleting(false);
      setDeletingCrtId("");
    }
  }

  function logout() {
    signOut(auth);
  }

  async function createPlacementOffer(e) {
    e.preventDefault();
    if (!selectedCrtId) {
      alert("Please select a CRT programme first.");
      return;
    }
    if (!placementForm.collegeName.trim() || !placementForm.role.trim() || !placementForm.email.trim()) {
      alert("Please enter college name, email and role.");
      return;
    }
    try {
      setSavingPlacement(true);

      // First, create or reuse the college CRT officer Auth user on the server.
      // This no longer writes to Firestore Admin (to avoid ECONNRESET issues).
      let officerUid = null;
      try {
        const officerRes = await fetch("/api/create-crt-officer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collegeName: placementForm.collegeName.trim(),
            email: placementForm.email.trim(),
          }),
        });
        const officerData = await officerRes.json().catch(() => ({}));
        if (officerRes.ok && officerData?.uid) {
          officerUid = officerData.uid;
          // Create/update Firestore `users` doc for this officer on the client.
          try {
            const userDocRef = firestoreHelpers.doc(db, "users", officerUid);
            await firestoreHelpers.setDoc(
              userDocRef,
              {
                name: placementForm.collegeName.trim(),
                email: placementForm.email.trim(),
                role: "CRTCPO",
                collegeName: placementForm.collegeName.trim(),
              },
              { merge: true }
            );
          } catch (userErr) {
            console.warn("Failed to create/update CRTCPO user doc:", userErr);
          }
        } else {
          console.warn(
            "create-crt-officer failed:",
            officerData?.error || officerRes.status
          );
        }
      } catch (err) {
        console.warn("Error calling /api/create-crt-officer:", err);
      }

      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedCrtId,
          "placementOffers"
        ),
        {
          collegeName: placementForm.collegeName.trim(),
          role: placementForm.role.trim(),
          location: placementForm.location.trim(),
          loginEmail: placementForm.email.trim(),
          defaultPassword: "Vawe@Crt",
          officerUid: officerUid,
          crtId: selectedCrtId,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || null,
        }
      );
      setPlacementForm({
        collegeName: "",
        email: "",
        role: "",
        location: "",
      });
      setShowPlacementModal(false);
      alert(
        "Placement offer saved for this CRT.\n\n" +
          "Login email: " +
          placementForm.email.trim() +
          "\nDefault password: Vawe@Crt\n\n" +
          "(If there was a server error, the login might need to be created manually.)"
      );
    } catch (err) {
      console.error("Failed to create placement offer", err);
      alert("Failed to save placement offer. Please try again.");
    } finally {
      setSavingPlacement(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!user || !isAdmin) return <div>Access Denied</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CRT Manager</h1>
          <p className="text-sm text-slate-600">
            Create courses and assign them to CRT programs. A course can be assigned to multiple CRTs.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/Admin/crt/crtTestSubmission"
            className="px-3 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
          >
            Test submissions
          </Link>
          <button
            onClick={() => router.push("/Admin/crt")}
            className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200"
          >
            Back
          </button>
          <button
            onClick={logout}
            className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Create CRT</h2>
              <button
                onClick={() => setShowCreateCrtForm(!showCreateCrtForm)}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
              >
                {showCreateCrtForm ? "Hide Form" : "+ Create CRT"}
              </button>
            </div>
            {showCreateCrtForm && (
              <form onSubmit={createCrt} className="space-y-3 border-t pt-4">
                <input
                  type="text"
                  placeholder="Name (title)"
                  value={newCrt.name}
                  onChange={(e) =>
                    setNewCrt((s) => ({ ...s, name: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                />
                <textarea
                  placeholder="Description"
                  value={newCrt.description}
                  onChange={(e) =>
                    setNewCrt((s) => ({
                      ...s,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                  rows={3}
                />
                <input
                  type="text"
                  placeholder="Duration (e.g. 12–16 weeks)"
                  value={newCrt.duration}
                  onChange={(e) =>
                    setNewCrt((s) => ({ ...s, duration: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Image URL (e.g. /CRTImages/CRT with JAVA.jpg)"
                  value={newCrt.image}
                  onChange={(e) =>
                    setNewCrt((s) => ({ ...s, image: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                />
                <div className="space-y-1">
                  <label className="text-xs text-slate-600">Icon</label>
                  <select
                    value={newCrt.iconKey}
                    onChange={(e) =>
                      setNewCrt((s) => ({ ...s, iconKey: e.target.value }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="code">Code (Java/Python style)</option>
                    <option value="cpu">CPU (AIML style)</option>
                  </select>
                </div>
                <div className="border-t pt-3 mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Hours &amp; course breakdown (shown on hover)</p>
                  <input
                    type="number"
                    min="1"
                    placeholder="Total hours (e.g. 400)"
                    value={newCrt.totalHours}
                    onChange={(e) =>
                      setNewCrt((s) => ({ ...s, totalHours: e.target.value }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Common hrs"
                      value={newCrt.commonHours}
                      onChange={(e) =>
                        setNewCrt((s) => ({ ...s, commonHours: e.target.value }))
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Technical hrs"
                      value={newCrt.technicalHours}
                      onChange={(e) =>
                        setNewCrt((s) => ({ ...s, technicalHours: e.target.value }))
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Non-technical label (e.g. Aptitude, Reasoning & Soft Skills)"
                    value={newCrt.commonLabel}
                    onChange={(e) =>
                      setNewCrt((s) => ({ ...s, commonLabel: e.target.value }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Non-technical courses (comma-separated)"
                    value={newCrt.commonCourses}
                    onChange={(e) =>
                      setNewCrt((s) => ({ ...s, commonCourses: e.target.value }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Technical courses (comma-separated)"
                    value={newCrt.technicalCourses}
                    onChange={(e) =>
                      setNewCrt((s) => ({ ...s, technicalCourses: e.target.value }))
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={creating}
                    className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCrtForm(false);
                      setNewCrt({
                        name: "",
                        description: "",
                        duration: "",
                        image: "",
                        iconKey: "code",
                        totalHours: "400",
                        commonHours: "200",
                        commonLabel: "Aptitude, Reasoning & Soft Skills",
                        commonCourses: "Aptitude, Reasoning, Soft Skills",
                        technicalHours: "200",
                        technicalCourses: "",
                      });
                    }}
                    className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-3">Select CRT</h2>
            <select
              value={selectedCrtId}
              onChange={(e) => setSelectedCrtId(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              {crts.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name || i.id}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-3">CRT Programs</h2>
            <div className="space-y-3">
              {crts.length === 0 && (
                <div className="text-sm text-slate-500">No CRT programs yet.</div>
              )}
              {crts.map((i) => (
                <div
                  key={i.id}
                  className={`border rounded-md px-3 py-2 flex items-center justify-between ${selectedCrtId === i.id ? "bg-blue-50" : ""}`}
                >
                  <button
                    onClick={() => setSelectedCrtId(i.id)}
                    className="text-left"
                  >
                    <div className="font-medium">{i.name || i.id}</div>
                    {i.description && (
                      <div className="text-xs text-slate-500 line-clamp-1">
                        {i.description}
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditCrt(i)}
                      className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/Admin/crt/${i.id}/manage`}
                      className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm"
                    >
                      Manage
                    </Link>
                    <button
                      onClick={() => deleteCrt(i.id)}
                      disabled={deleting && deletingCrtId === i.id}
                      className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm disabled:opacity-50"
                    >
                      {deleting && deletingCrtId === i.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <CrtProgrammeExamBuilder crts={crts} user={user} />

        </div>

    <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Create Course</h2>
          <button
            onClick={() => setShowCreateCourseForm(!showCreateCourseForm)}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            {showCreateCourseForm ? "Hide Form" : "+ Create Course"}
          </button>
        </div>
        {showCreateCourseForm && (
          <form onSubmit={createCourseInCrt} className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Course Title *"
                value={newCourse.title}
                onChange={(e) =>
                  setNewCourse((s) => ({ ...s, title: e.target.value }))
                }
                className="w-full rounded-md border px-3 py-2"
                disabled={creatingCourse}
              />
              <input
                type="text"
                placeholder="Course Code"
                value={newCourse.courseCode}
                onChange={(e) =>
                  setNewCourse((s) => ({ ...s, courseCode: e.target.value }))
                }
                className="w-full rounded-md border px-3 py-2"
                disabled={creatingCourse}
              />
            </div>
            <textarea
              placeholder="Course Description"
              value={newCourse.description}
              onChange={(e) =>
                setNewCourse((s) => ({
                  ...s,
                  description: e.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2"
              rows={3}
              disabled={creatingCourse}
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creatingCourse || !newCourse.title.trim()}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
              >
                {creatingCourse ? "Creating..." : "Create Course"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateCourseForm(false);
                  setNewCourse({ title: "", description: "", courseCode: "" });
                }}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200"
                disabled={creatingCourse}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Assign Courses to CRT</h2>
          {selectedCourseIds.length > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-slate-100">
              Selected: {selectedCourseIds.length}
            </span>
          )}
        </div>
        {!selectedCrtId ? (
          <div className="text-sm text-amber-600 mb-3">
            Please select a CRT program to assign courses.
          </div>
        ) : null}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={assignCoursesToCrt}
            disabled={
              !selectedCrtId ||
              selectedCourseIds.length === 0 ||
              assigningCourses
            }
            className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {assigningCourses ? "Assigning..." : "Assign Selected to CRT"}
          </button>
          <button
            onClick={clearSelectedCourses}
            disabled={selectedCourseIds.length === 0 || assigningCourses}
            className="px-3 py-2 rounded-md bg-slate-100 text-sm disabled:opacity-50"
          >
            Clear Selection  
          </button>
        </div>
        {allCrtCourses.length === 0 ? (
          <div className="text-sm text-slate-500">
            No courses created yet. Create a course above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allCrtCourses.map((c) => (
              <div
                key={c.id}
                className="border rounded-lg p-3 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push(`/Admin/crt/courses/${c.id}`)}
              > 
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCourseIds.includes(c.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCourseSelection(c.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                      disabled={!selectedCrtId}
                    />
                    <div className="font-semibold flex-1">{c.title || "Untitled"}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 ml-6">
                    {c.courseCode || "No course code"}
                  </div>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 ml-6">
                    {c.description || "No description"}
                  </p>
                  <div className="mt-2 ml-6 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-blue-600 font-medium">
                      Click to add syllabus days →
                    </span>
                    {Array.isArray(c.syllabus) && c.syllabus.length > 0 && (
                      <span className="text-xs text-emerald-600">
                        ({c.syllabus.length} days)
                      </span>
                    )}
                  </div>
                  <div className="mt-3 ml-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCourse(c.id);
                      }}
                      disabled={deletingCourseId === c.id}
                      className="px-3 py-1.5 rounded-md bg-red-500 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingCourseId === c.id ? "Deleting..." : "Delete Course"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">CRT Batches / Sections</h2>
            <p className="text-sm text-slate-500">
              Create batches under a CRT program and assign CRT students to those
              batches.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            <div>CRT: {selectedCrt?.name || "None selected"}</div>
            <div>Batches: {crtBatches.length}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          <div className="space-y-4">
            <form onSubmit={createBatch} className="space-y-2">
              <label className="text-sm text-slate-600">
                Create batch for selected CRT
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Batch name (e.g., Batch A)"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  disabled={!selectedCrtId || creatingBatch}
                />
                <button
                  type="submit"
                  disabled={
                    !selectedCrtId || !newBatchName.trim() || creatingBatch
                  }
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm disabled:opacity-50"
                >
                  {creatingBatch ? "Creating..." : "Create"}
                </button>
              </div>
              {!selectedCrtId && (
                <p className="text-xs text-amber-600">
                  Select a CRT above before creating batches.
                </p>
              )}
            </form>

            <div className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Batches for this CRT</h3>
                <span className="text-xs text-slate-500">
                  {crtBatches.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {crtBatches.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No batches yet. Create one using the form above.
                  </p>
                ) : (
                  crtBatches.map((batch) => (
                    <div
                      key={batch.id}
                      onClick={() => setSelectedBatchId(batch.id)}
                      className={`border rounded-md px-3 py-2 text-sm flex items-center justify-between gap-3 cursor-pointer ${
                        selectedBatchId === batch.id
                          ? "bg-blue-50 border-blue-400"
                          : "bg-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {batch.name || "Unnamed batch"}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-2">
                          {batch.createdAt && (
                            <span>
                              Created:{" "}
                              {new Date(batch.createdAt).toLocaleDateString()}
                            </span>
                          )}
                          {typeof batch.capacity === "number" &&
                            batch.capacity > 0 && (
                              <span>Capacity: {batch.capacity}</span>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditBatch(batch);
                          }}
                          className="px-2 py-1 rounded-md bg-slate-100 text-xs hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBatch(batch.id);
                          }}
                          disabled={deletingBatchId === batch.id}
                          className="px-2 py-1 rounded-md bg-red-500 text-white text-xs disabled:opacity-50"
                        >
                          {deletingBatchId === batch.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {editingBatchId && (
                <form
                  onSubmit={saveBatchEdit}
                  className="mt-3 border-t pt-3 space-y-3"
                >
                  <h4 className="font-semibold text-sm">Edit batch details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-600">
                        Batch name
                      </label>
                      <input
                        type="text"
                        value={editingBatchName}
                        onChange={(e) => setEditingBatchName(e.target.value)}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="Batch name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-600">
                        Capacity (optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingBatchCapacity}
                        onChange={(e) =>
                          setEditingBatchCapacity(e.target.value)
                        }
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="e.g., 60"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingBatch}
                      className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs disabled:opacity-50"
                    >
                      {savingBatch ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBatchId("");
                        setEditingBatchName("");
                        setEditingBatchCapacity("");
                      }}
                      className="px-3 py-1.5 rounded-md bg-slate-100 text-xs hover:bg-slate-200"
                      disabled={savingBatch}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
            {selectedBatchId && (
              <div className="mt-4 border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    Custom Tests for this Batch
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBatchTestId("");
                      setNewBatchTest({ name: "", durationMinutes: "" });
                      setShowBatchTestModal(true);
                    }}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                  >
                    + Create Batch Test
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-1">
                    {batchTests.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No tests for this batch yet.
                      </p>
                    )}
                    {batchTests.map((t) => (
                      <div
                        key={t.id}
                        className={`border rounded-md px-3 py-2 flex items-center justify-between text-xs ${
                          activeBatchTestId === t.id
                            ? "bg-purple-50 border-purple-300"
                            : "bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveBatchTestId(t.id)}
                          className="text-left flex-1"
                        >
                          <div className="font-medium text-slate-800">
                            {t.name || "Unnamed Test"}
                          </div>
                          <div className="text-[11px] text-slate-500 flex gap-2 flex-wrap">
                            {t.durationMinutes
                              ? `Duration: ${t.durationMinutes} min`
                              : "No duration set"}
                            {Array.isArray(t.sections) && t.sections.length > 0 && (
                              <span>
                                • Questions:{" "}
                                {t.sections.reduce(
                                  (sum, sec) =>
                                    sum +
                                    (Array.isArray(sec.questions)
                                      ? sec.questions.length
                                      : 0),
                                  0
                                )}
                              </span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBatchTestId(t.id);
                              setNewBatchTest({
                                name: t.name || "",
                                durationMinutes: t.durationMinutes
                                  ? String(t.durationMinutes)
                                  : "",
                              });
                              setShowBatchTestModal(true);
                            }}
                            className="px-2 py-1 rounded-md bg-slate-100 text-[11px] hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBatchTest(t.id)}
                            className="px-2 py-1 rounded-md bg-red-600 text-white text-[11px]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="md:col-span-2 border rounded-md p-3 bg-slate-50 min-h-[220px]">
                    {!activeBatchTestId ? (
                      <p className="text-xs text-slate-500">
                        Select a batch test on the left to manage its sections and
                        questions.
                      </p>
                    ) : (
                      <>
                        {(() => {
                          const test = batchTests.find(
                            (t) => t.id === activeBatchTestId
                          );
                          if (!test) {
                            return (
                              <p className="text-xs text-slate-500">
                                Test not found. Please select another test.
                              </p>
                            );
                          }
                          return (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-slate-800">
                                  {test.name || "Unnamed Test"}
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  Duration:{" "}
                                  {test.durationMinutes
                                    ? `${test.durationMinutes} minutes`
                                    : "Not set"}
                                </p>
                              </div>
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-semibold text-slate-700">
                                  Sections & Questions
                                </h5>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBatchTestSections((prev) => {
                                        const next = [
                                          ...prev,
                                          {
                                            title: `Section ${prev.length + 1}`,
                                            questions: [],
                                          },
                                        ];
                                        setActiveBatchSectionIndex(
                                          next.length - 1
                                        );
                                        return next;
                                      })
                                    }
                                    className="px-2 py-1.5 rounded-md bg-emerald-600 text-white text-[11px]"
                                  >
                                    + Add Section
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveBatchTestQuestions}
                                    disabled={savingBatchTestQuestions}
                                    className="px-2 py-1.5 rounded-md bg-blue-600 text-white text-[11px] disabled:opacity-50"
                                  >
                                    {savingBatchTestQuestions
                                      ? "Saving..."
                                      : "Save All"}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                {batchTestSections.length === 0 && (
                                  <p className="text-[11px] text-slate-500">
                                    No sections yet. Click &quot;Add Section&quot; to
                                    start.
                                  </p>
                                )}
                                {batchTestSections.length > 0 && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <label className="text-[11px] text-slate-600">
                                      Active section:
                                    </label>
                                    <select
                                      className="border rounded-md px-2 py-1 text-[11px]"
                                      value={String(activeBatchSectionIndex)}
                                      onChange={(e) => {
                                        const idx = Number(e.target.value);
                                        setActiveBatchSectionIndex(
                                          Number.isNaN(idx) ? 0 : idx
                                        );
                                      }}
                                    >
                                      <option value="-1">Hide all sections</option>
                                      {batchTestSections.map((section, idx) => (
                                        <option key={idx} value={idx}>
                                          {`Section ${idx + 1}${
                                            section.title
                                              ? ` - ${section.title}`
                                              : ""
                                          }`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                {batchTestSections.map((section, sIdx) => {
                                  if (
                                    activeBatchSectionIndex === -1 ||
                                    sIdx !== activeBatchSectionIndex
                                  )
                                    return null;
                                  const sectionQuestions =
                                    Array.isArray(section.questions) &&
                                    section.questions.length
                                      ? section.questions
                                      : [];
                                  return (
                                    <div
                                      key={sIdx}
                                      className="border rounded-md p-3 bg-white space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                            Section {sIdx + 1}
                                          </span>
                                          <input
                                            className="border rounded-md px-2 py-1 text-xs"
                                            value={section.title || ""}
                                            onChange={(e) => {
                                              const next = [...batchTestSections];
                                              next[sIdx] = {
                                                ...next[sIdx],
                                                title: e.target.value,
                                              };
                                              setBatchTestSections(next);
                                            }}
                                            placeholder="Section title (optional)"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setBatchTestSections((prev) => {
                                              const next = prev.filter(
                                                (_sec, i) => i !== sIdx
                                              );
                                              const newIndex =
                                                next.length === 0
                                                  ? 0
                                                  : Math.min(
                                                      activeBatchSectionIndex >=
                                                        sIdx
                                                        ? activeBatchSectionIndex - 1
                                                        : activeBatchSectionIndex,
                                                      next.length - 1
                                                    );
                                              setActiveBatchSectionIndex(
                                                newIndex
                                              );
                                              return next;
                                            })
                                          }
                                          className="text-[11px] text-red-600"
                                        >
                                          Remove Section
                                        </button>
                                      </div>
                                      <div className="flex items-center justify-between mt-1 mb-1">
                                        <p className="text-[11px] text-slate-600">
                                          Questions in this section:{" "}
                                          {sectionQuestions.length}
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        {sectionQuestions.length === 0 && (
                                          <div className="border border-dashed rounded-md px-3 py-4 flex flex-col items-center justify-center gap-2 bg-white/60">
                                            <p className="text-[11px] text-slate-500 text-center">
                                              No questions in this section yet.
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setBatchTestSections((prev) => {
                                                  const next = [...prev];
                                                  const qs = Array.isArray(
                                                    next[sIdx].questions
                                                  )
                                                    ? [...next[sIdx].questions]
                                                    : [];
                                                  qs.push({
                                                    text: "",
                                                    options: ["", "", "", ""],
                                                    correctAnswers: [],
                                                    isMultiple: false,
                                                  });
                                                  next[sIdx] = {
                                                    ...next[sIdx],
                                                    questions: qs,
                                                  };
                                                  return next;
                                                })
                                              }
                                              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-[11px]"
                                            >
                                              + Add First Question
                                            </button>
                                          </div>
                                        )}
                                        {sectionQuestions.map((q, qIdx) => (
                                          <div
                                            key={qIdx}
                                            className="border rounded-md p-2 bg-white space-y-2"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-[11px] font-medium text-slate-700">
                                                Q{qIdx + 1}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setBatchTestSections((prev) => {
                                                    const next = [...prev];
                                                    const qs = Array.isArray(
                                                      next[sIdx].questions
                                                    ) && next[sIdx].questions.length
                                                      ? [...next[sIdx].questions]
                                                      : [];
                                                    qs.splice(qIdx, 1);
                                                    next[sIdx] = {
                                                      ...next[sIdx],
                                                      questions: qs,
                                                    };
                                                    return next;
                                                  })
                                                }
                                                className="text-[11px] text-red-600"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                            <textarea
                                              className="w-full border rounded-md px-2 py-1 text-xs"
                                              rows={2}
                                              placeholder="Question text"
                                              value={q.text || ""}
                                              onChange={(e) =>
                                                setBatchTestSections((prev) => {
                                                  const next = [...prev];
                                                  const qs = Array.isArray(
                                                    next[sIdx].questions
                                                  ) && next[sIdx].questions.length
                                                    ? [...next[sIdx].questions]
                                                    : [];
                                                  qs[qIdx] = {
                                                    ...qs[qIdx],
                                                    text: e.target.value,
                                                  };
                                                  next[sIdx] = {
                                                    ...next[sIdx],
                                                    questions: qs,
                                                  };
                                                  return next;
                                                })
                                              }
                                            />
                                            <div className="flex items-center gap-3 text-[11px]">
                                              <label className="inline-flex items-center gap-1">
                                                <input
                                                  type="checkbox"
                                                  className="w-3 h-3"
                                                  checked={!!q.isMultiple}
                                                  onChange={(e) =>
                                                    setBatchTestSections(
                                                      (prev) => {
                                                        const next = [...prev];
                                                        const qs = Array.isArray(
                                                          next[sIdx].questions
                                                        ) &&
                                                          next[sIdx].questions
                                                            .length
                                                          ? [
                                                              ...next[sIdx]
                                                                .questions,
                                                            ]
                                                          : [];
                                                        const isMultiple =
                                                          e.target.checked;
                                                        let correct =
                                                          Array.isArray(
                                                            q.correctAnswers
                                                          ) &&
                                                          q.correctAnswers.length
                                                            ? [
                                                                ...q.correctAnswers,
                                                              ]
                                                            : [];
                                                        if (
                                                          !isMultiple &&
                                                          correct.length > 1
                                                        ) {
                                                          correct = [correct[0]];
                                                        }
                                                        qs[qIdx] = {
                                                          ...qs[qIdx],
                                                          isMultiple,
                                                          correctAnswers: correct,
                                                        };
                                                        next[sIdx] = {
                                                          ...next[sIdx],
                                                          questions: qs,
                                                        };
                                                        return next;
                                                      }
                                                    )
                                                  }
                                                />
                                                <span>
                                                  Allow multiple correct answers
                                                  (otherwise single answer)
                                                </span>
                                              </label>
                                            </div>
                                            <div className="mt-1 space-y-1">
                                              <p className="text-[11px] text-slate-500">
                                                Options and correct answer(s):
                                              </p>
                                              {Array.from({ length: 4 }).map(
                                                (_, optIdx) => {
                                                  const optText =
                                                    Array.isArray(q.options) &&
                                                    q.options[optIdx]
                                                      ? q.options[optIdx]
                                                      : "";
                                                  const correctSet = Array.isArray(
                                                    q.correctAnswers
                                                  )
                                                    ? q.correctAnswers
                                                    : [];
                                                  const isChecked =
                                                    correctSet.includes(optIdx);
                                                  return (
                                                    <div
                                                      key={optIdx}
                                                      className="flex items-center gap-2"
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        className="w-3 h-3"
                                                        checked={isChecked}
                                                        onChange={() =>
                                                          setBatchTestSections(
                                                            (prev) => {
                                                              const next = [
                                                                ...prev,
                                                              ];
                                                              const qs = Array.isArray(
                                                                next[sIdx]
                                                                  .questions
                                                              ) &&
                                                                next[sIdx]
                                                                  .questions
                                                                  .length
                                                                ? [
                                                                    ...next[
                                                                      sIdx
                                                                    ]
                                                                      .questions,
                                                                  ]
                                                                : [];
                                                              const currentQ =
                                                                qs[qIdx] || {
                                                                  options: [],
                                                                  correctAnswers:
                                                                    [],
                                                                };
                                                              const currentCorrect =
                                                                Array.isArray(
                                                                  currentQ.correctAnswers
                                                                )
                                                                  ? [
                                                                      ...currentQ
                                                                        .correctAnswers,
                                                                    ]
                                                                  : [];
                                                              let updatedCorrect;
                                                              if (
                                                                currentQ.isMultiple
                                                              ) {
                                                                updatedCorrect =
                                                                  isChecked
                                                                    ? currentCorrect.filter(
                                                                        (i) =>
                                                                          i !==
                                                                          optIdx
                                                                      )
                                                                    : [
                                                                        ...currentCorrect,
                                                                        optIdx,
                                                                      ];
                                                              } else {
                                                                updatedCorrect =
                                                                  isChecked
                                                                    ? []
                                                                    : [optIdx];
                                                              }
                                                              qs[qIdx] = {
                                                                ...currentQ,
                                                                correctAnswers:
                                                                  updatedCorrect,
                                                              };
                                                              next[sIdx] = {
                                                                ...next[sIdx],
                                                                questions: qs,
                                                              };
                                                              return next;
                                                            }
                                                          )
                                                        }
                                                      />
                                                      <input
                                                        className="border rounded-md px-2 py-0.5 flex-1 text-xs"
                                                        placeholder={`Option ${
                                                          optIdx + 1
                                                        }`}
                                                        value={optText}
                                                        onChange={(e) =>
                                                          setBatchTestSections(
                                                            (prev) => {
                                                              const next = [
                                                                ...prev,
                                                              ];
                                                              const qs = Array.isArray(
                                                                next[sIdx]
                                                                  .questions
                                                              ) &&
                                                                next[sIdx]
                                                                  .questions
                                                                  .length
                                                                ? [
                                                                    ...next[
                                                                      sIdx
                                                                    ]
                                                                      .questions,
                                                                  ]
                                                                : [];
                                                              const currentQ =
                                                                qs[qIdx] || {
                                                                  options: [
                                                                    "",
                                                                    "",
                                                                    "",
                                                                    "",
                                                                  ],
                                                                  correctAnswers:
                                                                    [],
                                                                };
                                                              const opts =
                                                                Array.isArray(
                                                                  currentQ.options
                                                                )
                                                                  ? [
                                                                      ...currentQ
                                                                        .options,
                                                                    ]
                                                                  : [
                                                                      "",
                                                                      "",
                                                                      "",
                                                                      "",
                                                                    ];
                                                              opts[optIdx] =
                                                                e.target.value;
                                                              qs[qIdx] = {
                                                                ...currentQ,
                                                                options: opts,
                                                              };
                                                              next[sIdx] = {
                                                                ...next[sIdx],
                                                                questions: qs,
                                                              };
                                                              return next;
                                                            }
                                                          )
                                                        }
                                                      />
                                                    </div>
                                                  );
                                                }
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                        {sectionQuestions.length > 0 && (
                                          <div className="pt-2 flex justify-center">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setBatchTestSections((prev) => {
                                                  const next = [...prev];
                                                  const qs = Array.isArray(
                                                    next[sIdx].questions
                                                  )
                                                    ? [
                                                        ...next[sIdx].questions,
                                                      ]
                                                    : [];
                                                  qs.push({
                                                    text: "",
                                                    options: [
                                                      "",
                                                      "",
                                                      "",
                                                      "",
                                                    ],
                                                    correctAnswers: [],
                                                    isMultiple: false,
                                                  });
                                                  next[sIdx] = {
                                                    ...next[sIdx],
                                                    questions: qs,
                                                  };
                                                  return next;
                                                })
                                              }
                                              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-[11px]"
                                            >
                                              + Add Question
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">CRT Students</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select a programme and batch, then assign students to that batch.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden />
              Eligible: {crtStudents.length}
            </span>
            {selectedBatchId && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-blue-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden />
                In batch: {batchStudents.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Step 1 & 2: CRT and Batch selection */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Choose context</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">1. CRT Programme</label>
              <select
                value={selectedCrtId}
                onChange={(e) => {
                  setSelectedCrtId(e.target.value);
                  setSelectedBatchId("");
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
              >
                <option value="">Choose programme...</option>
                {crts.map((crt) => (
                  <option key={crt.id} value={crt.id}>
                    {crt.name || crt.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">2. Batch</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={!selectedCrtId}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">Choose batch...</option>
                {crtBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name || batch.id}
                  </option>
                ))}
                {selectedCrtId && crtBatches.length === 0 && (
                  <option value="" disabled>No batches — create one above</option>
                )}
              </select>
            </div>
          </div>
          {selectedCrtId && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Active:</span>
              <span className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                {selectedCrt?.name || selectedCrtId}
              </span>
              {selectedBatchId && (() => {
                const batch = crtBatches.find((b) => b.id === selectedBatchId);
                return batch ? (
                  <>
                    <span className="text-slate-300" aria-hidden>→</span>
                    <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-800">
                      {batch.name || batch.id}
                    </span>
                  </>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Step 3: Assign student (only when batch selected) */}
        {selectedCrtId && selectedBatchId && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-3">Add to batch</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-0">
                <label className="sr-only">Select student</label>
                <select
                  value={selectedStudentToAssign}
                  onChange={(e) => setSelectedStudentToAssign(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                >
                  <option value="">Choose a student to add...</option>
                  {availableForBatch.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name || student.studentName || student.regdNo || "Unnamed"}
                      {student.regdNo ? ` (${student.regdNo})` : ""}
                    </option>
                  ))}
                  {availableForBatch.length === 0 && crtStudents.length > 0 && (
                    <option value="" disabled>All eligible students are in this batch</option>
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={() => assignStudentToBatch(selectedStudentToAssign)}
                disabled={!selectedStudentToAssign || assigningStudentId === selectedStudentToAssign}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {assigningStudentId === selectedStudentToAssign ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                    Assigning...
                  </>
                ) : (
                  "Assign to batch"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Hint when incomplete */}
        {selectedCrtId && !selectedBatchId && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-bold">2</span>
            Select a batch above to assign students.
          </div>
        )}
        {!selectedCrtId && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-bold">1</span>
            Select a CRT programme, then a batch.
          </div>
        )}

        {/* Two columns: Can add / In batch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {selectedBatchId ? "Can add to batch" : "Eligible students"}
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {selectedBatchId ? availableForBatch.length : crtStudents.length}
              </span>
            </div>
            <div className="p-3 max-h-72 overflow-y-auto">
              {selectedBatchId ? (
                availableForBatch.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No one left to add.</p>
                    <p className="text-xs text-slate-400 mt-1">All eligible students are in this batch.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {availableForBatch.map((student) => (
                      <li
                        key={student.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 truncate">
                            {student.name || student.studentName || "Unnamed"}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {[student.regdNo, student.email].filter(Boolean).join(" · ") || "No details"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => assignStudentToBatch(student.id)}
                          disabled={assigningStudentId === student.id}
                          className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          {assigningStudentId === student.id ? "…" : "Add"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <>
                  {crtStudents.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500">No CRT students yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Mark admissions as CRT to see them here.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {crtStudents.map((student) => (
                        <li
                          key={student.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                        >
                          <p className="font-medium text-slate-800 truncate">
                            {student.name || student.studentName || "Unnamed"}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {[student.regdNo, student.email].filter(Boolean).join(" · ") || "No details"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {selectedBatchId
                  ? `In batch: ${crtBatches.find((b) => b.id === selectedBatchId)?.name || "—"}`
                  : "In batch"}
              </h3>
              {selectedBatchId && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {batchStudents.length}
                </span>
              )}
            </div>
            <div className="p-3 max-h-72 overflow-y-auto">
              {!selectedCrtId && (
                <div className="py-8 text-center text-sm text-slate-500">
                  Select a CRT and batch to see students.
                </div>
              )}
              {selectedCrtId && !selectedBatchId && (
                <div className="py-8 text-center text-sm text-slate-500">
                  Select a batch to manage its students.
                </div>
              )}
              {selectedBatchId && batchStudents.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">No students in this batch yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Use the panel on the left to add students.</p>
                </div>
              )}
              {selectedBatchId && batchStudents.length > 0 && (
                <ul className="space-y-2">
                  {batchStudents.map((student) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 hover:border-red-100 hover:bg-red-50/20 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 truncate">
                          {student.studentName || "Unnamed"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {[student.regdNo, student.email].filter(Boolean).join(" · ") || "No details"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStudentFromBatch(student.id)}
                        disabled={removingBatchStudentId === student.id}
                        className="shrink-0 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
                      >
                        {removingBatchStudentId === student.id ? "…" : "Remove"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
      {editingCrtId && (
        <div className="fixed inset-0 bg-black/60 bg-opacity-40 flex items-center justify-center z-50 px-4 py-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Edit CRT Programme</h3>
              <button
                type="button"
                onClick={() => setEditingCrtId("")}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={updateCrt} className="px-4 py-3 space-y-3 max-h-[70vh] overflow-y-auto">
              <input
                type="text"
                placeholder="Name (title)"
                value={editCrtForm.name}
                onChange={(e) => setEditCrtForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-md border px-3 py-2"
              />
              <textarea
                placeholder="Description"
                value={editCrtForm.description}
                onChange={(e) => setEditCrtForm((s) => ({ ...s, description: e.target.value }))}
                className="w-full rounded-md border px-3 py-2"
                rows={3}
              />
              <input
                type="text"
                placeholder="Duration (e.g. 12–16 weeks)"
                value={editCrtForm.duration}
                onChange={(e) => setEditCrtForm((s) => ({ ...s, duration: e.target.value }))}
                className="w-full rounded-md border px-3 py-2"
              />
              <input
                type="text"
                placeholder="Image URL"
                value={editCrtForm.image}
                onChange={(e) => setEditCrtForm((s) => ({ ...s, image: e.target.value }))}
                className="w-full rounded-md border px-3 py-2"
              />
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Icon</label>
                <select
                  value={editCrtForm.iconKey}
                  onChange={(e) => setEditCrtForm((s) => ({ ...s, iconKey: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="code">Code (Java/Python style)</option>
                  <option value="cpu">CPU (AIML style)</option>
                </select>
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Hours &amp; course breakdown</p>
                <input
                  type="number"
                  min="1"
                  placeholder="Total hours"
                  value={editCrtForm.totalHours}
                  onChange={(e) => setEditCrtForm((s) => ({ ...s, totalHours: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Common hrs"
                    value={editCrtForm.commonHours}
                    onChange={(e) => setEditCrtForm((s) => ({ ...s, commonHours: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Technical hrs"
                    value={editCrtForm.technicalHours}
                    onChange={(e) => setEditCrtForm((s) => ({ ...s, technicalHours: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Non-technical label"
                  value={editCrtForm.commonLabel}
                  onChange={(e) => setEditCrtForm((s) => ({ ...s, commonLabel: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Non-technical courses (comma-separated)"
                  value={editCrtForm.commonCourses}
                  onChange={(e) => setEditCrtForm((s) => ({ ...s, commonCourses: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Technical courses (comma-separated)"
                  value={editCrtForm.technicalCourses}
                  onChange={(e) => setEditCrtForm((s) => ({ ...s, technicalCourses: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingCrtId("")}
                  className="px-3 py-1.5 rounded-md bg-slate-100 text-sm hover:bg-slate-200"
                  disabled={savingCrt}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCrt || !editCrtForm.name.trim()}
                  className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm disabled:opacity-50"
                >
                  {savingCrt ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBatchTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">
                {editingBatchTestId ? "Edit Batch Test" : "Create Batch Test"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowBatchTestModal(false);
                  setEditingBatchTestId("");
                  setNewBatchTest({ name: "", durationMinutes: "" });
                }}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={createOrUpdateBatchTest}
              className="px-4 py-3 space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Test name</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newBatchTest.name}
                  onChange={(e) =>
                    setNewBatchTest((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="e.g., Batch CRT Test 1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newBatchTest.durationMinutes}
                  onChange={(e) =>
                    setNewBatchTest((s) => ({
                      ...s,
                      durationMinutes: e.target.value,
                    }))
                  }
                  placeholder="e.g., 90"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBatchTestModal(false);
                    setEditingBatchTestId("");
                    setNewBatchTest({ name: "", durationMinutes: "" });
                  }}
                  className="px-3 py-1.5 rounded-md bg-slate-100 text-xs hover:bg-slate-200"
                  disabled={creatingBatchTest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBatchTest || !newBatchTest.name.trim()}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50"
                >
                  {creatingBatchTest
                    ? editingBatchTestId
                      ? "Saving..."
                      : "Creating..."
                    : editingBatchTestId
                    ? "Save"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

  </div>
  );
}
