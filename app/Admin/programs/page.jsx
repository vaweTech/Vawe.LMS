"use client";
import { useEffect, useState, useCallback } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { motion } from "framer-motion";
import { tenantSegments } from "@/lib/tenantPath";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Users,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle,
  Save,
  RefreshCw
} from "lucide-react";

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);
  const [editingBatch, setEditingBatch] = useState(null);

  const [newProgram, setNewProgram] = useState({
    name: "",
    description: "",
    duration: "",
    status: "active"
  });

  const [newBatch, setNewBatch] = useState({
    classId: "",
    className: "",
    startDate: "",
    endDate: "",
    schedule: "",
    maxStudents: "30",
    instructor: "",
    status: "active",
    courseIds: [] // selected course IDs to attach to batch
  });
  const [allCourses, setAllCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Fetch students from a class to get allocated student names
  const fetchStudentsFromClass = async (classId) => {
    try {
      const studentsRef = collection(db, ...tenantSegments(null, "students"));
      const studentsSnapshot = await getDocs(studentsRef);
      const allStudents = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter students by classId (supporting both classId and classIds array)
      const classStudents = allStudents.filter(student => {
        if (Array.isArray(student.classIds)) {
          return student.classIds.includes(classId);
        }
        return student.classId === classId;
      });
      
      // Return array of student names and details
      return classStudents.map(student => ({
        id: student.id,
        name: student.name || student.studentName || 'Unknown',
        email: student.email || '',
        regdNo: student.regdNo || student.registrationNumber || student.regNo || ''
      }));
    } catch (error) {
      console.error("Error fetching students from class:", error);
      return [];
    }
  };

  // Update program's student list by aggregating all students from all batches
  // This function is called automatically when batches are created/updated/deleted
  // To update from outside this component (e.g., when students are enrolled), use:
  // POST /api/programs/update-student-list with { programId: "..." }
  const updateProgramStudentList = async (programId) => {
    try {
      const programRef = doc(db, ...tenantSegments(null, "programs"), programId);
      const programSnap = await getDocs(collection(db, ...tenantSegments(null, "programs")));
      const programDoc = programSnap.docs.find(d => d.id === programId);
      
      if (!programDoc) return;
      
      const programData = { id: programDoc.id, ...programDoc.data() };

      // Get all students from all batches in the program
      const allProgramStudents = new Map(); // Use Map to avoid duplicates by email/id
      
      if (Array.isArray(programData.batches)) {
        for (const batch of programData.batches) {
          if (Array.isArray(batch.enrolledStudents)) {
            for (const student of batch.enrolledStudents) {
              // Use email as unique key, or id if email not available
              const key = student.email || student.id || student.name;
              if (key && !allProgramStudents.has(key)) {
                allProgramStudents.set(key, {
                  id: student.id || '',
                  name: student.name || student.studentName || 'Unknown',
                  email: student.email || '',
                  regdNo: student.regdNo || student.registrationNumber || student.regNo || '',
                  batchId: batch.id,
                  batchName: batch.name || ''
                });
              }
            }
          }
          
          // Also include allocated students from class (if enrolledStudents is empty but allocatedStudentNames exists)
          if (Array.isArray(batch.allocatedStudentNames) && (!batch.enrolledStudents || batch.enrolledStudents.length === 0)) {
            for (const studentName of batch.allocatedStudentNames) {
              const key = studentName;
              if (!allProgramStudents.has(key)) {
                allProgramStudents.set(key, {
                  name: studentName,
                  email: '',
                  batchId: batch.id,
                  batchName: batch.name || ''
                });
              }
            }
          }
        }
      }
      
      // Convert Map to array
      const programStudentsList = Array.from(allProgramStudents.values());
      
      // Update program with aggregated student list
      await updateDoc(programRef, {
        students: programStudentsList,
        totalStudents: programStudentsList.length,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Updated program ${programId} student list: ${programStudentsList.length} students`);
    } catch (error) {
      console.error("Error updating program student list:", error);
    }
  };

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const programsRef = collection(db, ...tenantSegments(null, "programs"));
      const snapshot = await getDocs(programsRef);
      const programsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPrograms(programsData);
    } catch (error) {
      console.error("Error fetching programs:", error);
      alert("Failed to load programs");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const classesRef = collection(db, ...tenantSegments(null, "classes"));
      const snapshot = await getDocs(classesRef);
      const classesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching classes:", error);
      alert("Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    fetchClasses();
  }, [fetchPrograms, fetchClasses]);

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!newProgram.name) {
      alert("Please enter a program name");
      return;
    }

    try {
      const programData = {
        ...newProgram,
        batches: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, ...tenantSegments(null, "programs")), programData);
      alert("Program created successfully!");
      setNewProgram({ name: "", description: "", duration: "", fee: "", status: "active" });
      setShowProgramForm(false);
      fetchPrograms();
    } catch (error) {
      console.error("Error creating program:", error);
      alert("Failed to create program");
    }
  };

  const handleUpdateProgram = async () => {
    if (!editingProgram || !editingProgram.id) return;
    if (!editingProgram.name) {
      alert("Please enter a program name");
      return;
    }

    try {
      const programRef = doc(db, ...tenantSegments(null, "programs"), editingProgram.id);
      await updateDoc(programRef, {
        name: editingProgram.name,
        description: editingProgram.description,
        duration: editingProgram.duration,
        status: editingProgram.status,
        updatedAt: serverTimestamp()
      });
      alert("Program updated successfully!");
      setEditingProgram(null);
      fetchPrograms();
    } catch (error) {
      console.error("Error updating program:", error);
      alert("Failed to update program");
    }
  };

  const handleDeleteProgram = async (programId, programName) => {
    if (!confirm(`Are you sure you want to delete "${programName}"? This will also delete all batches in this program.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, ...tenantSegments(null, "programs"), programId));
      alert("Program deleted successfully!");
      fetchPrograms();
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Failed to delete program");
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!selectedProgram || !newBatch.classId || !newBatch.startDate) {
      alert("Please fill in all required fields (Select Class, Start Date)");
      return;
    }

    try {
      const programRef = doc(db, ...tenantSegments(null, "programs"), selectedProgram.id);
      const currentProgram = programs.find(p => p.id === selectedProgram.id);
      const currentBatches = currentProgram?.batches || [];

      // Get selected class details
      const selectedClass = classes.find(c => c.id === newBatch.classId);
      if (!selectedClass) {
        alert("Selected class not found");
        return;
      }

      // Fetch students from the selected class to get allocated student names
      const classStudents = await fetchStudentsFromClass(newBatch.classId);
      const allocatedStudentNames = classStudents.map(student => student.name);

      const batchData = {
        ...newBatch,
        name: selectedClass.name || selectedClass.className || `Class ${selectedClass.id}`, // Use class name from Firebase
        id: Date.now().toString(), // Simple ID generation
        maxStudents: parseInt(newBatch.maxStudents) || 30,
        enrolledStudents: [],
        allocatedStudentNames: allocatedStudentNames, // Store allocated student names from class
        courseIds: Array.isArray(newBatch.courseIds) ? newBatch.courseIds : [],
        createdAt: new Date().toISOString()
      };

      const updatedBatches = [...currentBatches, batchData];

      await updateDoc(programRef, {
        batches: updatedBatches,
        updatedAt: serverTimestamp()
      });

      // Update program's student list after creating batch
      await updateProgramStudentList(selectedProgram.id);

      alert(`Batch created successfully! ${allocatedStudentNames.length} students allocated from class.`);
      setNewBatch({ classId: "", className: "", startDate: "", endDate: "", schedule: "", maxStudents: "30", instructor: "", status: "active" });
      setShowBatchForm(false);
      fetchPrograms();
    } catch (error) {
      console.error("Error creating batch:", error);
      alert("Failed to create batch");
    }
  };

  const handleUpdateBatch = async () => {
    if (!selectedProgram || !editingBatch || !editingBatch.id) return;
    if (!editingBatch.classId || !editingBatch.startDate) {
      alert("Please fill in all required fields (Select Class, Start Date)");
      return;
    }

    try {
      const programRef = doc(db, ...tenantSegments(null, "programs"), selectedProgram.id);
      const currentProgram = programs.find(p => p.id === selectedProgram.id);
      const currentBatches = currentProgram?.batches || [];
      
      // Get selected class details
      const selectedClass = classes.find(c => c.id === editingBatch.classId);
      if (!selectedClass) {
        alert("Selected class not found");
        return;
      }

      // Fetch students from the selected class to get allocated student names (if class changed)
      const classStudents = await fetchStudentsFromClass(editingBatch.classId);
      const allocatedStudentNames = classStudents.map(student => student.name);

      const updatedBatch = {
        ...editingBatch,
        name: selectedClass.name || selectedClass.className || `Class ${selectedClass.id}`, // Use class name from Firebase
        maxStudents: parseInt(editingBatch.maxStudents) || 30,
        allocatedStudentNames: allocatedStudentNames, // Update allocated student names from class
        courseIds: Array.isArray(editingBatch.courseIds) ? editingBatch.courseIds : []
      };

      const updatedBatches = currentBatches.map(batch =>
        batch.id === editingBatch.id ? updatedBatch : batch
      );

      await updateDoc(programRef, {
        batches: updatedBatches,
        updatedAt: serverTimestamp()
      });

      // Update program's student list after updating batch
      await updateProgramStudentList(selectedProgram.id);

      alert(`Batch updated successfully! ${allocatedStudentNames.length} students allocated from class.`);
      setEditingBatch(null);
      fetchPrograms();
    } catch (error) {
      console.error("Error updating batch:", error);
      alert("Failed to update batch");
    }
  };

  const handleDeleteBatch = async (batchId, batchName) => {
    if (!confirm(`Are you sure you want to delete batch "${batchName}"?`)) {
      return;
    }

    try {
      const programRef = doc(db, ...tenantSegments(null, "programs"), selectedProgram.id);
      const currentProgram = programs.find(p => p.id === selectedProgram.id);
      const currentBatches = currentProgram?.batches || [];
      const updatedBatches = currentBatches.filter(batch => batch.id !== batchId);

      await updateDoc(programRef, {
        batches: updatedBatches,
        updatedAt: serverTimestamp()
      });

      // Update program's student list after deleting batch
      await updateProgramStudentList(selectedProgram.id);

      alert("Batch deleted successfully!");
      fetchPrograms();
    } catch (error) {
      console.error("Error deleting batch:", error);
      alert("Failed to delete batch");
    }
  };

  const openBatchForm = async (program) => {
    setSelectedProgram(program);
    setShowBatchForm(true);
    setNewBatch({ classId: "", className: "", startDate: "", endDate: "", schedule: "", maxStudents: "30", instructor: "", status: "active" });
    setEditingBatch(null);
    // Refresh classes to get latest data
    await fetchClasses();
    await fetchCourses();
  };

  const openEditBatch = async (program, batch) => {
    setSelectedProgram(program);
    // Refresh classes to get latest data
    await fetchClasses();
    await fetchCourses();
    
    // Get fresh classes from state (will be updated after fetchClasses completes)
    // Use a small delay to ensure state is updated, or fetch directly
    const classesRef = collection(db, ...tenantSegments(null, "classes"));
    const classesSnapshot = await getDocs(classesRef);
    const freshClasses = classesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Ensure classId is set when editing - try to find matching class by name if classId is missing
    let classId = batch.classId || "";
    if (!classId && batch.name) {
      // Try to find class by name (for backwards compatibility with old batches)
      const matchingClass = freshClasses.find(c => 
        (c.name && c.name === batch.name) || 
        (c.className && c.className === batch.name)
      );
      if (matchingClass) {
        classId = matchingClass.id;
      }
    }
    setEditingBatch({ 
      ...batch, 
      classId: classId,
      className: batch.className || batch.name || "",
      courseIds: Array.isArray(batch.courseIds) ? batch.courseIds : []
    });
    setShowBatchForm(true);
  };

  // Fetch all courses for selection when creating/editing batches
  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const coursesRef = collection(db, ...tenantSegments(null, "courses"));
      const snap = await getDocs(coursesRef);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllCourses(list);
    } catch (e) {
      console.error('Error loading courses:', e);
      setAllCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <CheckAdminAuth>
      <div className="min-h-screen bg-white p-4 sm:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Programs</h1>
            <p className="text-gray-600 mt-1">Create and manage programs with batches/classes</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchPrograms}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => router.push("/Admin")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Admin
            </button>
          </div>
        </div>

        {/* Create Program Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowProgramForm(true);
              setEditingProgram(null);
            }}
            className="px-4 py-2 bg-[#0B3B8C] text-white rounded-lg hover:bg-[#072C69] flex items-center space-x-2 shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Program</span>
          </button>
        </div>

        {/* Programs List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {programs.map((program) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Program Header */}
              <div className="bg-[#0B3B8C] p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{program.name}</h3>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        program.status === 'active' ? 'bg-[#00B8B5] text-white' : 'bg-[#F2B233] text-gray-900'
                      }`}>
                        {program.status || 'active'}
                      </span>
                      {program.fee > 0 && (
                        <span className="text-sm">₹{program.fee.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setEditingProgram({ ...program });
                        setShowProgramForm(true);
                      }}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                      title="Edit Program"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(program.id, program.name)}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                      title="Delete Program"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {program.description && (
                  <p className="text-sm mt-2 opacity-90 line-clamp-2">{program.description}</p>
                )}
                {program.duration && (
                  <p className="text-sm mt-2 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {program.duration}
                  </p>
                )}
              </div>

              {/* Batches Section */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-violet-600" />
                      Batches ({program.batches?.length || 0})
                    </h4>
                    {program.totalStudents !== undefined && (
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        Total Students: {program.totalStudents}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        await updateProgramStudentList(program.id);
                        await fetchPrograms();
                        alert("✅ Program student list updated!");
                      }}
                      className="px-3 py-1.5 bg-[#00B8B5] text-white rounded-lg hover:bg-[#009C9A] text-sm flex items-center space-x-1"
                      title="Refresh student list from all batches"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Refresh Students</span>
                    </button>
                    <button
                      onClick={() => openBatchForm(program)}
                      className="px-3 py-1.5 bg-[#F46F3E] text-white rounded-lg hover:bg-[#E45E2A] text-sm flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Batch</span>
                    </button>
                  </div>
                </div>

                {/* Batches List */}
                <div className="space-y-3">
                  {program.batches && program.batches.length > 0 ? (
                    program.batches.map((batch) => {
                      const enrolled = batch.enrolledStudents?.length || 0;
                      const maxStudents = batch.maxStudents || 30;
                      const percentage = Math.round((enrolled / maxStudents) * 100);

                      return (
                        <div
                          key={batch.id}
                          className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-violet-300 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900">{batch.name}</h5>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  batch.status === 'active' ? 'bg-[#00B8B5] text-white' : 'bg-[#F2B233] text-gray-900'
                                }`}>
                                  {batch.status || 'active'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => openEditBatch(program, batch)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit Batch"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBatch(batch.id, batch.name)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Batch"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-sm text-gray-600">
                            {batch.startDate && (
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1.5" />
                                <span>Start: {new Date(batch.startDate).toLocaleDateString('en-IN')}</span>
                              </div>
                            )}
                            {batch.endDate && (
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1.5" />
                                <span>End: {new Date(batch.endDate).toLocaleDateString('en-IN')}</span>
                              </div>
                            )}
                            {batch.schedule && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1.5" />
                                <span>{batch.schedule}</span>
                              </div>
                            )}
                            {batch.instructor && (
                              <div className="flex items-center">
                                <Users className="w-4 h-4 mr-1.5" />
                                <span>{batch.instructor}</span>
                              </div>
                            )}
                          </div>

                          {/* Enrollment Progress */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600">Enrollment</span>
                              <span className="text-xs font-bold text-violet-600">
                                {enrolled}/{maxStudents}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  percentage >= 100 ? 'bg-[#F46F3E]' : percentage >= 75 ? 'bg-[#F2B233]' : 'bg-[#00B8B5]'
                                }`}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                          </div>

                          {/* Allocated Students List */}
                          {batch.allocatedStudentNames && Array.isArray(batch.allocatedStudentNames) && batch.allocatedStudentNames.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-700">Allocated Students ({batch.allocatedStudentNames.length})</span>
                              </div>
                              <div className="max-h-24 overflow-y-auto">
                                <div className="flex flex-wrap gap-1">
                                  {batch.allocatedStudentNames.slice(0, 10).map((name, idx) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                                      {name}
                                    </span>
                                  ))}
                                  {batch.allocatedStudentNames.length > 10 && (
                                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                      +{batch.allocatedStudentNames.length - 10} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No batches yet</p>
                      <button
                        onClick={() => openBatchForm(program)}
                        className="mt-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
                      >
                        Add first batch
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {programs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 font-medium">No programs yet</p>
            <p className="text-sm text-gray-500 mt-1">Create your first program to get started</p>
          </div>
        )}

        {/* Program Form Modal */}
        {showProgramForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b bg-[#F2B233]">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingProgram ? "Edit Program" : "Create New Program"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowProgramForm(false);
                      setEditingProgram(null);
                      setNewProgram({ name: "", description: "", duration: "", fee: "", status: "active" });
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <form onSubmit={editingProgram ? (e) => { e.preventDefault(); handleUpdateProgram(); } : handleCreateProgram} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Program Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProgram ? editingProgram.name : newProgram.name}
                      onChange={(e) => editingProgram 
                        ? setEditingProgram({ ...editingProgram, name: e.target.value })
                        : setNewProgram({ ...newProgram, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="e.g., Full Stack Development"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={editingProgram ? editingProgram.description : newProgram.description}
                      onChange={(e) => editingProgram
                        ? setEditingProgram({ ...editingProgram, description: e.target.value })
                        : setNewProgram({ ...newProgram, description: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="Program description..."
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={editingProgram ? editingProgram.duration : newProgram.duration}
                        onChange={(e) => editingProgram
                          ? setEditingProgram({ ...editingProgram, duration: e.target.value })
                          : setNewProgram({ ...newProgram, duration: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        placeholder="e.g., 6 months"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fee (₹)</label>
                      <input
                        type="number"
                        value={editingProgram ? editingProgram.fee : newProgram.fee}
                        onChange={(e) => editingProgram
                          ? setEditingProgram({ ...editingProgram, fee: e.target.value })
                          : setNewProgram({ ...newProgram, fee: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={editingProgram ? editingProgram.status : newProgram.status}
                      onChange={(e) => editingProgram
                        ? setEditingProgram({ ...editingProgram, status: e.target.value })
                        : setNewProgram({ ...newProgram, status: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProgramForm(false);
                        setEditingProgram(null);
                        setNewProgram({ name: "", description: "", duration: "", fee: "", status: "active" });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#0B3B8C] text-white rounded-lg hover:bg-[#072C69] transition-colors flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingProgram ? "Update" : "Create"} Program</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Batch Form Modal */}
        {showBatchForm && selectedProgram && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b bg-[#00B8B5]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {editingBatch ? "Edit Batch" : "Create New Batch"}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">Program: {selectedProgram.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowBatchForm(false);
                      setEditingBatch(null);
                      setSelectedProgram(null);
                      setNewBatch({ name: "", startDate: "", endDate: "", schedule: "", maxStudents: "30", instructor: "", status: "active" });
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <form onSubmit={editingBatch ? (e) => { e.preventDefault(); handleUpdateBatch(); } : handleCreateBatch} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Class <span className="text-red-500">*</span>
                    </label>
                    {loadingClasses ? (
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                        <span className="text-sm text-gray-500">Loading classes...</span>
                      </div>
                    ) : (
                      <select
                        value={editingBatch ? editingBatch.classId : newBatch.classId}
                        onChange={(e) => {
                          const selectedClassId = e.target.value;
                          const selectedClass = classes.find(c => c.id === selectedClassId);
                          if (editingBatch) {
                            setEditingBatch({ 
                              ...editingBatch, 
                              classId: selectedClassId,
                              className: selectedClass?.name || selectedClass?.className || ""
                            });
                          } else {
                            setNewBatch({ 
                              ...newBatch, 
                              classId: selectedClassId,
                              className: selectedClass?.name || selectedClass?.className || ""
                            });
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">-- Select a Class --</option>
                        {classes.map((classItem) => (
                          <option key={classItem.id} value={classItem.id}>
                            {classItem.name || classItem.className || `Class ${classItem.id}`}
                          </option>
                        ))}
                      </select>
                    )}
                    {classes.length === 0 && !loadingClasses && (
                      <p className="mt-1 text-xs text-amber-600">
                        No classes found. Please create classes first in the User Manager.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={editingBatch ? editingBatch.startDate : newBatch.startDate}
                        onChange={(e) => editingBatch
                          ? setEditingBatch({ ...editingBatch, startDate: e.target.value })
                          : setNewBatch({ ...newBatch, startDate: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={editingBatch ? editingBatch.endDate : newBatch.endDate}
                        onChange={(e) => editingBatch
                          ? setEditingBatch({ ...editingBatch, endDate: e.target.value })
                          : setNewBatch({ ...newBatch, endDate: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                    <input
                      type="text"
                      value={editingBatch ? editingBatch.schedule : newBatch.schedule}
                      onChange={(e) => editingBatch
                        ? setEditingBatch({ ...editingBatch, schedule: e.target.value })
                        : setNewBatch({ ...newBatch, schedule: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Mon, Wed, Fri - 10 AM to 12 PM"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Students</label>
                      <input
                        type="number"
                        value={editingBatch ? editingBatch.maxStudents : newBatch.maxStudents}
                        onChange={(e) => editingBatch
                          ? setEditingBatch({ ...editingBatch, maxStudents: e.target.value })
                          : setNewBatch({ ...newBatch, maxStudents: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                        placeholder="30"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                      <input
                        type="text"
                        value={editingBatch ? editingBatch.instructor : newBatch.instructor}
                        onChange={(e) => editingBatch
                          ? setEditingBatch({ ...editingBatch, instructor: e.target.value })
                          : setNewBatch({ ...newBatch, instructor: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Instructor name"
                      />
                    </div>
                  </div>

                  {/* Courses selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attach Courses to this Batch</label>
                    {loadingCourses ? (
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                        <span className="text-sm text-gray-500">Loading courses...</span>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {allCourses && allCourses.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {allCourses.map((c) => {
                              const checked = editingBatch
                                ? (Array.isArray(editingBatch.courseIds) && editingBatch.courseIds.includes(c.id))
                                : (Array.isArray(newBatch.courseIds) && newBatch.courseIds.includes(c.id));
                              return (
                                <label key={c.id} className="flex items-center gap-2 text-sm bg-white rounded border border-gray-200 p-2 hover:border-blue-300">
                                  <input
                                    type="checkbox"
                                    checked={!!checked}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      if (editingBatch) {
                                        const prev = Array.isArray(editingBatch.courseIds) ? editingBatch.courseIds : [];
                                        setEditingBatch({
                                          ...editingBatch,
                                          courseIds: isChecked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                                        });
                                      } else {
                                        const prev = Array.isArray(newBatch.courseIds) ? newBatch.courseIds : [];
                                        setNewBatch({
                                          ...newBatch,
                                          courseIds: isChecked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                                        });
                                      }
                                    }}
                                  />
                                  <span className="truncate">
                                    {c.title || c.name || 'Untitled'}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No courses found.</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Selected courses will be associated with this batch.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={editingBatch ? editingBatch.status : newBatch.status}
                      onChange={(e) => editingBatch
                        ? setEditingBatch({ ...editingBatch, status: e.target.value })
                        : setNewBatch({ ...newBatch, status: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="completed">Completed</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBatchForm(false);
                        setEditingBatch(null);
                        setSelectedProgram(null);
                        setNewBatch({ classId: "", className: "", startDate: "", endDate: "", schedule: "", maxStudents: "30", instructor: "", status: "active" });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#0B3B8C] text-white rounded-lg hover:bg-[#072C69] transition-colors flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingBatch ? "Update" : "Create"} Batch</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </CheckAdminAuth>
  );
}

