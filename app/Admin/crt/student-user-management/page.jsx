"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { db, firestoreHelpers, isFirebaseConfigured } from "../../../../lib/firebase";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "../../AdminAccessContext";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Search, RefreshCw, UserPlus, X, Phone, CheckCircle2 } from "lucide-react";
import { makeAuthenticatedRequest, handleAuthError } from "@/lib/authUtils";
import { requestWhatsAppOtp, verifyWhatsAppOtp } from "@/lib/whatsappOtpClient";
import { crtStudentRosterCollectionSegments, crtStudentRosterDocSegments } from "@/lib/collegeTenantFirestore";
import {
  getScopedCrtStudentRole,
  getScopedStudentRole,
  getScopedInternshipRole,
  resolveCollegeSubdomain,
  coerceStudentRoleForSave,
  isScopedInternshipRole,
} from "@/lib/studentRole";

/** HTML date inputs require YYYY-MM-DD. Accepts Firestore Timestamp, ISO, or dd-mm-yyyy / dd/mm/yyyy. */
function toDateInputString(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      const d = value.toDate();
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

/** Normalize role for display/edit — subcollection is CRT-only, but legacy docs may omit or vary role. */
function getCrtStudentRole(s, defaultRole) {
  const r = (s?.role || "").trim();
  if (!r) return defaultRole;
  const lower = r.toLowerCase();
  if (lower === "crtstudent" || lower === "crt student" || lower === "crt-student") {
    return defaultRole;
  }
  return r;
}

const INITIAL_ADMISSION_FORM = {
  regNo: "",
  studentName: "",
  fatherName: "",
  gender: "",
  dateOfBirth: "",
  aadharNo: "",
  email: "",
  phone1: "",
  phone2: "",
  qualification: "",
  collegeUniversity: "",
  degree: "",
  branch: "",
  yearOfPassing: "",
  workExperienceYears: "",
  company: "",
  skillSet: "",
  courseProjectTitle: "",
  dateOfJoining: "",
  timings: "",
  totalFee: "",
  paidFee: "",
  remarks: "",
};

export default function CRTStudentUserManagementPage() {
  const router = useRouter();
  const { user, loading, hasCrtManagerAccess: isAdmin, collegeSubdomain } = useAdminAccess();
  const tenantSubdomain = useMemo(
    () => resolveCollegeSubdomain(collegeSubdomain),
    [collegeSubdomain]
  );
  const scopedStudentRole = useMemo(
    () => getScopedStudentRole(tenantSubdomain),
    [tenantSubdomain]
  );
  const scopedInternshipRole = useMemo(
    () => getScopedInternshipRole(tenantSubdomain),
    [tenantSubdomain]
  );
  const scopedCrtStudentRole = useMemo(
    () => getScopedCrtStudentRole(collegeSubdomain),
    [collegeSubdomain]
  );
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [admissionForm, setAdmissionForm] = useState(INITIAL_ADMISSION_FORM);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpValue, setPhoneOtpValue] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSendError, setOtpSendError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null); // { email, defaultPassword }
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
    phone: "",
  });
  const [deleteBusyId, setDeleteBusyId] = useState(null);

  const updateForm = (key, value) => {
    setAdmissionForm((f) => ({ ...f, [key]: value }));
  };

  const handleSendOtp = async () => {
    const digits = String(admissionForm.phone1 || "").replace(/\D/g, "");
    if (digits.length < 10) {
      alert("Enter a valid 10-digit mobile number.");
      return;
    }
    setOtpSending(true);
    setOtpSendError(null);
    setPhoneVerified(false);
    setPhoneOtpValue("");
    try {
      const res = await requestWhatsAppOtp(admissionForm.phone1);
      if (!res.ok) {
        const msg =
          res.error ||
          (typeof res.details === "string" ? res.details : null) ||
          "Failed to send OTP. Try again.";
        setOtpSendError(msg);
        alert(msg);
        return;
      }
      setPhoneOtpSent(true);
      if (process.env.NODE_ENV !== "production" && res.debugOtp) {
        console.info("[dev] WhatsApp OTP (also sent via template):", res.debugOtp);
      }
    } catch (e) {
      console.error(e);
      const msg = e?.message || "Failed to send OTP.";
      setOtpSendError(msg);
      alert(msg);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = String(phoneOtpValue || "").trim().replace(/\D/g, "");
    if (code.length < 4) {
      alert("Enter the OTP you received on WhatsApp.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await verifyWhatsAppOtp(admissionForm.phone1, code);
      if (res.ok) {
        setPhoneVerified(true);
        setOtpSendError(null);
        return;
      }
      const reason = res.reason;
      let msg = "Invalid OTP.";
      if (reason === "expired") msg = "OTP expired. Request a new code.";
      else if (reason === "locked_out" || reason === "too_many_attempts") {
        msg =
          res.remainingMinutes != null
            ? `Too many attempts. Try again in about ${res.remainingMinutes} minute(s).`
            : "Too many attempts. Try again later.";
      } else if (res.error) msg = res.error;
      alert(msg);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const fetchStudents = useCallback(async () => {
    if (!db) return;
    setLoadingStudents(true);
    try {
      // Central CRT students path:
      // users (collection) -> crtStudent (document) -> students (subcollection)
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, ...crtStudentRosterCollectionSegments(collegeSubdomain))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(list);
    } catch (err) {
      console.error(err);
      alert("Failed to load students.");
    } finally {
      setLoadingStudents(false);
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    if (user && isAdmin && isFirebaseConfigured) {
      fetchStudents();
    }
  }, [user, isAdmin, fetchStudents]);

  const filteredStudents = useMemo(() => {
    let list = [...students];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.email || "").toLowerCase().includes(q) ||
          (s.name || "").toLowerCase().includes(q) ||
          (s.regNo || "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [students, search]);

  const openAdmissionModal = () => {
    setAdmissionForm({ ...INITIAL_ADMISSION_FORM });
    setPhoneOtpSent(false);
    setPhoneOtpValue("");
    setPhoneVerified(false);
    setOtpSendError(null);
    setSubmitSuccess(null);
    setShowAdmissionModal(true);
  };

  const closeAdmissionModal = () => {
    setShowAdmissionModal(false);
  };

  const handleAdmissionSubmit = async (e) => {
    e.preventDefault();
    if (!scopedCrtStudentRole) {
      alert("College subdomain is required to create CRT students.");
      return;
    }
    if (!phoneVerified) {
      alert("Please verify your mobile number with OTP first.");
      return;
    }
    const { regNo, studentName, fatherName, email, phone1, phone2, gender, dateOfBirth, aadharNo, qualification, collegeUniversity, degree, branch, yearOfPassing, workExperienceYears, company, skillSet, courseProjectTitle, dateOfJoining, timings, totalFee, paidFee, remarks } = admissionForm;
    if (!regNo?.trim() || !studentName?.trim() || !email?.trim()) {
      alert("Please fill Regd. No., Student Name, and Email (required).");
      return;
    }
    if (!toDateInputString(dateOfBirth)) {
      alert("Please select Date of Birth using the date picker.");
      return;
    }
    setSubmitting(true);
    setSubmitSuccess(null);
    try {
      const payload = {
        classId: "crt",
        regdNo: regNo.trim(),
        name: studentName.trim(),
        email: email.trim().toLowerCase(),
        fatherName: fatherName?.trim() || undefined,
        phone1: phone1?.trim() || undefined,
        phone2: phone2?.trim() || undefined,
        phone: phone1?.trim() || undefined,
        gender: gender || undefined,
        dob: toDateInputString(dateOfBirth) || undefined,
        aadharNo: aadharNo?.trim() || undefined,
        qualification: qualification?.trim() || undefined,
        college: collegeUniversity?.trim() || undefined,
        degree: degree?.trim() || undefined,
        branch: branch?.trim() || undefined,
        yearOfPassing: yearOfPassing?.trim() || undefined,
        workExperienceYears: workExperienceYears?.trim() || undefined,
        company: company?.trim() || undefined,
        skillSet: skillSet?.trim() || undefined,
        courseTitle: courseProjectTitle?.trim() || undefined,
        dateOfJoining: dateOfJoining?.trim() || undefined,
        timings: timings?.trim() || undefined,
        totalFee: totalFee ? Number(totalFee) : undefined,
        PayedFee: paidFee ? Number(paidFee) : undefined,
        remarks: remarks?.trim() || undefined,
        isCrt: true,
        role: scopedCrtStudentRole,
      };
      const res = await makeAuthenticatedRequest("/api/create-student", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create student");
      }
      const defaultPassword = data.defaultPassword || "Vawe@2026";
      setSubmitSuccess({ email: email.trim(), defaultPassword });

      // Also store a central record under:
      // users / crtStudent / students / {uid}
      if (db && data.uid) {
        const centralRef = firestoreHelpers.doc(
          db,
          ...crtStudentRosterDocSegments(collegeSubdomain, data.uid)
        );
        await firestoreHelpers.setDoc(centralRef, {
          uid: data.uid,
          regNo: regNo.trim(),
          regdNo: regNo.trim(),
          name: studentName.trim(),
          email: email.trim().toLowerCase(),
          role: scopedCrtStudentRole,
          isCrt: true,
          password: defaultPassword,
          phone1: phone1?.trim() || "",
          phone: phone1?.trim() || "",
          createdAt: new Date().toISOString(),
        });
      }

      await fetchStudents();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to create CRT student. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeAdmissionModalAfterSuccess = () => {
    setShowAdmissionModal(false);
    setAdmissionForm({ ...INITIAL_ADMISSION_FORM });
    setPhoneVerified(false);
    setPhoneOtpSent(false);
    setOtpSendError(null);
    setSubmitSuccess(null);
  };

  const startEditRow = (student) => {
    setEditingId(student.id);
    setEditForm({
      name: student.name || "",
      email: student.email || "",
      role: getCrtStudentRole(student, scopedCrtStudentRole),
      password: student.password || "",
      phone: student.phone1 || student.phone || "",
    });
  };

  const cancelEditRow = () => {
    setEditingId(null);
  };

  const updateEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveEditRow = async (student) => {
    try {
      if (!db || !student?.id) return;
      const docRef = firestoreHelpers.doc(
        db,
        ...crtStudentRosterDocSegments(collegeSubdomain, student.id)
      );
      const savedRole =
        coerceStudentRoleForSave(
          (editForm.role || "").trim() || scopedCrtStudentRole,
          tenantSubdomain
        );
      const updatePayload = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        emailNormalized: editForm.email.trim().toLowerCase(),
        role: savedRole,
        isInternship: isScopedInternshipRole(savedRole),
        password: editForm.password,
        phone1: editForm.phone,
        phone: editForm.phone,
      };
      await firestoreHelpers.updateDoc(docRef, updatePayload);
      await fetchStudents();
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update student. " + (err.message || ""));
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!studentId) return;
    const confirmed = confirm(
      "Delete this CRT student from the system? This will also remove their login access."
    );
    if (!confirmed) return;

    setDeleteBusyId(studentId);
    try {
      // Remove central record under users/crtStudent/students/{studentId}
      if (db) {
        const centralRef = firestoreHelpers.doc(
          db,
          ...crtStudentRosterDocSegments(collegeSubdomain, studentId)
        );
        await firestoreHelpers.deleteDoc(centralRef);
      }

      const res = await makeAuthenticatedRequest("/api/delete-student", {
        method: "POST",
        body: JSON.stringify({ id: studentId }),
      });

      if (res.status >= 200 && res.status < 300) {
        await fetchStudents();
        alert("Student deleted successfully.");
        return;
      }

      let errorMessage = `Failed to delete student (${res.status})`;
      try {
        const text = await res.text();
        if (text?.trim()) {
          try {
            const data = JSON.parse(text);
            if (data?.error) {
              errorMessage = data.error;
            } else {
              errorMessage = text.substring(0, 200);
            }
          } catch {
            errorMessage = text.substring(0, 200);
          }
        }
      } catch {
        // ignore parse errors, use default message
      }
      throw new Error(errorMessage);
    } catch (e) {
      console.error("Delete student failed:", e);
      handleAuthError(e, () => {
        alert("Your session expired. Please log in again.");
      });
      alert(e.message || "Failed to delete student");
    } finally {
      setDeleteBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-8">Admin access required.</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/Admin/crt"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to CRT Admin
          </Link>
        </div>

        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              Student Management
            </h1>
            <p className="text-slate-600 mt-1">
              View and manage CRT students only.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={openAdmissionModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Create Admission
            </button>
          </div>
        </div>

        {/* Create Admission Modal – CRT Student (dummy) */}
        {showAdmissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={submitSuccess ? closeAdmissionModalAfterSuccess : closeAdmissionModal}>
            <div className="w-[540px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-[#00448a] to-[#0066b3] px-6 py-4 rounded-t-2xl">
                <h2 className="text-lg font-bold text-white">CRT Student Admission</h2>
                <button type="button" onClick={submitSuccess ? closeAdmissionModalAfterSuccess : closeAdmissionModal} className="rounded-lg p-1.5 text-white/90 hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {submitSuccess ? (
                <div className="p-6 bg-slate-50/50">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 mb-4">
                    <h3 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" /> Student created with login credentials
                    </h3>
                    <p className="text-sm text-emerald-700 mb-3">Share these credentials with the student for login:</p>
                    <div className="rounded-lg bg-white border border-emerald-200 p-4 font-mono text-sm space-y-1">
                      <p><span className="text-slate-500">Email:</span> <strong className="text-slate-900">{submitSuccess.email}</strong></p>
                      <p><span className="text-slate-500">Password:</span> <strong className="text-slate-900">{submitSuccess.defaultPassword}</strong></p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={closeAdmissionModalAfterSuccess} className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] transition-colors">
                      Done
                    </button>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleAdmissionSubmit} className="p-6 bg-slate-50/50">
                <p className="text-xs text-slate-500 mb-5">
                  We&apos;ll send a 6-digit code to this number on WhatsApp (template: verification).
                </p>
                {otpSendError && (
                  <p className="text-xs text-red-600 mb-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    {otpSendError}
                  </p>
                )}

                {/* Personal Information */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">Personal Information</h3>
                  <div className="grid gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Regd. No. (Unique) *</label>
                      <input type="text" value={admissionForm.regNo} onChange={(e) => updateForm("regNo", e.target.value)} placeholder="e.g. 1" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Student Name *</label>
                      <input type="text" value={admissionForm.studentName} onChange={(e) => updateForm("studentName", e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Father&apos;s Name *</label>
                      <input type="text" value={admissionForm.fatherName} onChange={(e) => updateForm("fatherName", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Gender *</label>
                        <select value={admissionForm.gender} onChange={(e) => updateForm("gender", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]">
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Date of Birth *</label>
                        <input
                          type="date"
                          value={toDateInputString(admissionForm.dateOfBirth)}
                          onChange={(e) => updateForm("dateOfBirth", e.target.value)}
                          min="1900-01-01"
                          max={new Date().toISOString().slice(0, 10)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                        />                    
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Aadhar No. *</label>
                      <input type="text" value={admissionForm.aadharNo} onChange={(e) => updateForm("aadharNo", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                  </div>
                </section>

                {/* Contact + Mobile verification */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Phone className="w-4 h-4 text-[#00448a]" /> Contact &amp; Mobile Verification
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Email *</label>
                      <input type="email" value={admissionForm.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="student@example.com" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile (Primary) *</label>
                      <div className="flex gap-2">
                        <input type="tel" value={admissionForm.phone1} onChange={(e) => updateForm("phone1", e.target.value)} placeholder="10-digit number" maxLength={10} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a] flex-1" />
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={phoneVerified || otpSending}
                          className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                        >
                          {otpSending ? "Sending…" : "Send OTP"}
                        </button>
                      </div>
                    </div>
                    {phoneOtpSent && !phoneVerified && (
                      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <div className="flex-1 min-w-[120px]">
                          <label className="mb-1 block text-xs font-medium text-amber-800">Enter OTP</label>
                          <input type="text" value={phoneOtpValue} onChange={(e) => setPhoneOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" maxLength={6} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a] text-center tracking-widest" />
                        </div>
                        <button type="button" onClick={handleVerifyOtp} disabled={otpVerifying} className="px-4 py-2 rounded-lg bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60">
                          {otpVerifying ? "Verifying…" : "Verify OTP"}
                        </button>
                      </div>
                    )}
                    {phoneVerified && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-800 text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0" /> Mobile number verified
                      </div>
                    )}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone 2</label>
                      <input type="tel" value={admissionForm.phone2} onChange={(e) => updateForm("phone2", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                  </div>
                </section>

                {/* Educational Details */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Educational Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Qualification *</label>
                      <input type="text" value={admissionForm.qualification} onChange={(e) => updateForm("qualification", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">College / University</label>
                      <input type="text" value={admissionForm.collegeUniversity} onChange={(e) => updateForm("collegeUniversity", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Degree *</label>
                        <input type="text" value={admissionForm.degree} onChange={(e) => updateForm("degree", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Branch *</label>
                        <input type="text" value={admissionForm.branch} onChange={(e) => updateForm("branch", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Year of Passing *</label>
                      <input type="text" value={admissionForm.yearOfPassing} onChange={(e) => updateForm("yearOfPassing", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                  </div>
                </section>

                {/* Work Experience */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Work Experience</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Experience (Years)</label>
                        <input type="text" value={admissionForm.workExperienceYears} onChange={(e) => updateForm("workExperienceYears", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Company</label>
                        <input type="text" value={admissionForm.company} onChange={(e) => updateForm("company", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Skill Set</label>
                      <input type="text" value={admissionForm.skillSet} onChange={(e) => updateForm("skillSet", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                  </div>
                </section>

                {/* Course Details */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Course Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Course / Project Title *</label>
                      <input type="text" value={admissionForm.courseProjectTitle} onChange={(e) => updateForm("courseProjectTitle", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Date of Joining *</label>
                        <input type="date" value={admissionForm.dateOfJoining} onChange={(e) => updateForm("dateOfJoining", e.target.value)} placeholder="dd-mm-yyyy" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Timings</label>
                        <input type="text" value={admissionForm.timings} onChange={(e) => updateForm("timings", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Fee Details */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Fee Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Total Fee *</label>
                      <input type="text" value={admissionForm.totalFee} onChange={(e) => updateForm("totalFee", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Paid Fee *</label>
                      <input type="text" value={admissionForm.paidFee} onChange={(e) => updateForm("paidFee", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]" />
                    </div>
                  </div>
                </section>

                {/* Remarks */}
                <section className="mb-5 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Additional Information</h3>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
                  <textarea value={admissionForm.remarks} onChange={(e) => updateForm("remarks", e.target.value)} placeholder="Any additional notes..." rows={3} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a] resize-none" />
                </section>

                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={closeAdmissionModal} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={!phoneVerified || submitting} className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {submitting ? "Creating…" : "Submit Admission"}
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        )}

        {!isFirebaseConfigured ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            <p>Firebase is not configured. Configure .env.local to load students.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 min-w-0 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search CRT students by name, email or reg no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                />
              </div>
              <button
                onClick={fetchStudents}
                disabled={loadingStudents}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${loadingStudents ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {loadingStudents && students.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin text-[#00448a]" />
                  <p>Loading students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>{search.trim() ? "No CRT students match your search." : "No CRT students found."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="p-4 font-semibold text-slate-700">S.No</th>
                        <th className="p-4 font-semibold text-slate-700">Name</th>
                        <th className="p-4 font-semibold text-slate-700">Email</th>
                        <th className="p-4 font-semibold text-slate-700">Role</th>
                        <th className="p-4 font-semibold text-slate-700">Password</th>
                        <th className="p-4 font-semibold text-slate-700">Phone</th>
                        <th className="p-4 font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, index) => {
                        const isEditing = editingId === s.id;
                        const role = isEditing
                          ? editForm.role
                          : getCrtStudentRole(s, scopedCrtStudentRole);
                        const password = isEditing ? editForm.password : s.password || "—";
                        const phone = isEditing ? editForm.phone : s.phone1 || s.phone || "—";
                        return (
                          <tr
                            key={s.id}
                            className="border-b border-slate-100 hover:bg-slate-50/50"
                          >
                            <td className="p-4 text-slate-600 whitespace-nowrap">
                              {index + 1}
                            </td>
                            <td className="p-4 text-slate-900 font-medium">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.name}
                                  onChange={(e) => updateEditField("name", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                s.name || "—"
                              )}
                            </td>
                            <td className="p-4 text-slate-600">
                              {isEditing ? (
                                <input
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) => updateEditField("email", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                s.email || "—"
                              )}
                            </td>
                            <td className="p-4 text-slate-600">
                              {isEditing ? (
                                <select
                                  value={editForm.role}
                                  onChange={(e) => updateEditField("role", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                >
                                  <option value="">Select</option>
                                  {scopedCrtStudentRole && (
                                    <option value={scopedCrtStudentRole}>{scopedCrtStudentRole}</option>
                                  )}
                                  <option value={scopedStudentRole}>{scopedStudentRole}</option>
                                  <option value={scopedInternshipRole}>{scopedInternshipRole}</option>
                                </select>
                              ) : (
                                role
                              )}
                            </td>
                            <td className="p-4 text-slate-600">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.password}
                                  onChange={(e) => updateEditField("password", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                password
                              )}
                            </td>
                            <td className="p-4 text-slate-600">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.phone}
                                  onChange={(e) => updateEditField("phone", e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                                />
                              ) : (
                                phone
                              )}
                            </td>
                            <td className="p-4">
                              {isEditing ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveEditRow(s)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-[#00448a] hover:bg-[#003a76] text-white"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditRow}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditRow(s)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deleteBusyId === s.id}
                                    onClick={() => handleDeleteStudent(s.id)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {deleteBusyId === s.id ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            <p className="mt-4 text-sm text-slate-500">
              Showing {filteredStudents.length}
              {search.trim() ? ` of ${students.length}` : ""} CRT students
            </p>
          </>
        )}
      </div>
    </div>
  );
}
