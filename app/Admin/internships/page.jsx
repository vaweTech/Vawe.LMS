"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db, firestoreHelpers } from "../../../lib/firebase";
import { mcqDb } from "../../../lib/firebaseMCQs";
import {
  collection as mcqCollection,
  getDocs as mcqGetDocs,
  addDoc as mcqAddDoc,
  deleteDoc as mcqDeleteDoc,
  doc as mcqDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAdminAccess } from "../AdminAccessContext";
import { tenantSegments } from "@/lib/tenantPath";
import {
  getInternshipRoleQueryValues,
  normalizeStudentsForAdmin,
} from "@/lib/studentRole";

export default function InternshipManager() {
  const router = useRouter();
  const access = useAdminAccess();
  const user = access.user;
  const loading = access.loading;
  const isAdmin =
    access.isFullAdmin || (access.isCollegeAdmin && (access.moduleLms || access.moduleCrt));

  const [internships, setInternships] = useState([]);
  const [selectedInternshipId, setSelectedInternshipId] = useState("");
  const [creating, setCreating] = useState(false);
  const [copyingCourseId, setCopyingCourseId] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [bulkCopying, setBulkCopying] = useState(false);
  const [internshipCourses, setInternshipCourses] = useState([]);
  const [deletingCourseId, setDeletingCourseId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletingInternshipId, setDeletingInternshipId] = useState("");

  const [newInternship, setNewInternship] = useState({
    name: "",
    description: "",
  });

  const [courses, setCourses] = useState([]);
  const [internshipStudents, setInternshipStudents] = useState([]);
  const [assignedInternshipStudents, setAssignedInternshipStudents] = useState([]);
  const [assigningStudentId, setAssigningStudentId] = useState("");
  const [removingStudentId, setRemovingStudentId] = useState("");
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState("");

  const selectedInternship = useMemo(
    () => internships.find((i) => i.id === selectedInternshipId) || null,
    [internships, selectedInternshipId]
  );

  const assignedStudentIds = useMemo(
    () => new Set(assignedInternshipStudents.map((s) => s.studentId)),
    [assignedInternshipStudents]
  );

  const availableInternshipStudents = useMemo(
    () =>
      internshipStudents.filter((s) => {
        if (!s) return false;
        if (assignedStudentIds.has(s.id)) return false;
        return true;
      }),
    [internshipStudents, assignedStudentIds]
  );

  const fetchInternships = useCallback(async function fetchInternships() {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, ...tenantSegments(null, "internships"))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setInternships(list);
    if (!selectedInternshipId && list.length > 0) {
      setSelectedInternshipId(list[0].id);
    }
  }, [selectedInternshipId]);

  const fetchCourses = useCallback(async function fetchCourses() {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, ...tenantSegments(null, "courses"))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCourses(list);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchInternships();
    fetchCourses();
  }, [user, fetchInternships, fetchCourses]);

  useEffect(() => {
    setSelectedStudentToAssign("");
  }, [selectedInternshipId]);

  async function deleteCourseFromInternship(courseId) {
    if (!selectedInternshipId || !courseId) return;
    if (!confirm("Delete this course from the internship? This will also remove its chapters.")) return;
    try {
      setDeletingCourseId(courseId);
      // delete chapters
      const chaptersSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          "internships",
          selectedInternshipId,
          "courses",
          courseId,
          "chapters"
        )
      );
      for (const ch of chaptersSnap.docs) {
        await firestoreHelpers.deleteDoc(
          firestoreHelpers.doc(
            db,
            ...tenantSegments(null, "internships"),
            selectedInternshipId,
            "courses",
            courseId,
            "chapters",
            ch.id
          )
        );
      }
      // delete course copy
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(null, "internships"),
          selectedInternshipId,
          "courses",
          courseId
        )
      );
      await fetchInternshipCourses(selectedInternshipId);
    } catch (e) {
      console.error(e);
      alert("Failed to delete course from internship.");
    } finally {
      setDeletingCourseId("");
    }
  }

  const fetchInternshipCourses = useCallback(
    async function fetchInternshipCourses(internshipId) {
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(null, "internships"),
          internshipId,
          "courses"
        )
      );
      setInternshipCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    []
  );

  const fetchInternshipStudents = useCallback(async function fetchInternshipStudents() {
    try {
      const studentsRef = firestoreHelpers.collection(db, ...tenantSegments(null, "students"));
      const roleValues = getInternshipRoleQueryValues(null);
      const [flagSnap, roleSnap] = await Promise.all([
        firestoreHelpers.getDocs(
          firestoreHelpers.query(
            studentsRef,
            firestoreHelpers.where("isInternship", "==", true)
          )
        ),
        firestoreHelpers.getDocs(
          firestoreHelpers.query(
            studentsRef,
            firestoreHelpers.where("role", "in", roleValues)
          )
        ),
      ]);
      const byId = new Map();
      [...flagSnap.docs, ...roleSnap.docs].forEach((d) => {
        byId.set(d.id, { id: d.id, ...d.data() });
      });
      const list = normalizeStudentsForAdmin([...byId.values()]).sort((a, b) =>
        (a.name || a.studentName || "").localeCompare(
          b.name || b.studentName || "",
          undefined,
          { sensitivity: "base" }
        )
      );
      setInternshipStudents(list);
    } catch (e) {
      console.error("Failed to fetch internship students", e);
      alert("Failed to load internship students.");
    }
  }, []);

useEffect(() => {
  if (!user) return;
  fetchInternshipStudents();
}, [user, fetchInternshipStudents]);

  const fetchAssignedInternshipStudents = useCallback(
    async function fetchAssignedInternshipStudents(targetId) {
      if (!targetId) return;
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(null, "internships"),
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
      setAssignedInternshipStudents(list);
    },
    []
  );

useEffect(() => {
  if (!selectedInternshipId) {
    setInternshipCourses([]);
    setAssignedInternshipStudents([]);
    return;
  }
  fetchInternshipCourses(selectedInternshipId);
  fetchAssignedInternshipStudents(selectedInternshipId);
}, [
  selectedInternshipId,
  fetchInternshipCourses,
  fetchAssignedInternshipStudents,
]);

  async function createInternship(e) {
    e.preventDefault();
    if (!newInternship.name.trim()) return;
    try {
      setCreating(true);
      const ref = await firestoreHelpers.addDoc(
        firestoreHelpers.collection(db, ...tenantSegments(null, "internships")),
        {
          name: newInternship.name.trim(),
          description: newInternship.description.trim(),
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || null,
        }
      );
      setNewInternship({ name: "", description: "" });
      await fetchInternships();
      setSelectedInternshipId(ref.id);
    } finally {
      setCreating(false);
    }
  }

  async function copyCourseToInternship(course) {
    if (!selectedInternshipId) return;
    try {
      setCopyingCourseId(course.id);
      // 1) Create course copy
      const courseCopyRef = await firestoreHelpers.addDoc(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(null, "internships"),
          selectedInternshipId,
          "courses"
        ),
        {
          title: course.title || "",
          description: course.description || "",
          courseCode: course.courseCode || "",
          syllabus: Array.isArray(course.syllabus) ? course.syllabus : [],
          sourceCourseId: course.id,
          copiedAt: new Date().toISOString(),
          copiedBy: user?.uid || null,
        }
      );

      // 2) Copy chapters
      const masterChaptersSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(null, "courses"),
          course.id,
          "chapters"
        )
      );
      const chapters = masterChaptersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      await Promise.all(
        chapters.map((ch) => {
          const { id: _omitId, ...payload } = ch;
          return firestoreHelpers.addDoc(
            firestoreHelpers.collection(
              db,
              ...tenantSegments(null, "internships"),
              selectedInternshipId,
              "courses",
              courseCopyRef.id,
              "chapters"
            ),
            {
              ...payload,
              copiedFromChapterId: _omitId,
              copiedAt: new Date().toISOString(),
            }
          );
        })
      );

      // 3) Copy assignments/progress tests from master course (both MCQ and Coding)
      try {
        const masterAssignmentsSnap = await mcqGetDocs(
          mcqCollection(mcqDb, "courses", course.id, "assignments")
        );
        const assignments = masterAssignmentsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        
        console.log(`Copying ${assignments.length} assignments (MCQ and Coding) from master course ${course.id}`);
        
        // Copy each assignment to the copiedcourses collection (separate from master courses)
        // Ensure all fields are preserved, including nested structures for coding assignments
        const copyResults = await Promise.allSettled(
          assignments.map(async (assignment) => {
            const { id: _omitId, ...payload } = assignment;
            // Explicitly preserve all assignment fields including type, questions, testCases, etc.
            const assignmentData = {
              title: payload.title || "",
              dueDate: payload.dueDate || null,
              day: payload.day || 1,
              type: payload.type || "mcq", // Preserve assignment type (mcq or coding)
              questions: Array.isArray(payload.questions) ? payload.questions : [], // Preserve all questions
              category: payload.category || null,
              chapterId: payload.chapterId || null,
              // Copy all other fields
              ...payload,
              // Add copy metadata
              sourceAssignmentId: _omitId, // Keep reference to original
              copiedAt: new Date().toISOString(),
              copiedBy: user?.uid || null,
            };
            
            const result = await mcqAddDoc(
              mcqCollection(mcqDb, "copiedcourses", courseCopyRef.id, "assignments"),
              assignmentData
            );
            console.log(`Copied assignment "${assignmentData.title}" (type: ${assignmentData.type}, questions: ${assignmentData.questions?.length || 0})`);
            return result;
          })
        );
        
        // Log any failures
        const failures = copyResults.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.error(`Failed to copy ${failures.length} assignments:`, failures);
        }
      } catch (assignError) {
        console.error("Error copying assignments:", assignError);
        // Don't fail the entire copy if assignments fail
      }

      alert("Course copied to internship with assignments.");
    } catch (e) {
      console.error(e);
      alert("Failed to copy course.");
    } finally {
      setCopyingCourseId("");
    }
  }

  async function copyCourseToInternshipSilently(course) {
    // Same as copyCourseToInternship but without UI spinners/alerts
    if (!selectedInternshipId) return;
    // 1) Create course copy
    const courseCopyRef = await firestoreHelpers.addDoc(
      firestoreHelpers.collection(
        db,
        "internships",
        selectedInternshipId,
        "courses"
      ),
      {
        title: course.title || "",
        description: course.description || "",
        courseCode: course.courseCode || "",
        syllabus: Array.isArray(course.syllabus) ? course.syllabus : [],
        sourceCourseId: course.id,
        copiedAt: new Date().toISOString(),
        copiedBy: user?.uid || null,
      }
    );

    // 2) Copy chapters
    const masterChaptersSnap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(db, "courses", course.id, "chapters")
    );
    const chapters = masterChaptersSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    await Promise.all(
      chapters.map((ch) => {
        const { id: _omitId, ...payload } = ch;
        return firestoreHelpers.addDoc(
          firestoreHelpers.collection(
            db,
            "internships",
            selectedInternshipId,
            "courses",
            courseCopyRef.id,
            "chapters"
          ),
          {
            ...payload,
            copiedFromChapterId: _omitId,
            copiedAt: new Date().toISOString(),
          }
        );
      })
    );

    // 3) Copy assignments/progress tests from master course (both MCQ and Coding)
    try {
      const masterAssignmentsSnap = await mcqGetDocs(
        mcqCollection(mcqDb, "courses", course.id, "assignments")
      );
      const assignments = masterAssignmentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      
      // Copy each assignment to the copiedcourses collection (separate from master courses)
      // Ensure all fields are preserved, including nested structures for coding assignments
      const copyResults = await Promise.allSettled(
        assignments.map(async (assignment) => {
          const { id: _omitId, ...payload } = assignment;
          // Explicitly preserve all assignment fields including type, questions, testCases, etc.
          const assignmentData = {
            title: payload.title || "",
            dueDate: payload.dueDate || null,
            day: payload.day || 1,
            type: payload.type || "mcq", // Preserve assignment type (mcq or coding)
            questions: Array.isArray(payload.questions) ? payload.questions : [], // Preserve all questions
            category: payload.category || null,
            chapterId: payload.chapterId || null,
            // Copy all other fields
            ...payload,
            // Add copy metadata
            sourceAssignmentId: _omitId, // Keep reference to original
            copiedAt: new Date().toISOString(),
            copiedBy: user?.uid || null,
          };
          
          return await mcqAddDoc(
            mcqCollection(mcqDb, "copiedcourses", courseCopyRef.id, "assignments"),
            assignmentData
          );
        })
      );
      
      // Log any failures
      const failures = copyResults.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error(`Failed to copy ${failures.length} assignments:`, failures);
      }
    } catch (assignError) {
      console.error("Error copying assignments:", assignError);
      // Don't fail the entire copy if assignments fail
    }
  }

  function toggleCourseSelection(courseId) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  }

  function clearSelectedCourses() {
    setSelectedCourseIds([]);
  }

  async function copySelectedCoursesToInternship() {
    if (!selectedInternshipId || selectedCourseIds.length === 0) return;
    try {
      setBulkCopying(true);
      const map = new Map(courses.map((c) => [c.id, c]));
      await Promise.all(
        selectedCourseIds.map((id) => {
          const course = map.get(id);
          return course ? copyCourseToInternshipSilently(course) : Promise.resolve();
        })
      );
      clearSelectedCourses();
      alert("Selected courses copied to internship.");
    } catch (e) {
      console.error(e);
      alert("Failed to copy selected courses.");
    } finally {
      setBulkCopying(false);
    }
  }

  async function assignStudentToInternship(studentId) {
    if (!selectedInternshipId || !studentId) return;
    const student = internshipStudents.find((s) => s.id === studentId);
    if (!student) return;
    const alreadyAssigned = assignedInternshipStudents.some(
      (s) => s.studentId === studentId
    );
    if (alreadyAssigned) {
      alert("Student already assigned to this internship.");
      return;
    }
    try {
      setAssigningStudentId(studentId);
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(
          db,
          "internships",
          selectedInternshipId,
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
      await fetchAssignedInternshipStudents(selectedInternshipId);
    } catch (e) {
      console.error(e);
      alert("Failed to assign student to internship.");
    } finally {
      setAssigningStudentId("");
    }
  }

  async function removeStudentFromInternship(recordId) {
    if (!selectedInternshipId || !recordId) return;
    try {
      setRemovingStudentId(recordId);
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(null, "internships"),
          selectedInternshipId,
          "students",
          recordId
        )
      );
      await fetchAssignedInternshipStudents(selectedInternshipId);
    } catch (e) {
      console.error(e);
      alert("Failed to remove student from internship.");
    } finally {
      setRemovingStudentId("");
    }
  }

  // Managed actions (delete internship/courses) live elsewhere now
  async function deleteInternship(id) {
    const targetId = id || selectedInternshipId;
    if (!targetId) return;
    if (!confirm("Are you sure you want to delete this internship? This will remove its copied courses, chapters, and assignments.")) return;
    try {
      setDeleting(true);
      setDeletingInternshipId(targetId);

      // Delete courses and their chapters under the internship
      const coursesSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(null, "internships"),
          targetId,
          "courses"
        )
      );
      for (const courseDoc of coursesSnap.docs) {
        const chaptersSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            ...tenantSegments(null, "internships"),
            targetId,
            "courses",
            courseDoc.id,
            "chapters"
          )
        );
        for (const ch of chaptersSnap.docs) {
          await firestoreHelpers.deleteDoc(
            firestoreHelpers.doc(
              db,
              "internships",
              targetId,
              "courses",
              courseDoc.id,
              "chapters",
              ch.id
            )
          );
        }
        // Delete assignments/progress tests from copiedcourses collection
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
          // Continue even if assignments deletion fails
        }
        await firestoreHelpers.deleteDoc(
          firestoreHelpers.doc(
            db,
            ...tenantSegments(null, "internships"),
            targetId,
            "courses",
            courseDoc.id
          )
        );
      }

      // Delete internship itself
      await firestoreHelpers.deleteDoc(
        firestoreHelpers.doc(
          db,
          ...tenantSegments(null, "internships"),
          targetId
        )
      );

      if (selectedInternshipId === targetId) {
        setSelectedInternshipId("");
        setInternshipCourses([]);
      }
      await fetchInternships();
      alert("Internship deleted.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete internship.");
    } finally {
      setDeleting(false);
      setDeletingInternshipId("");
    }
  }

  function logout() {
    signOut(auth);
  }

  if (loading) return <div>Loading...</div>;
  if (!user || !isAdmin) return <div>Access Denied</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Internship Manager</h1>
          <p className="text-sm text-slate-600">
            Copy master courses into internships and edit copies safely.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/Admin")}
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
            <h2 className="font-semibold mb-3">Create Internship</h2>
            <form onSubmit={createInternship} className="space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={newInternship.name}
                onChange={(e) =>
                  setNewInternship((s) => ({ ...s, name: e.target.value }))
                }
                className="w-full rounded-md border px-3 py-2"
              />
              <textarea
                placeholder="Description"
                value={newInternship.description}
                onChange={(e) =>
                  setNewInternship((s) => ({
                    ...s,
                    description: e.target.value,
                  }))
                }
                className="w-full rounded-md border px-3 py-2"
                rows={3}
              />
              <button
                disabled={creating}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-3">Select Internship</h2>
            <select
              value={selectedInternshipId}
              onChange={(e) => setSelectedInternshipId(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              {internships.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name || i.id}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold mb-3">Internships</h2>
            <div className="space-y-3">
              {internships.length === 0 && (
                <div className="text-sm text-slate-500">No internships yet.</div>
              )}
              {internships.map((i) => (
                <div
                  key={i.id}
                  className={`border rounded-md px-3 py-2 flex items-center justify-between ${selectedInternshipId === i.id ? "bg-blue-50" : ""}`}
                >
                  <button
                    onClick={() => setSelectedInternshipId(i.id)}
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
                    <Link
                      href={`/Admin/internships/${i.id}/manage`}
                      className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm"
                    >
                      Manage
                    </Link>
                    <button
                      onClick={() => deleteInternship(i.id)}
                      disabled={deleting && deletingInternshipId === i.id}
                      className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm disabled:opacity-50"
                    >
                      {deleting && deletingInternshipId === i.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>


        </div>

    <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Master Courses</h2>
          {selectedCourseIds.length > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-slate-100">
              Selected: {selectedCourseIds.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copySelectedCoursesToInternship}
            disabled={
              !selectedInternshipId ||
              selectedCourseIds.length === 0 ||
              bulkCopying
            }
            className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm disabled:opacity-50"
          >
            {bulkCopying ? "Copying..." : "Copy Selected to Internship"}
          </button>
          <button
            onClick={clearSelectedCourses}
            disabled={selectedCourseIds.length === 0 || bulkCopying}
            className="px-3 py-2 rounded-md bg-slate-100 text-sm disabled:opacity-50"
          >
            Clear
          </button>
          {!selectedInternshipId && (
            <div className="text-sm text-amber-600">
              Select an internship to enable copying.
            </div>
          )}
        </div>
      </div>

      

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((c) => (
          <div
            key={c.id}
            className="border rounded-lg p-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCourseIds.includes(c.id)}
                  onChange={() => toggleCourseSelection(c.id)}
                  className="h-4 w-4"
                />
                <div className="font-semibold">{c.title || "Untitled"}</div>
              </div>
              <div className="text-xs text-slate-500">
                {c.courseCode || ""}
              </div>
              <p className="mt-1 text-sm text-slate-600 line-clamp-3">
                {c.description || ""}
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                disabled={!selectedInternshipId || copyingCourseId === c.id}
                onClick={() => copyCourseToInternship(c)}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
              >
                {copyingCourseId === c.id
                  ? "Copying..."
                  : "Copy to Internship"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Internship Students</h2>
          <p className="text-sm text-slate-500">
            Only admissions marked as internship appear here. Assign them to an internship without leaving this section.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          <div>Eligible: {internshipStudents.length}</div>
          <div>Assigned: {assignedInternshipStudents.length}</div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Choose Internship</label>
          <select
            value={selectedInternshipId}
            onChange={(e) => setSelectedInternshipId(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            {internships.length === 0 && (
              <option value="">No internships available</option>
            )}
            {internships.map((internship) => (
              <option key={internship.id} value={internship.id}>
                {internship.name || internship.id}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Active Internship Details</label>
          <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-600 min-h-[3.5rem]">
            {selectedInternship ? (
              <>
                <div className="font-semibold text-slate-800">
                  {selectedInternship.name || selectedInternship.id}
                </div>
                {selectedInternship.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {selectedInternship.description}
                  </p>
                )}
              </>
            ) : (
              <p className="text-amber-600 text-sm">
                Select an internship to enable assignments.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Select Internship Student</label>
          <select
            value={selectedStudentToAssign}
            onChange={(e) => setSelectedStudentToAssign(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">Choose student...</option>
            {internshipStudents.map((student) => (
              <option
                key={student.id}
                value={student.id}
                disabled={assignedStudentIds.has(student.id)}
              >
                {student.name || student.studentName || student.regdNo || "Unnamed"}{" "}
                {student.regdNo ? `(${student.regdNo})` : ""}
                {assignedStudentIds.has(student.id) ? " - already assigned" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => assignStudentToInternship(selectedStudentToAssign)}
          disabled={
            !selectedInternshipId ||
            !selectedStudentToAssign ||
            assigningStudentId === selectedStudentToAssign
          }
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {assigningStudentId === selectedStudentToAssign
            ? "Assigning..."
            : "Assign Student"}
        </button>
      </div>
      {!selectedInternshipId && (
        <p className="mt-2 text-sm text-amber-600">
          Select an internship to enable assignments.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Eligible Students</h3>
            <span className="text-xs text-slate-500">
              {availableInternshipStudents.length}
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {availableInternshipStudents.length === 0 && (
              <p className="text-sm text-slate-500">
                No unassigned internship students available.
              </p>
            )}
            {availableInternshipStudents.map((student) => (
              <div
                key={student.id}
                className="border rounded-md p-2 flex flex-col gap-1"
              >
                <div className="font-medium">
                  {student.name || student.studentName || "Unnamed"}
                </div>
                <div className="text-xs text-slate-500">
                  {student.regdNo ? `Regd: ${student.regdNo}` : ""}
                  {student.email ? ` • ${student.email}` : ""}
                </div>
                <button
                  onClick={() => assignStudentToInternship(student.id)}
                  disabled={
                    !selectedInternshipId || assigningStudentId === student.id
                  }
                  className="self-start text-xs px-3 py-1 rounded-md bg-emerald-600 text-white disabled:opacity-50"
                >
                  {assigningStudentId === student.id ? "Assigning..." : "Assign"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2">
            <h3 className="font-semibold text-sm">
              Assigned to {selectedInternship?.name || "Internship"}
            </h3>
            {!selectedInternshipId && (
              <p className="text-xs text-amber-600">
                Select an internship to see assigned students.
              </p>
            )}
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {selectedInternshipId && assignedInternshipStudents.length === 0 && (
              <p className="text-sm text-slate-500">No students assigned yet.</p>
            )}
            {assignedInternshipStudents.map((student) => (
              <div
                key={student.id}
                className="border rounded-md p-2 flex flex-col gap-1"
              >
                <div className="font-medium">{student.studentName || "Unnamed"}</div>
                <div className="text-xs text-slate-500">
                  {student.regdNo ? `Regd: ${student.regdNo}` : ""}
                  {student.email ? ` • ${student.email}` : ""}
                </div>
                <button
                  onClick={() => removeStudentFromInternship(student.id)}
                  disabled={removingStudentId === student.id}
                  className="self-start text-xs px-3 py-1 rounded-md bg-red-600 text-white disabled:opacity-50"
                >
                  {removingStudentId === student.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
    </div>
  );
}

