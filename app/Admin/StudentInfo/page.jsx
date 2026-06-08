"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc, getDoc, query, where, writeBatch } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { useRouter } from "next/navigation";
import { CreditCard, DollarSign, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";
import { makeAuthenticatedRequest, handleAuthError } from "@/lib/authUtils";
import {
  isCrtStudentRole,
  isScopedInternshipRole,
  isSkillwinsStudentRole,
  matchesStudentRoleFilter,
  inferStudentRole,
  formatStudentRoleLabel,
  normalizeStudentsForAdmin,
} from "@/lib/studentRole";

export default function StudentListPage() {
      const router = useRouter();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [lockFilter, setLockFilter] = useState("all"); // "all", "locked", "unlocked"
  const [roleFilter, setRoleFilter] = useState(""); // "", "student", "internship", "crtStudent"
  const [deptFilter, setDeptFilter] = useState(""); // branch / department
  const [courseFilter, setCourseFilter] = useState(""); // course title
  const [batchFilter, setBatchFilter] = useState(""); // classId / batch
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("online"); // "online" or "cash"
  const [showCashSuccess, setShowCashSuccess] = useState(false);
  const [waSendingId, setWaSendingId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [showEditFeeModal, setShowEditFeeModal] = useState(false);
  const [editFeeStudent, setEditFeeStudent] = useState(null);
  const [newTotalFee, setNewTotalFee] = useState("");
  const [attendanceCounts, setAttendanceCounts] = useState({});
  // Course-wise attendance (overall) modal state
  const [allCourses, setAllCourses] = useState([]);
  const [showAttendanceView, setShowAttendanceView] = useState(false);
  const [attendanceStudent, setAttendanceStudent] = useState(null);
  const [attendanceCourseId, setAttendanceCourseId] = useState("");
  const [attendanceCalcLoading, setAttendanceCalcLoading] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0, percent: 0, trainerPresent: 0, selfPresent: 0, unlocked: 0, attendedOfUnlocked: 0, percentOfUnlocked: 0 });
  const [attendancePercentByStudent, setAttendancePercentByStudent] = useState({});

  // Enhanced error handling for authentication
  const handleAuthExpired = () => {
    alert('Your session has expired. Please log in again.');
    router.push('/auth/login');
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Precompute attendance percentage per student (single primary course) for table column
  useEffect(() => {
    (async () => {
      try {
        if (!students.length || !allCourses.length) {
          setAttendancePercentByStudent({});
          return;
        }
        const result = {};
        for (const s of students) {
          const titles = Array.isArray(s.coursesTitle) ? s.coursesTitle : (s.coursesTitle ? [s.coursesTitle] : []);
          const matched = allCourses.find((c) => titles.includes(c.title));
          const courseId = matched?.id;
          if (!courseId) {
            result[s.id] = "-";
            continue;
          }
          // Compute quick percent using the same logic as modal, but per student and first course
          try {
            // Sets to accumulate sessions by chapterId
            const trainerChapters = new Set();
            const trainerPresentChapters = new Set();
            const selfChapters = new Set();

            const studentDocId = s.id;
            const studentUid = s.uid || s.userId || null;
            const classIds = Array.isArray(s.classIds) ? s.classIds : (s.classId ? [s.classId] : []);

            // Trainer attendance
            const attCol = collection(db, "attendance");
            let trainerSnap;
            try {
              trainerSnap = await getDocs(query(attCol, where("type", "==", "trainer"), where("courseId", "==", courseId)));
            } catch (_) {
              const typeOnly = await getDocs(query(attCol, where("type", "==", "trainer")));
              const docs = typeOnly.docs.filter((d) => (d.data()?.courseId || "") === courseId);
              trainerSnap = { docs };
            }
            trainerSnap.docs.forEach((docSnap) => {
              const data = docSnap.data() || {};
              const chId = data.chapterId;
              if (!chId) return;
              if (classIds.length && data.classId && !classIds.includes(data.classId)) return;
              trainerChapters.add(chId);
              const arr = Array.isArray(data.present) ? data.present : [];
              if (arr.includes(studentDocId)) trainerPresentChapters.add(chId);
            });

            // Self attendance
            if (studentUid) {
              let selfSnap;
              try {
                selfSnap = await getDocs(query(attCol, where("type", "==", "self"), where("courseId", "==", courseId), where("userId", "==", studentUid)));
              } catch (_) {
                try {
                  const q1 = await getDocs(query(attCol, where("type", "==", "self"), where("userId", "==", studentUid)));
                  const docs = q1.docs.filter((d) => (d.data()?.courseId || "") === courseId);
                  selfSnap = { docs };
                } catch {
                  const q2 = await getDocs(query(attCol, where("type", "==", "self")));
                  const docs = q2.docs.filter((d) => (d.data()?.courseId || "") === courseId && (d.data()?.userId || "") === studentUid);
                  selfSnap = { docs };
                }
              }
              selfSnap.docs.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const chId = data.chapterId;
                if (!chId) return;
                selfChapters.add(chId);
              });
            }

            const totalChapters = new Set([...trainerChapters, ...selfChapters]);
            const selfOnlyPresent = new Set([...selfChapters].filter((ch) => !trainerChapters.has(ch)));
            const presentChapters = new Set([...trainerPresentChapters, ...selfOnlyPresent]);
            // Unlocked
            const unlockedArr = (s.chapterAccess && s.chapterAccess[courseId]) || [];
            const unlockedSet = new Set(Array.isArray(unlockedArr) ? unlockedArr : []);
            const unlocked = unlockedSet.size;
            const attendedOfUnlocked = unlocked > 0 ? [...presentChapters].filter((ch) => unlockedSet.has(ch)).length : 0;
            const percentOfUnlocked = unlocked > 0 ? Math.round((attendedOfUnlocked / unlocked) * 100) : 0;
            result[s.id] = unlocked > 0 ? `${unlocked} • ${percentOfUnlocked}%` : "-";
          } catch {
            result[s.id] = "-";
          }
        }
        setAttendancePercentByStudent(result);
      } catch {
        setAttendancePercentByStudent({});
      }
    })();
  }, [students, allCourses]);

  // Load all courses once for mapping titles -> ids
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "courses"));
        setAllCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (_) {
        setAllCourses([]);
      }
    })();
  }, []);

  // Load attendance summary (last 30 days) for all students
  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const since = new Date(today);
        since.setDate(since.getDate() - 30);
        const y = since.getFullYear();
        const m = String(since.getMonth() + 1).padStart(2, "0");
        const d = String(since.getDate()).padStart(2, "0");
        const minDateStr = `${y}-${m}-${d}`;
        const attCol = collection(db, "attendance");
        let snap;
        try {
          // Preferred: filter by type and date range (may require composite index)
          const attQuery = query(attCol, where("type", "==", "trainer"), where("date", ">=", minDateStr));
          snap = await getDocs(attQuery);
        } catch (indexErr) {
          // Fallback: filter by type only, then filter by date in memory
          const attQueryTypeOnly = query(attCol, where("type", "==", "trainer"));
          snap = await getDocs(attQueryTypeOnly);
        }
        const counts = {};
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const dateStr = String(data.date || "");
          if (dateStr && dateStr >= minDateStr) {
            const present = Array.isArray(data.present) ? data.present : [];
            present.forEach((sid) => {
              counts[sid] = (counts[sid] || 0) + 1;
            });
          }
        });
        setAttendanceCounts(counts);
      } catch (e) {
        // Non-blocking
        console.warn("Failed to load attendance summary:", e);
      }
    })();
  }, []);

  // Fetch current user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUserRole(userData.role || "");
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Prevent navigation during payment processing
  useEffect(() => {
    if (isProcessingPayment) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = "Payment is being processed. Please wait...";
        return "Payment is being processed. Please wait...";
      };

      const handlePopState = (e) => {
        e.preventDefault();
        alert("Please wait for payment processing to complete.");
        window.history.pushState(null, "", window.location.href);
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("popstate", handleBeforeUnload);
      window.history.pushState(null, "", window.location.href);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("popstate", handleBeforeUnload);
      };
    }
  }, [isProcessingPayment]);

  async function fetchStudents() {
    setLoading(true);
    const snap = await getDocs(collection(db, "students"));
    setStudents(
      normalizeStudentsForAdmin(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    setLoading(false);
  }

  const getStudentRole = (s) => inferStudentRole(s);

  const departments = Array.from(
    new Set(
      students
        .map((s) => s.branch || s.department || "")
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const courses = Array.from(
    new Set(
      students.flatMap((s) => {
        const titles = Array.isArray(s.coursesTitle)
          ? s.coursesTitle
          : s.courseTitle
          ? [s.courseTitle]
          : [];
        return titles;
      })
    )
  ).sort((a, b) => a.localeCompare(b));

  const batches = Array.from(
    new Set(
      students
        .map((s) => (Array.isArray(s.classIds) ? s.classIds[0] : s.classId || ""))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  // Students filtered by phone, lock, role, department, course and batch (for table and summary)
  const filteredStudents = students.filter((s) => {
    if (phoneQuery) {
      const digits = String(s.phone1 || s.phone || "").replace(/\D/g, "");
      const q = phoneQuery.replace(/\D/g, "");
      if (!digits.includes(q)) return false;
    }
    const isLocked = Boolean(s.locked);
    if (lockFilter === "locked" && !isLocked) return false;
    if (lockFilter === "unlocked" && isLocked) return false;
    if (roleFilter && !matchesStudentRoleFilter(getStudentRole(s), roleFilter)) return false;

    const dept = s.branch || s.department || "";
    if (deptFilter && dept !== deptFilter) return false;

    const titles = Array.isArray(s.coursesTitle)
      ? s.coursesTitle
      : s.courseTitle
      ? [s.courseTitle]
      : [];
    if (courseFilter && !titles.includes(courseFilter)) return false;

    const batch = Array.isArray(s.classIds) ? s.classIds[0] : s.classId || "";
    if (batchFilter && batch !== batchFilter) return false;

    return true;
  });

  // Helper to safely parse JSON responses
  async function safeParseJsonResponse(res) {
    try {
      const text = await res.text();
      if (!text || !text.trim()) return { data: null, text: text || "" };
      // Remove any BOM or leading whitespace
      const cleanText = text.trim().replace(/^\uFEFF/, '');
      // Try to find JSON object in the text (in case there's HTML before/after)
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[0]);
          return { data, text };
        } catch (parseErr) {
          // JSON match found but parsing failed
          return { data: null, text };
        }
      }
      return { data: null, text };
    } catch (err) {
      console.warn("Failed to read response:", err);
      return { data: null, text: "" };
    }
  }

  async function deleteStudentFirestoreOnly(studentId) {
    try {
      const studentDocRef = doc(db, "students", studentId);
      const paymentsSnap = await getDocs(collection(studentDocRef, "payments"));
      if (!paymentsSnap.empty) {
        const batch = writeBatch(db);
        paymentsSnap.forEach((paymentDoc) => batch.delete(paymentDoc.ref));
        await batch.commit();
      }
      await deleteDoc(studentDocRef);
      return true;
    } catch (error) {
      console.error("Fallback Firestore delete failed:", error);
      alert(error?.message || "Failed to delete student via fallback.");
      return false;
    }
  }

  async function handleDeleteStudent(id) {
    const confirmed = confirm(
      "Delete this student from the system? This will also remove their login access."
    );
    if (!confirmed) return;

    try {
      const res = await makeAuthenticatedRequest("/api/delete-student", {
        method: "POST",
        body: JSON.stringify({ id }),
      });

      // Check response status - treat 200-299 as success
      if (res.status >= 200 && res.status < 300) {
        // Success - use safe parser to avoid JSON errors
        const { data } = await safeParseJsonResponse(res);
        if (data && data.error) {
          throw new Error(data.error);
        }
        // If parsing failed or no error field, assume success (status code is what matters)
        await fetchStudents();
        alert("Student deleted successfully.");
        return;
      }

      // Handle error responses - use safe parser
      let errorMessage = `Failed to delete student (${res.status})`;
      try {
        const { data: errData, text } = await safeParseJsonResponse(res);
        if (errData && errData.error) {
          errorMessage = errData.error;
        } else if (text && text.trim()) {
          // Use raw text if JSON parsing failed
          errorMessage = text.substring(0, 200);
        }
      } catch (readErr) {
        console.warn("Failed to read error response:", readErr);
        errorMessage = res.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    } catch (e) {
      console.error("Delete student failed:", e);
      const message = String(e?.message || "");
      const isDecoderError = /DECODER|OpenSSL|1E08010C/i.test(message);
      const isNetworkOrFirestoreError =
        /socket hang up|ECONNRESET|ETIMEDOUT|firestore\.googleapis\.com/i.test(message);

      if (isDecoderError || isNetworkOrFirestoreError) {
        const reason = isDecoderError
          ? "Windows OpenSSL compatibility issue"
          : "a temporary connection issue to the server (e.g. socket hang up)";
        const proceedFallback = confirm(
          `Server-side deletion failed due to ${reason}.\n\nDo you want to delete the student record directly from Firestore? (Their login account may still exist in Firebase Auth.)`
        );
        if (proceedFallback) {
          const removed = await deleteStudentFirestoreOnly(id);
          if (removed) {
            await fetchStudents();
            alert("Student record deleted via fallback. Their login access may still exist and might need manual removal later.");
          }
        } else {
          alert("Deletion cancelled. Please try again later.");
        }
        return;
      }

      handleAuthError(e, handleAuthExpired);
      alert(e.message || "Failed to delete student");
    }
  }

  function openEditFeeModal(student) {
    setEditFeeStudent(student);
    setNewTotalFee(student.totalFee || "");
    setShowEditFeeModal(true);
  }

  function closeEditFeeModal() {
    setShowEditFeeModal(false);
    setEditFeeStudent(null);
    setNewTotalFee("");
  }

  async function handleUpdateTotalFee() {
    if (!editFeeStudent) return;

    const amount = Number(newTotalFee);
    if (isNaN(amount) || amount < 0) {
      alert("Please enter a valid total fee amount.");
      return;
    }

    try {
      await updateDoc(doc(db, "students", editFeeStudent.id), { totalFee: amount });
      await fetchStudents();
      closeEditFeeModal();
      alert("Total fee updated successfully!");
    } catch (e) {
      console.error("Failed to update total fee:", e);
      alert(e?.message || "Failed to update total fee");
    }
  }

  // Open attendance view modal for a student
  function openAttendanceView(student) {
    setAttendanceStudent(student);
    // Preselect the first matched course (by title) if available
    const titles = Array.isArray(student.coursesTitle) ? student.coursesTitle : (student.coursesTitle ? [student.coursesTitle] : []);
    const matched = allCourses.find((c) => titles.includes(c.title));
    const courseId = matched?.id || "";
    setAttendanceCourseId(courseId);
    setShowAttendanceView(true);
    if (courseId) {
      // Compute immediately
      void computeAttendancePercentage(student, courseId);
    } else {
      setAttendanceStats({ total: 0, present: 0, percent: 0 });
    }
  }

  function closeAttendanceView() {
    setShowAttendanceView(false);
    setAttendanceStudent(null);
    setAttendanceCourseId("");
    setAttendanceStats({ total: 0, present: 0, percent: 0, trainerPresent: 0, selfPresent: 0, unlocked: 0, attendedOfUnlocked: 0, percentOfUnlocked: 0 });
    setAttendanceStats({ total: 0, present: 0, percent: 0, trainerPresent: 0, selfPresent: 0, unlocked: 0, attendedOfUnlocked: 0, percentOfUnlocked: 0 });
    setAttendanceCalcLoading(false);
  }

  async function computeAttendancePercentage(student, courseId) {
    if (!student || !courseId) return;
    setAttendanceCalcLoading(true);
    try {
      // Sets to accumulate sessions by chapterId
      const trainerChapters = new Set();
      const trainerPresentChapters = new Set();
      const selfChapters = new Set();

      const studentDocId = student.id;
      const studentUid = student.uid || student.userId || null;
      const classIds = Array.isArray(student.classIds)
        ? student.classIds
        : (student.classId ? [student.classId] : []);

      // 1) Trainer attendance for this course (no date limit)
      const attCol = collection(db, "attendance");
      let trainerSnap;
      try {
        trainerSnap = await getDocs(query(attCol, where("type", "==", "trainer"), where("courseId", "==", courseId)));
      } catch (_) {
        const typeOnly = await getDocs(query(attCol, where("type", "==", "trainer")));
        const docs = typeOnly.docs.filter((d) => (d.data()?.courseId || "") === courseId);
        trainerSnap = { docs };
      }
      trainerSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const chId = data.chapterId;
        if (!chId) return;
        if (classIds.length && data.classId && !classIds.includes(data.classId)) return;
        trainerChapters.add(chId);
        const arr = Array.isArray(data.present) ? data.present : [];
        if (arr.includes(studentDocId)) trainerPresentChapters.add(chId);
      });

      // 2) Self attendance for this course by this student (if uid known)
      if (studentUid) {
        let selfSnap;
        try {
          selfSnap = await getDocs(query(attCol, where("type", "==", "self"), where("courseId", "==", courseId), where("userId", "==", studentUid)));
        } catch (_) {
          // Fallbacks
          try {
            const q1 = await getDocs(query(attCol, where("type", "==", "self"), where("userId", "==", studentUid)));
            const docs = q1.docs.filter((d) => (d.data()?.courseId || "") === courseId);
            selfSnap = { docs };
          } catch {
            const q2 = await getDocs(query(attCol, where("type", "==", "self")));
            const docs = q2.docs.filter((d) => (d.data()?.courseId || "") === courseId && (d.data()?.userId || "") === studentUid);
            selfSnap = { docs };
          }
        }
        selfSnap.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const chId = data.chapterId;
          if (!chId) return;
          selfChapters.add(chId);
        });
      }

      // Total sessions = unique chapters seen in trainer attendance or self (if no trainer record exists for that chapter)
      const totalChapters = new Set([...trainerChapters, ...selfChapters]);
      // Present = trainer-present chapters + self chapters where trainer didn't take attendance for that chapter
      const selfOnlyPresent = new Set([...selfChapters].filter((ch) => !trainerChapters.has(ch)));
      const presentChapters = new Set([...trainerPresentChapters, ...selfOnlyPresent]);

      const total = totalChapters.size;
      const present = presentChapters.size;
      const percent = total > 0 ? Math.round((present / total) * 100) : 0;

      // Unlocked chapters for this student for this course from student doc
      const unlockedArr = (student.chapterAccess && student.chapterAccess[courseId]) || [];
      const unlockedSet = new Set(Array.isArray(unlockedArr) ? unlockedArr : []);
      const unlocked = unlockedSet.size;
      // Attended among unlocked
      const attendedOfUnlocked = unlocked > 0 ? [...presentChapters].filter((ch) => unlockedSet.has(ch)).length : present;
      const percentOfUnlocked = unlocked > 0 ? Math.round((attendedOfUnlocked / unlocked) * 100) : percent;

      setAttendanceStats({
        total,
        present,
        percent,
        trainerPresent: trainerPresentChapters.size,
        selfPresent: selfOnlyPresent.size,
        unlocked,
        attendedOfUnlocked,
        percentOfUnlocked,
      });
    } catch (e) {
      console.warn("Failed to compute attendance %:", e);
      setAttendanceStats({ total: 0, present: 0, percent: 0, trainerPresent: 0, selfPresent: 0, unlocked: 0, attendedOfUnlocked: 0, percentOfUnlocked: 0 });
    } finally {
      setAttendanceCalcLoading(false);
    }
  }

  async function handleSendWhatsappTemplate(student) {
    try {
      const phone = student.phone1 || student.phone;
      if (!phone) {
        alert("Student does not have a phone number");
        return;
      }

      setWaSendingId(student.id);

      const totalFee = Number(student.totalFee ?? 0);
      const paidFee = Number(student.PayedFee ?? student.payedFee ?? 0);
      const due = Math.max(totalFee - paidFee, 0);

      const res = await makeAuthenticatedRequest("/api/send-whatsapp-template", {
        method: "POST",
          body: JSON.stringify({
          phone,
          template: "fee_update_notification",
          language: "en",
          // Template: "Hello {{1}}, This is a reminder that your fee payment of {{2}} is due. ..."
          bodyParams: [
            student.name || "Student",
            `₹${String(due)}`,
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send WhatsApp message");

      alert("WhatsApp message sent successfully.");
    } catch (e) {
      console.error("Send WhatsApp template failed:", e);
      handleAuthError(e, handleAuthExpired);
      alert(e.message || "Failed to send WhatsApp message");
    } finally {
      setWaSendingId(null);
    }
  }

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  function openPaymentModal(student) {
    const totalFee = Number(student.totalFee ?? 0);
    const paidFee = Number(student.PayedFee ?? student.payedFee ?? 0);
    const due = Math.max(totalFee - paidFee, 0);
    
    if (due <= 0) {
      alert("No due amount remaining.");
      return;
    }
    
    setSelectedStudent(student);
    setPaymentAmount(due.toString());
    setPaymentMethod("online"); // Reset to default
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setSelectedStudent(null);
    setPaymentAmount("");
    setPaymentMethod("online");
    setShowCashSuccess(false);
  }

  async function handleCashPayment() {
    if (!selectedStudent) return;

    const amount = Number(paymentAmount);
    if (amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const totalFee = Number(selectedStudent.totalFee ?? 0);
    const paidFee = Number(selectedStudent.PayedFee ?? selectedStudent.payedFee ?? 0);
    const due = Math.max(totalFee - paidFee, 0);

    if (amount > due) {
      alert(`Payment amount cannot exceed the due amount of ₹${due}`);
      return;
    }

    // Confirm cash payment
    const confirmMessage = `Confirm cash payment of ₹${amount} received from ${selectedStudent.name}?\n\nThis will update the student's fee record immediately.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Update student fee directly for cash payment
      const updateResponse = await makeAuthenticatedRequest("/api/update-student-fee", {
        method: "POST",
        body: JSON.stringify({ 
          id: selectedStudent.id, 
          addAmount: amount,
          paymentMethod: "cash"
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Failed to update student fee: ${errorData.error || 'Unknown error'}`);
      }

      const updateData = await updateResponse.json();
      console.log("Cash payment successful:", updateData);

      await fetchStudents();
      setShowCashSuccess(true);

      // Open printable receipt for cash payment
      const params = new URLSearchParams({
        payment_id: '',
        order_id: '',
        amount: String(Math.round(amount * 100)),
        studentId: selectedStudent.id,
        name: selectedStudent.name || '',
        email: selectedStudent.email || '',
        phone: selectedStudent.phone || selectedStudent.phone1 || '',
        course: Array.isArray(selectedStudent.coursesTitle) 
          ? selectedStudent.coursesTitle.join(', ') 
          : selectedStudent.coursesTitle || '',
        totalFee: String(Math.round(totalFee * 100)),
        paidFee: String(Math.round(paidFee * 100)),
        dueAmount: String(Math.round(due * 100)),
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        type: 'fee_payment',
      });
      window.open(`/receipt?${params.toString()}`, '_blank');
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        closePaymentModal();
      }, 3000);

    } catch (error) {
      console.error("Cash payment error:", error);
      handleAuthError(error, handleAuthExpired);
      alert(`Cash Payment Error: ${error.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  }

  async function handlePayFee() {
    if (!selectedStudent) return;

    if (paymentMethod === "cash") {
      await handleCashPayment();
      return;
    }

    // Online payment logic (existing code)
    const totalFee = Number(selectedStudent.totalFee ?? 0);
    const paidFee = Number(selectedStudent.PayedFee ?? selectedStudent.payedFee ?? 0);
    const due = Math.max(totalFee - paidFee, 0);
    const amount = Number(paymentAmount);

    if (amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (amount > due) {
      alert(`Payment amount cannot exceed the due amount of ₹${due}`);
      return;
    }

    setIsProcessingPayment(true);

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      alert("Failed to load payment SDK. Please retry.");
      setIsProcessingPayment(false);
      return;
    }

    try {
      const orderRes = await makeAuthenticatedRequest("/api/payments/razorpay/order", {
        method: "POST",
        body: JSON.stringify({ amount: Math.round(amount * 100), receipt: selectedStudent.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Course Fee Payment",
        description: selectedStudent.coursesTitle || "Payment",
        order_id: orderData.id,
        prefill: {
          name: selectedStudent.name,
          email: selectedStudent.email,
          contact: selectedStudent.phone1 || selectedStudent.phone,
        },
        handler: async function (response) {
          try {
            console.log("Payment response received:", response);
            
            // For now, let's skip verification and directly update the fee
            // This will help us identify if the issue is with verification or fee update
            console.log("Updating student fee directly...");
            
            const updateResponse = await makeAuthenticatedRequest("/api/update-student-fee", {
              method: "POST",
              body: JSON.stringify({ 
                id: selectedStudent.id, 
                addAmount: amount,
                paymentMethod: "online"
              }),
            });

            console.log("Update response status:", updateResponse.status);

            if (!updateResponse.ok) {
              const errorData = await updateResponse.json();
              console.error("Update error data:", errorData);
              throw new Error(`Failed to update student fee: ${errorData.error || 'Unknown error'}`);
            }

            const updateData = await updateResponse.json();
            console.log("Fee update successful:", updateData);

            await fetchStudents();
            closePaymentModal();

            // Open printable receipt for online payment by admin
            const params = new URLSearchParams({
              payment_id: response.razorpay_payment_id || '',
              order_id: response.razorpay_order_id || '',
              amount: String(Math.round(amount * 100)),
              studentId: selectedStudent.id,
              name: selectedStudent.name || '',
              email: selectedStudent.email || '',
              phone: selectedStudent.phone || selectedStudent.phone1 || '',
              course: Array.isArray(selectedStudent.coursesTitle) 
                ? selectedStudent.coursesTitle.join(', ') 
                : selectedStudent.coursesTitle || '',
              totalFee: String(Math.round(totalFee * 100)),
              paidFee: String(Math.round(paidFee * 100)),
              dueAmount: String(Math.round(due * 100)),
              date: new Date().toISOString(),
              paymentMethod: 'online',
              type: 'fee_payment',
            });
            window.open(`/receipt?${params.toString()}`, '_blank');
            
          } catch (e) {
            console.error("Payment processing error:", e);
            alert(`Payment Error: ${e.message}`);
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: function() {
            setIsProcessingPayment(false);
          }
        },
        theme: { color: "#10B981" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert(err.message || "Payment failed to start.");
      setIsProcessingPayment(false);
    }
  }

  if (loading) {
    return (
      <CheckAdminAuth>
        <p className="text-center text-gray-600 mt-10">Loading students...</p>
      </CheckAdminAuth>
    );
  }

  return (
    <CheckAdminAuth>
      <div className="mx-auto p-6 bg-white shadow-md rounded-md">
        <button
          onClick={() => router.back()}
          disabled={isProcessingPayment}
          className={`mb-4 px-4 py-2 rounded ${
            isProcessingPayment 
              ? "bg-gray-300 cursor-not-allowed" 
              : "bg-gray-400 hover:bg-gray-500"
          } text-white`}
        >
          ⬅ Back
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center text-green-700">
          👨‍🎓 Students List
        </h2>

        {/* Search and filters */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Search by mobile number"
            value={phoneQuery}
            onChange={(e) => setPhoneQuery(e.target.value)}
            disabled={isProcessingPayment}
            className={`flex-1 md:w-80 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          />
          <select
            value={lockFilter}
            onChange={(e) => setLockFilter(e.target.value)}
            disabled={isProcessingPayment}
            className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="all">All Students</option>
            <option value="locked">🔒 Locked Only</option>
            <option value="unlocked">🔓 Unlocked Only</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            disabled={isProcessingPayment}
            className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="">All roles</option>
            <option value="student">Student</option>
            <option value="internship">Internship</option>
            <option value="crtStudent">CRT Student</option>
            <option value="skillwins">vawe.skillwins</option>
          </select>
        </div>

        {/* Department / Course / Batch filters */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            disabled={isProcessingPayment}
            className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            disabled={isProcessingPayment}
            className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            disabled={isProcessingPayment}
            className={`border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {(roleFilter || phoneQuery || lockFilter !== "all" || deptFilter || courseFilter || batchFilter) && (
            <span className="text-sm text-gray-500">
              {filteredStudents.length} / {students.length}
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <p className="text-gray-500 text-center">No students found.</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-gray-500 text-center">No students match the current filters (phone / lock / role).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">S.No</th>
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Email</th>
                  <th className="border p-2">Role</th>
                  <th className="border p-2">Password</th>
                  <th className="border p-2">Phone</th>
                  <th className="border p-2">Course</th>
                  <th className="border p-2">Total Fee</th>
                  <th className="border p-2">Due</th>
                  <th className="border p-2">Attendance %</th>
                  <th className="border p-2">Lock</th>
                  <th className="border p-2 min-w-[320px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, index) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="border p-2 text-center">{index + 1}</td>
                    <td className="border p-2">{s.name}</td>
                    <td className="border p-2">{s.email}</td>
                    <td className="border p-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isCrtStudentRole(getStudentRole(s)) ? "bg-blue-100 text-blue-700" :
                        isSkillwinsStudentRole(getStudentRole(s)) ? "bg-violet-100 text-violet-800" :
                        isScopedInternshipRole(getStudentRole(s)) ? "bg-emerald-100 text-emerald-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {isCrtStudentRole(getStudentRole(s)) ? getStudentRole(s) :
                         isSkillwinsStudentRole(getStudentRole(s)) ? getStudentRole(s) :
                         formatStudentRoleLabel(getStudentRole(s))}
                      </span>
                    </td>
                    <td className="border p-2">{s.password || "-"}</td>
                    <td className="border p-2">
                      {s.phone1 || s.phone || "-"}
                    </td>
                    <td className="border p-2">
                      {Array.isArray(s.coursesTitle) 
                        ? s.coursesTitle.join(', ') 
                        : s.coursesTitle || "-"}
                    </td>
                    <td className="border p-2">{s.totalFee || "-"}</td>
                    <td className="border p-2">{Number(s.totalFee ?? 0) - Number(s.PayedFee ?? s.payedFee ?? 0)}</td>
                  <td className="border p-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span>{attendancePercentByStudent[s.id] ?? "-"}</span>
                      <button
                        onClick={() => openAttendanceView(s)}
                        disabled={isProcessingPayment}
                        className={`px-2 py-0.5 rounded text-xs ${
                          isProcessingPayment
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-blue-500 hover:bg-blue-600"
                        } text-white`}
                      >
                        View
                      </button>
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    <label className="inline-flex items-center cursor-pointer select-none">
                      <span className="mr-2 text-xs font-medium text-gray-700">
                        {Boolean(s.locked) ? "Locked" : "Unlocked"}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={Boolean(s.locked)}
                        disabled={isProcessingPayment}
                        onChange={async () => {
                          try {
                            await updateDoc(doc(db, "students", s.id), { locked: !Boolean(s.locked) });
                            await fetchStudents();
                          } catch (e) {
                            alert(e?.message || "Failed to update lock status");
                          }
                        }}
                      />
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${Boolean(s.locked) ? "bg-yellow-400" : "bg-gray-300"} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-400`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${Boolean(s.locked) ? "translate-x-5" : "translate-x-0"}`}></div>
                      </div>
                    </label>
                  </td>
                  <td className="border p-2 text-center">
                    <div className="flex flex-wrap justify-center gap-2 min-w-[320px]">
                    <button
                      onClick={() => openPaymentModal(s)}
                      disabled={isProcessingPayment}
                      className={`px-3 py-1 rounded ${
                        isProcessingPayment 
                          ? "bg-gray-300 cursor-not-allowed" 
                          : "bg-green-500 hover:bg-green-600"
                      } text-white`}
                    >
                      Pay Fee
                    </button>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          name: s.name || '',
                          course: s.coursesTitle || 'Course',
                          certNo: `${new Date().getFullYear()}-${s.id.substring(0,6)}`,
                          issued: new Date().toLocaleDateString(),
                        });
                        window.open(`/certificate?${params.toString()}`, '_blank');
                      }}
                      disabled={isProcessingPayment}
                      className={`px-3 py-1 rounded ${
                        isProcessingPayment 
                          ? "bg-gray-300 cursor-not-allowed" 
                          : "bg-indigo-500 hover:bg-indigo-600"
                      } text-white`}
                    >
                      Generate Certificate
                    </button>
                    <button
                      onClick={() => handleSendWhatsappTemplate(s)}
                      disabled={isProcessingPayment || waSendingId === s.id}
                      className={`px-3 py-1 rounded ${
                        isProcessingPayment || waSendingId === s.id
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      } text-white`}
                    >
                      {waSendingId === s.id ? "Sending..." : "WhatsApp"}
                    </button>
                    {(currentUserRole === "superadmin" ||
                      currentUserRole === "admin" ||
                      currentUserRole === "collegeAdmin") && (
                      <button
                        onClick={() => openEditFeeModal(s)}
                        disabled={isProcessingPayment}
                        className={`px-3 py-1 rounded ${
                          isProcessingPayment 
                            ? "bg-gray-300 cursor-not-allowed" 
                            : "bg-purple-500 hover:bg-purple-600"
                        } text-white`}
                      >
                        Edit Fee
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteStudent(s.id)}
                      disabled={isProcessingPayment}
                      className={`px-3 py-1 rounded ${
                        isProcessingPayment 
                          ? "bg-gray-300 cursor-not-allowed" 
                          : "bg-red-400 hover:bg-red-500"
                      } text-white`}
                    >
                      Delete
                    </button>
                    </div>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grand Total Summary (based on filtered students) */}
        {students.length > 0 && (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">
              📊 Fee Summary {roleFilter || phoneQuery || lockFilter !== "all" ? `(filtered: ${filteredStudents.length})` : ""}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {filteredStudents.length}
                </div>
                <div className="text-sm text-gray-600">Total Students</div>
              </div>
              <div className="bg-white p-4 rounded-lg border text-center">
                <div className="text-2xl font-bold text-green-500">
                  ₹{filteredStudents.reduce((sum, s) => sum + Number(s.totalFee ?? 0), 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Fee</div>
              </div>
              <div className="bg-white p-4 rounded-lg border text-center">
                <div className="text-2xl font-bold text-blue-500">
                  ₹{filteredStudents.reduce((sum, s) => sum + Number(s.PayedFee ?? s.payedFee ?? 0), 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Paid</div>
              </div>
              <div className="bg-white p-4 rounded-lg border text-center">
                <div className="text-2xl font-bold text-red-500">
                  ₹{filteredStudents.reduce((sum, s) => {
                    const totalFee = Number(s.totalFee ?? 0);
                    const paidFee = Number(s.PayedFee ?? s.payedFee ?? 0);
                    return sum + Math.max(totalFee - paidFee, 0);
                  }, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Pending Amount</div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance View Modal (Course-wise percentage, not time-limited) */}
        {showAttendanceView && attendanceStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Attendance — {attendanceStudent.name || '-'}</h3>
                <button onClick={closeAttendanceView} className="text-gray-600 hover:text-gray-800">✕</button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                <select
                  value={attendanceCourseId}
                  onChange={async (e) => {
                    const id = e.target.value;
                    setAttendanceCourseId(id);
                    await computeAttendancePercentage(attendanceStudent, id);
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Choose...</option>
                  {(() => {
                    const titles = Array.isArray(attendanceStudent.coursesTitle)
                      ? attendanceStudent.coursesTitle
                      : (attendanceStudent.coursesTitle ? [attendanceStudent.coursesTitle] : []);
                    // Map student course titles to existing course documents
                    const options = allCourses.filter((c) => titles.includes(c.title));
                    return options.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ));
                  })()}
                </select>
                {attendanceCourseId === "" && (
                  <p className="text-xs text-gray-500 mt-1">
                    Select a course to calculate attendance percentage.
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg border p-4">
                {attendanceCalcLoading ? (
                  <div className="text-center text-sm text-gray-600">Calculating…</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-center mb-3">
                      <div>
                        <div className="text-xl font-bold text-green-500">{attendanceStats.present}</div>
                        <div className="text-xs text-gray-600">Present</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-indigo-500">{attendanceStats.percentOfUnlocked}%</div>
                        <div className="text-xs text-gray-600">Attendance (of unlocked)</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-semibold text-sky-500">{attendanceStats.trainerPresent}</div>
                        <div className="text-xs text-gray-600">Trainer Presents</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-emerald-500">{attendanceStats.selfPresent}</div>
                        <div className="text-xs text-gray-600">Self Presents</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-purple-500">{attendanceStats.unlocked}</div>
                        <div className="text-xs text-gray-600">Total Unlocked Classes</div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={closeAttendanceView} className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-center">
                Payment for {selectedStudent.name}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Total Fee:</strong> ₹{selectedStudent.totalFee || 0}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Paid Amount:</strong> ₹{selectedStudent.PayedFee || selectedStudent.payedFee || 0}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Due Amount:</strong> ₹{Number(selectedStudent.totalFee ?? 0) - Number(selectedStudent.PayedFee ?? selectedStudent.payedFee ?? 0)}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="0"
                  max={Number(selectedStudent.totalFee ?? 0) - Number(selectedStudent.PayedFee ?? selectedStudent.payedFee ?? 0)}
                  step="0.01"
                  disabled={isProcessingPayment}
                  className={`w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    isProcessingPayment ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                  placeholder="Enter payment amount"
                />
              </div>

              {/* Payment Method Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="online"
                      checked={paymentMethod === "online"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={isProcessingPayment}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-blue-600" />
                      <span className="text-sm">Online Payment Gateway</span>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === "cash"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={isProcessingPayment}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <div className="flex items-center gap-2">
                      ₹
                      <span className="text-sm"> Cash Payment</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Payment Method Description */}
              {paymentMethod === "online" && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Online Payment:</strong> You will be redirected to a secure payment gateway to complete the transaction.
                  </p>
                </div>
              )}

              {paymentMethod === "cash" && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-700">
                    <strong>Cash Payment:</strong> Record the cash payment received. The student&apos;s fee will be updated immediately.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handlePayFee}
                  disabled={isProcessingPayment}
                  className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 ${
                    isProcessingPayment 
                      ? "bg-gray-300 cursor-not-allowed" 
                      : paymentMethod === "online"
                      ? "bg-blue-500 hover:bg-blue-600"
                      : "bg-green-500 hover:bg-green-600"
                  } text-white`}
                >
                  {isProcessingPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : paymentMethod === "online" ? (
                    <>
                      <CreditCard size={16} />
                      Proceed to Payment
                    </>
                  ) : (
                    <>
                      <DollarSign size={16} />
                      Record Cash Payment
                    </>
                  )}
                </button>
                <button
                  onClick={closePaymentModal}
                  disabled={isProcessingPayment}
                  className={`flex-1 px-4 py-2 rounded ${
                    isProcessingPayment 
                      ? "bg-gray-300 cursor-not-allowed" 
                      : "bg-gray-400 hover:bg-gray-500"
                  } text-white`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cash Payment Success Modal */}
        {showCashSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 text-center">
              <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-green-800">
                Cash Payment Successful!
              </h3>
              <p className="text-gray-600 mb-4">
                Payment of ₹{paymentAmount} has been recorded for {selectedStudent?.name}
              </p>
              <p className="text-sm text-gray-500">
                The student&apos;s fee has been updated in the system.
              </p>
            </div>
          </div>
        )}

        {/* Payment Processing Overlay */}
        {isProcessingPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">
                {paymentMethod === "online" ? "Processing Online Payment..." : "Recording Cash Payment..."}
              </h3>
              <p className="text-gray-600 text-sm">
                Please do not refresh the page or navigate away.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                This may take a few moments.
              </p>
            </div>
          </div>
        )}

        {/* Edit Total Fee Modal - Only for Admin */}
        {showEditFeeModal && editFeeStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-center">
                Edit Total Fee for {editFeeStudent.name}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Current Total Fee:</strong> ₹{editFeeStudent.totalFee || 0}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Paid Amount:</strong> ₹{editFeeStudent.PayedFee || editFeeStudent.payedFee || 0}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Total Fee (₹) <span className="text-purple-600 text-xs">Admin Only</span>
                </label>
                <input
                  type="number"
                  value={newTotalFee}
                  onChange={(e) => setNewTotalFee(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 border-purple-300 bg-purple-50"
                  placeholder="Enter new total fee amount"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>Warning:</strong> Changing the total fee will affect the due amount calculation. This action should only be done for corrections or special cases.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpdateTotalFee}
                  className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Update Total Fee
                </button>
                <button
                  onClick={closeEditFeeModal}
                  className="flex-1 px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CheckAdminAuth>
  );
}



