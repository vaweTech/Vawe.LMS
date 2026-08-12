import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request) {
  try {
    const { programId } = await request.json();

    if (!programId) {
      return NextResponse.json(
        { error: "Program ID is required" },
        { status: 400 }
      );
    }

    // Get the program document
    const programRef = doc(db, "programs", programId);
    const programsSnap = await getDocs(collection(db, "programs"));
    const programDoc = programsSnap.docs.find(d => d.id === programId);

    if (!programDoc) {
      return NextResponse.json(
        { error: "Program not found" },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
      success: true,
      message: `Program student list updated: ${programStudentsList.length} students`,
      totalStudents: programStudentsList.length
    });
  } catch (error) {
    console.error("Error updating program student list:", error);
    return NextResponse.json(
      { error: "Failed to update program student list", details: error.message },
      { status: 500 }
    );
  }
}

