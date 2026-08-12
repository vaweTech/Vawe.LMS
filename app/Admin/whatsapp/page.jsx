"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { makeAuthenticatedRequest } from "@/lib/authUtils";
import { tenantSegments } from "@/lib/tenantPath";
import {
  isCrtStudentRole,
  isSkillwinsStudentRole,
  inferStudentRole,
  formatStudentRoleLabel,
  normalizeStudentsForAdmin,
} from "@/lib/studentRole";
import { resolveWhatsAppTemplateLanguage } from "@/lib/whatsappTemplateLanguage";

function getStudentClassId(student) {
  if (Array.isArray(student?.classIds) && student.classIds.length > 0) {
    return String(student.classIds[0]);
  }
  return student?.classId ? String(student.classId) : "";
}

function getStudentCourseTitles(student) {
  if (Array.isArray(student?.coursesTitle)) return student.coursesTitle;
  if (student?.courseTitle) return [student.courseTitle];
  return [];
}


export default function WhatsAppMessagingPage() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [crtPrograms, setCrtPrograms] = useState([]);
  const [crtBatches, setCrtBatches] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState("all");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedCourseTitle, setSelectedCourseTitle] = useState("");
  const [selectedCrtId, setSelectedCrtId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [crtBatchStudentIds, setCrtBatchStudentIds] = useState(() => new Set());
  const [crtProgramStudentIds, setCrtProgramStudentIds] = useState(() => new Set());
  const [templateName, setTemplateName] = useState("fee_update_notification");
  const [param1, setParam1] = useState("");
  const [param2, setParam2] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, phase: "idle" });
  const [senderInfo, setSenderInfo] = useState(null);
  const [senderError, setSenderError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/whatsapp-sender");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.ok) {
          setSenderInfo(data);
          setSenderError("");
        } else {
          setSenderInfo(null);
          setSenderError(data.error || "WhatsApp not configured on server");
        }
      } catch (err) {
        if (!cancelled) {
          setSenderInfo(null);
          setSenderError(err?.message || "Could not verify WhatsApp sender");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [studentsSnap, programsSnap, crtSnap, coursesSnap] = await Promise.all([
          getDocs(collection(db, ...tenantSegments(null, "students"))),
          getDocs(collection(db, ...tenantSegments(null, "programs"))),
          getDocs(collection(db, ...tenantSegments(null, "crt"))),
          getDocs(collection(db, ...tenantSegments(null, "courses"))),
        ]);
        setStudents(
          normalizeStudentsForAdmin(
            studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          )
        );
        setPrograms(
          programsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || ""))
        );
        setCrtPrograms(
          crtSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || ""))
        );
        setAllCourses(
          coursesSnap.docs
            .map((d) => ({ id: d.id, title: d.data().title || d.data().name || d.id }))
            .sort((a, b) => a.title.localeCompare(b.title))
        );
      } catch (err) {
        console.error("Failed to load WhatsApp page data", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchCrtBatches = useCallback(async (crtId) => {
    if (!crtId) {
      setCrtBatches([]);
      return;
    }
    try {
      const snap = await getDocs(
        collection(db, ...tenantSegments(null, "crt"), crtId, "batches")
      );
      setCrtBatches(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
      );
    } catch (err) {
      console.error("Failed to load CRT batches", err);
      setCrtBatches([]);
    }
  }, []);

  useEffect(() => {
    if (filterSource !== "crt" || !selectedCrtId) {
      setCrtBatches([]);
      return;
    }
    fetchCrtBatches(selectedCrtId);
  }, [filterSource, selectedCrtId, fetchCrtBatches]);

  useEffect(() => {
    if (filterSource !== "crt" || !selectedCrtId) {
      setCrtProgramStudentIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = new Set();
        const programStudentsSnap = await getDocs(
          collection(db, ...tenantSegments(null, "crt"), selectedCrtId, "students")
        );
        programStudentsSnap.docs.forEach((d) => {
          const data = d.data() || {};
          if (data.studentId) ids.add(String(data.studentId));
          if (data.uid) ids.add(String(data.uid));
          if (data.email) ids.add(String(data.email).trim().toLowerCase());
        });

        const batchesSnap = await getDocs(
          collection(db, ...tenantSegments(null, "crt"), selectedCrtId, "batches")
        );
        for (const batchDoc of batchesSnap.docs) {
          const stSnap = await getDocs(
            collection(
              db,
              ...tenantSegments(null, "crt"),
              selectedCrtId,
              "batches",
              batchDoc.id,
              "students"
            )
          );
          stSnap.docs.forEach((d) => {
            const data = d.data() || {};
            if (data.studentId) ids.add(String(data.studentId));
            if (data.uid) ids.add(String(data.uid));
            if (data.email) ids.add(String(data.email).trim().toLowerCase());
          });
        }

        if (!cancelled) setCrtProgramStudentIds(ids);
      } catch (err) {
        console.error("Failed to load CRT program students", err);
        if (!cancelled) setCrtProgramStudentIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterSource, selectedCrtId]);

  useEffect(() => {
    if (filterSource !== "crt" || !selectedCrtId || !selectedClassId) {
      setCrtBatchStudentIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          collection(
            db,
            ...tenantSegments(null, "crt"),
            selectedCrtId,
            "batches",
            selectedClassId,
            "students"
          )
        );
        if (cancelled) return;
        const ids = new Set();
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          if (data.studentId) ids.add(String(data.studentId));
          if (data.uid) ids.add(String(data.uid));
          if (data.email) ids.add(String(data.email).trim().toLowerCase());
          ids.add(d.id);
        });
        setCrtBatchStudentIds(ids);
      } catch (err) {
        console.error("Failed to load CRT batch students", err);
        if (!cancelled) setCrtBatchStudentIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterSource, selectedCrtId, selectedClassId]);

  useEffect(() => {
    setSelectedClassId("");
    setSelectedProgramId("");
    setSelectedCourseTitle("");
    setSelectedCrtId("");
  }, [filterSource]);

  useEffect(() => {
    setSelectedClassId("");
  }, [selectedProgramId, selectedCourseTitle, selectedCrtId]);

  const templateLanguage = useMemo(
    () => resolveWhatsAppTemplateLanguage(templateName),
    [templateName]
  );

  const courseTitleOptions = useMemo(() => {
    const fromStudents = new Set();
    students.forEach((s) => {
      getStudentCourseTitles(s).forEach((t) => t && fromStudents.add(String(t)));
    });
    allCourses.forEach((c) => c.title && fromStudents.add(String(c.title)));
    return Array.from(fromStudents).sort((a, b) => a.localeCompare(b));
  }, [students, allCourses]);

  const programBatchOptions = useMemo(() => {
    if (!selectedProgramId) return [];
    const program = programs.find((p) => p.id === selectedProgramId);
    const batches = Array.isArray(program?.batches) ? program.batches : [];
    return batches.map((batch) => ({
      value: String(batch.classId || batch.id || ""),
      label: batch.name || batch.className || batch.classId || batch.id || "Batch",
    }));
  }, [programs, selectedProgramId]);

  const courseBatchOptions = useMemo(() => {
    if (!selectedCourseTitle) return [];
    const set = new Set();
    students.forEach((s) => {
      const titles = getStudentCourseTitles(s);
      if (!titles.includes(selectedCourseTitle)) return;
      const classId = getStudentClassId(s);
      if (classId) set.add(classId);
    });
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((classId) => ({ value: classId, label: classId }));
  }, [students, selectedCourseTitle]);

  const allClassOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const classId = getStudentClassId(s);
      if (classId) set.add(classId);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const batchLabel =
    filterSource === "crt" ? "CRT Batch" : filterSource === "program" ? "Program Batch / Class" : "Class / Batch";

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (filterSource === "program") {
        if (!selectedProgramId) return true;
        const program = programs.find((p) => p.id === selectedProgramId);
        const batches = Array.isArray(program?.batches) ? program.batches : [];
        const classIds = batches.map((b) => String(b.classId || "")).filter(Boolean);
        const studentClassId = getStudentClassId(s);
        if (selectedClassId) {
          return studentClassId === String(selectedClassId);
        }
        return classIds.length === 0 ? false : classIds.includes(studentClassId);
      }

      if (filterSource === "course") {
        const titles = getStudentCourseTitles(s);
        if (selectedCourseTitle && !titles.includes(selectedCourseTitle)) return false;
        if (selectedClassId) {
          return getStudentClassId(s) === String(selectedClassId);
        }
        return selectedCourseTitle ? titles.includes(selectedCourseTitle) : true;
      }

      if (filterSource === "crt") {
        if (!selectedCrtId) return true;
        const email = String(s.email || "").trim().toLowerCase();
        const uid = String(s.uid || "");
        const inCrt =
          crtProgramStudentIds.has(s.id) ||
          (uid && crtProgramStudentIds.has(uid)) ||
          (email && crtProgramStudentIds.has(email));

        if (!selectedClassId) {
          return inCrt;
        }

        return (
          crtBatchStudentIds.has(s.id) ||
          (uid && crtBatchStudentIds.has(uid)) ||
          (email && crtBatchStudentIds.has(email))
        );
      }

      if (selectedClassId) {
        return getStudentClassId(s) === String(selectedClassId);
      }
      return true;
    });
  }, [
    students,
    filterSource,
    selectedProgramId,
    selectedCourseTitle,
    selectedCrtId,
    selectedClassId,
    programs,
    crtBatchStudentIds,
    crtProgramStudentIds,
  ]);

  function renderPreview(s, tmpl, p1In, p2In) {
    const name = p1In || s?.name || "Student";
    const totalFee = Number(s?.totalFee ?? 0);
    const paidFee = Number(s?.PayedFee ?? s?.payedFee ?? 0);
    const due = Math.max(totalFee - paidFee, 0);
    const value2 = p2In || `₹${due}`;

    if (tmpl === "fee_update_notification") {
      return `Hello ${name}, This is a reminder that your fee payment of ${value2} is due. Please make the payment by the due date to avoid any late charges. If you’ve already completed the payment, kindly ignore this message. Thank you for your prompt attention!`;
    }
    if (tmpl === "temporarily_blocked") {
      return `Dear ${name},\n\nYour account has been temporarily blocked due to a pending fee amount of ${value2}.\nPlease clear the outstanding payment at the earliest to restore full access.\n\nIf you have already made the payment, please Contact the Admin.\n\nThank you for your cooperation.\n\nBest regards,\nVAWE Institutes`;
    }
    if (tmpl === "custom_message") {
      return `Dear ${name},\n\n${p2In || ""}\n\nThank you for your cooperation.\n\nBest regards,\nVAWE Institute.`;
    }
    return `Template ${tmpl}: ${name}, ${value2}`;
  }

  async function handleSendBulk() {
    if (filtered.length === 0) {
      alert("No students match the selected filters");
      return;
    }
    if (!templateName) {
      alert("Enter template name");
      return;
    }

    setSending(true);
    setSendProgress({ sent: 0, total: 0, phase: "preparing" });

    try {
      const errors = [];
      let skippedNoPhone = 0;
      let skippedMissingParam = 0;

      const recipients = [];
      for (const s of filtered) {
        const phone = s.phone1 || s.phone;
        if (!phone) {
          skippedNoPhone++;
          continue;
        }

        let p1 = param1;
        let p2 = param2;
        const totalFee = Number(s.totalFee ?? 0);
        const paidFee = Number(s.PayedFee ?? s.payedFee ?? 0);
        const due = Math.max(totalFee - paidFee, 0);

        if (!p1 && templateName === "fee_update_notification") p1 = s.name || "Student";
        if (!p2 && templateName === "fee_update_notification") p2 = `₹${due}`;
        if (!p1 && templateName === "temporarily_blocked") p1 = s.name || "Student";
        if (!p2 && templateName === "temporarily_blocked") p2 = `₹${due}`;
        if (!p1 && templateName === "custom_message") p1 = s.name || "Student";
        if (templateName === "custom_message" && !p2) {
          skippedMissingParam++;
          continue;
        }

        recipients.push({
          id: s.id,
          name: s.name || "Student",
          phone,
          bodyParams:
            templateName === "custom_message"
              ? [p1 || s.name || "Student", p2]
              : [p1, p2].filter((v) => v != null && String(v).trim() !== ""),
        });
      }

      if (recipients.length === 0) {
        alert(
          [
            `Matched: ${filtered.length}`,
            skippedNoPhone ? `Skipped (no phone): ${skippedNoPhone}` : null,
            skippedMissingParam ? `Skipped (missing {{2}}): ${skippedMissingParam}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        );
        return;
      }

      setSendProgress({ sent: 0, total: recipients.length, phase: "sending" });

      const res = await makeAuthenticatedRequest("/api/send-whatsapp-bulk", {
        method: "POST",
        body: JSON.stringify({
          template: templateName,
          recipients,
          concurrency: 10,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const configHint = data?.config
          ? `\nToken set: ${data.config.hasToken ? "yes" : "no"}\nPhone ID set: ${data.config.hasPhoneNumberId ? "yes" : "no"}`
          : "";
        throw new Error((data?.error || data?.details || "Bulk send failed") + configHint);
      }

      const successes = Number(data.sent || 0);
      const failedResults = Array.isArray(data.errors) ? data.errors : [];
      const successResults = (data.results || []).filter((r) => r.ok);
      failedResults.forEach((item) => {
        errors.push({
          id: item.id,
          name: item.name,
          phone: item.phone,
          error: item.error || "Unknown error",
          errorCode: item.errorCode ?? null,
          language: item.language ?? null,
          languagesTried: item.languagesTried ?? null,
        });
      });

      setSendProgress({ sent: successes, total: recipients.length, phase: "locking" });

      if (templateName === "temporarily_blocked" && successes > 0) {
        const sentIds = (data.results || [])
          .filter((r) => r.ok && r.id)
          .map((r) => r.id);

        await Promise.all(
          sentIds.map(async (id) => {
            try {
              await makeAuthenticatedRequest("/api/update-student-lock", {
                method: "POST",
                body: JSON.stringify({ id, locked: true }),
              });
            } catch (lockErr) {
              console.error("Lock error for student:", id, lockErr);
            }
          })
        );
      }

      setSendProgress({ sent: successes, total: recipients.length, phase: "done" });

      const logPayload = {
        matched: filtered.length,
        eligible: recipients.length,
        sent: successes,
        failed: errors.length,
        template: templateName,
        language: data.languageUsed || templateLanguage,
        sender: data.sender || senderInfo,
        skippedNoPhone,
        skippedMissingParam,
      };
      if (successResults[0]) {
        logPayload.sample = {
          phone: successResults[0].phone,
          recipientId: successResults[0].recipientId,
          messageId: successResults[0].messageId,
        };
      }
      console.log("WhatsApp bulk send complete", logPayload);
      if (errors.length) {
        console.error("WhatsApp bulk send failures", errors);
      }
    } catch (e) {
      console.error("Bulk send error:", e);
    } finally {
      setSending(false);
      setSendProgress({ sent: 0, total: 0, phase: "idle" });
    }
  }

  return (
    <CheckAdminAuth>
      <div className="mx-auto p-6 bg-white shadow-md rounded-md">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
          >
            ⬅ Back
          </button>
          <button
            onClick={() => router.push("/Admin/whatsapp/unregister")}
            className="px-4 py-2 rounded bg-[#00448a] hover:bg-[#003a76] text-white"
          >
            Send to unregistered (Excel)
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-center text-emerald-700">WhatsApp Messaging</h2>
        {senderInfo?.displayPhoneNumber ? (
          <p className="text-center text-sm text-gray-600 mb-4">
            Sending from <strong>{senderInfo.verifiedName || "Business"}</strong> (
            {senderInfo.displayPhoneNumber})
            {senderInfo.qualityRating ? ` · Quality: ${senderInfo.qualityRating}` : ""}
          </p>
        ) : senderError ? (
          <p className="text-center text-sm text-amber-700 mb-4">{senderError}</p>
        ) : (
          <p className="text-center text-sm text-gray-500 mb-4">Checking WhatsApp sender…</p>
        )}

        {loading ? (
          <p className="text-center text-gray-600">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="all">All students</option>
                  <option value="program">Program</option>
                  <option value="course">Course</option>
                  <option value="crt">CRT</option>
                </select>
              </div>

              {filterSource === "program" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Program</label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select program</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.title || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filterSource === "course" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                  <select
                    value={selectedCourseTitle}
                    onChange={(e) => setSelectedCourseTitle(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select course</option>
                    {courseTitleOptions.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filterSource === "crt" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CRT Program</label>
                  <select
                    value={selectedCrtId}
                    onChange={(e) => setSelectedCrtId(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select CRT</option>
                    {crtPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.title || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(filterSource === "all" ||
                filterSource === "program" ||
                filterSource === "course" ||
                filterSource === "crt") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{batchLabel}</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={
                      (filterSource === "program" && !selectedProgramId) ||
                      (filterSource === "course" && !selectedCourseTitle) ||
                      (filterSource === "crt" && !selectedCrtId)
                    }
                    className="w-full border rounded px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {filterSource === "crt" ? "All CRT students" : "All in selection"}
                    </option>
                    {filterSource === "all" &&
                      allClassOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    {filterSource === "program" &&
                      programBatchOptions.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    {filterSource === "course" &&
                      courseBatchOptions.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    {filterSource === "crt" &&
                      crtBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.id}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {filterSource === "program" && "Batches come from the selected program"}
                    {filterSource === "course" && "Classes/batches for students in this course"}
                    {filterSource === "crt" && "Students assigned to this CRT batch"}
                    {filterSource === "all" && "Optional class filter for all students"}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="fee_update_notification">fee_update_notification</option>
                  <option value="temporarily_blocked">temporarily_blocked</option>
                  <option value="custom_message">custom_message</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Language auto-selected: <strong>{templateLanguage}</strong>
                  {templateName === "fee_update_notification" || templateName === "custom_message"
                    ? " (English)"
                    : " (English US)"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template {`{{1}}`}</label>
                <input
                  value={param1}
                  onChange={(e) => setParam1(e.target.value)}
                  placeholder="Defaults to Student Name if empty"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template {`{{2}}`}</label>
                {templateName === "custom_message" ? (
                  <textarea
                    value={param2}
                    onChange={(e) => setParam2(e.target.value)}
                    placeholder="Write your message body for {{2}}"
                    className="w-full border rounded px-3 py-2 min-h-[100px]"
                  />
                ) : (
                  <input
                    value={param2}
                    onChange={(e) => setParam2(e.target.value)}
                    placeholder="Defaults to ₹Due if empty"
                    className="w-full border rounded px-3 py-2"
                  />
                )}
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSendBulk}
                  disabled={sending}
                  className={`w-full px-4 py-2 rounded ${sending ? "bg-gray-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
                >
                  {sending
                    ? sendProgress.phase === "sending"
                      ? `Sending ${sendProgress.total} messages in parallel…`
                      : sendProgress.phase === "locking"
                        ? "Locking accounts…"
                        : "Preparing…"
                    : `Send to ${filtered.length} students`}
                </button>
              </div>
            </div>

            {sending && sendProgress.total > 0 && (
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between text-sm text-emerald-900 mb-2">
                  <span>
                    {sendProgress.phase === "locking"
                      ? "Applying account locks…"
                      : "Sending WhatsApp messages in parallel (up to 10 at a time)…"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                  <div className="h-full w-full animate-pulse rounded-full bg-emerald-500" />
                </div>
              </div>
            )}

            <div className="mb-6 p-4 border rounded bg-gray-50">
              <h4 className="font-semibold mb-2">Message preview</h4>
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{renderPreview(filtered[0], templateName, param1, param2)}</pre>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Preview ({filtered.length})</h3>
              <div className="max-h-72 overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Role</th>
                      <th className="border p-2 text-left">Phone</th>
                      <th className="border p-2 text-left">Class / Batch</th>
                      <th className="border p-2 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const totalFee = Number(s.totalFee ?? 0);
                      const paidFee = Number(s.PayedFee ?? s.payedFee ?? 0);
                      const due = Math.max(totalFee - paidFee, 0);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="border p-2">{s.name || '-'}</td>
                          <td className="border p-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isCrtStudentRole(inferStudentRole(s))
                                  ? "bg-blue-100 text-blue-700"
                                  : isSkillwinsStudentRole(inferStudentRole(s))
                                  ? "bg-violet-100 text-violet-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {isSkillwinsStudentRole(inferStudentRole(s))
                                ? inferStudentRole(s)
                                : formatStudentRoleLabel(inferStudentRole(s))}
                            </span>
                          </td>
                          <td className="border p-2">{s.phone1 || s.phone || '-'}</td>
                          <td className="border p-2">{getStudentClassId(s) || "-"}</td>
                          <td className="border p-2 text-right">₹{due}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </CheckAdminAuth>
  );
}


