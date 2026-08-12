"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db, firestoreHelpers } from "../../../../../lib/firebase";
import { makeAuthenticatedRequest } from "../../../../../lib/authUtils";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Get display text for an answer given the question (for options we resolve index to label) */
function answerDisplay(question, value) {
  if (value === undefined || value === null) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    const opts = question?.options || [];
    return value.map((i) => (opts[i] != null ? opts[i] : `Option ${i + 1}`)).join(", ");
  }
  if (typeof value === "number" && Array.isArray(question?.options)) {
    return question.options[value] != null ? question.options[value] : `Option ${value + 1}`;
  }
  return String(value).trim() || "—";
}

function optionLabel(question, index) {
  const opts = question?.options || [];
  return opts[index] != null ? String(opts[index]) : `Option ${index + 1}`;
}

/** Aggregate feedback stats for multiple / checkbox / dropdown questions */
function computeChoiceStats(question, responses) {
  const opts = question?.options || [];
  const counts = opts.map(() => 0);
  let answered = 0;
  const numericValues = [];

  for (const res of responses) {
    const raw = res.answers?.[question.id];
    if (raw === undefined || raw === null) continue;

    if (question.type === "checkbox" && Array.isArray(raw)) {
      if (raw.length === 0) continue;
      answered += 1;
      for (const idx of raw) {
        if (typeof idx === "number" && idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
      continue;
    }

    if (typeof raw === "number" && raw >= 0 && raw < counts.length) {
      answered += 1;
      counts[raw] += 1;
      const label = optionLabel(question, raw);
      const num = Number(label);
      if (!Number.isNaN(num)) numericValues.push(num);
    }
  }

  const total = answered || responses.length || 1;
  const breakdown = opts.map((label, i) => ({
    label: label != null ? String(label) : `Option ${i + 1}`,
    count: counts[i],
    percent: Math.round((counts[i] / total) * 100),
  }));

  const top = breakdown.reduce(
    (best, row) => (row.count > best.count ? row : best),
    { label: "—", count: 0, percent: 0 }
  );

  const numericAvg =
    numericValues.length > 0
      ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(1)
      : null;

  return { answered, breakdown, top, numericAvg };
}

function questionTypeLabel(type) {
  const map = {
    short: "Short answer",
    paragraph: "Paragraph",
    multiple: "Multiple choice",
    checkbox: "Checkboxes",
    dropdown: "Dropdown",
    email: "Email",
    phone: "Phone",
    date: "Date",
  };
  return map[type] || type;
}

/** Build student payload from form response for create-student API */
function buildStudentPayload(questions, answers) {
  const getAnswer = (q) => {
    const v = answers?.[q.id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.map((i) => (q.options?.[i] != null ? q.options[i] : String(i))).join(", ");
    if (typeof v === "number" && Array.isArray(q.options)) return q.options[v] != null ? q.options[v] : String(v);
    return String(v).trim();
  };
  const getAnswerRaw = (q) => {
    const v = answers?.[q.id];
    if (v === undefined || v === null) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v).trim();
  };

  let email = "";
  let name = "";
  let classId = "general";
  let regdNo = `REG-${Date.now()}`;
  const titleLower = (t) => (t || "").toLowerCase();

  for (const q of questions) {
    const val = getAnswerRaw(q);
    const t = titleLower(q.title);
    if (q.type === "email" && val) email = val;
    if ((t.includes("name") && !t.includes("father") && !t.includes("mother")) || (q.type === "short" && !name && val)) name = name || val;
    if (t.includes("class") || t.includes("classid")) classId = val || classId;
    if (t.includes("reg") || t.includes("registration") || t.includes("regd")) regdNo = val || regdNo;
  }
  if (!email && questions.length) {
    const emailQ = questions.find((q) => q.type === "email");
    if (emailQ) email = getAnswerRaw(emailQ);
  }
  if (!name && questions.length) {
    const shortQ = questions.find((q) => q.type === "short");
    if (shortQ) name = getAnswerRaw(shortQ);
  }

  const payload = {
    email: email || "unknown@example.com",
    name: name || "Student",
    classId: classId || "general",
    regdNo: regdNo || `REG-${Date.now()}`,
  };

  for (const q of questions) {
    const val = getAnswerRaw(q);
    if (!val) continue;
    const key = (q.title || q.id).replace(/\s+/g, " ").trim().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || `q_${q.id}`;
    if (!["email", "name", "classId", "regdNo"].includes(key)) payload[key] = val;
  }

  const phoneQ = questions.find(
    (q) =>
      q.type === "phone" ||
      titleLower(q.title).includes("phone") ||
      titleLower(q.title).includes("mobile") ||
      titleLower(q.title).includes("whatsapp")
  );
  if (phoneQ && getAnswerRaw(phoneQ)) payload.phone = getAnswerRaw(phoneQ);
  const fatherQ = questions.find((q) => titleLower(q.title).includes("father"));
  if (fatherQ && getAnswerRaw(fatherQ)) payload.fatherName = getAnswerRaw(fatherQ);
  const addressQ = questions.find((q) => titleLower(q.title).includes("address"));
  if (addressQ && getAnswerRaw(addressQ)) payload.address = getAnswerRaw(addressQ);

  return payload;
}

const DEFAULT_STUDENT_PASSWORD = "Vawe@2026";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function FormResponsesPage() {
  const router = useRouter();
  const params = useParams();
  const formId = params?.formId ?? null;
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioningId, setActioningId] = useState(null);
  const [authExistsByResponseId, setAuthExistsByResponseId] = useState({});
  const [authCheckInFlight, setAuthCheckInFlight] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = firestoreHelpers.doc(db, "users", u.uid);
        const snap = await firestoreHelpers.getDoc(ref);
        const userRole = snap.exists() ? snap.data().role : null;
        setIsSuperAdmin(userRole === "superadmin");
        setIsAdmin(
          userRole === "admin" ||
          userRole === "superadmin" ||
          userRole === "collegeAdmin"
        );
      } else {
        setIsSuperAdmin(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!formId || !user || !isAdmin) return;
    (async () => {
      try {
        const formRef = firestoreHelpers.doc(db, "registerForms", formId);
        const formSnap = await firestoreHelpers.getDoc(formRef);
        if (!formSnap.exists()) {
          setError("Form not found");
          return;
        }
        const formData = { id: formSnap.id, ...formSnap.data() };
        setForm(formData);

        if (formData.isFeedback && !isSuperAdmin) {
          setResponses([]);
          return;
        }

        const responsesCol = firestoreHelpers.collection(db, "registerForms", formId, "responses");
        const responsesSnap = await firestoreHelpers.getDocs(responsesCol);
        const list = responsesSnap.docs.map((d) => ({ id: d.id, status: "pending", ...d.data() }));
        list.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
        setResponses(list);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Failed to load submissions");
      }
    })();
  }, [formId, user, isAdmin, isSuperAdmin]);

  useEffect(() => {
    if (!user || !isAdmin || !form || !Array.isArray(responses) || responses.length === 0) return;

    const questions = form?.questions || [];
    const approved = responses.filter((r) => (r.status || "pending") === "approved");
    if (approved.length === 0) return;

    let cancelled = false;

    (async () => {
      const jobs = approved
        .map((r) => {
          const alreadyKnown = authExistsByResponseId[r.id] !== undefined;
          const alreadyChecking = authCheckInFlight[r.id];
          if (alreadyKnown || alreadyChecking) return null;

          const payload = buildStudentPayload(questions, r.answers);
          const email = String(payload?.email || "").trim();
          if (!email || email === "unknown@example.com") return null;

          return { id: r.id, email };
        })
        .filter(Boolean);

      if (jobs.length === 0) return;

      setAuthCheckInFlight((prev) => {
        const next = { ...prev };
        for (const j of jobs) next[j.id] = true;
        return next;
      });

      await Promise.all(
        jobs.map(async (j) => {
          try {
            const res = await makeAuthenticatedRequest("/api/check-auth-user", {
              method: "POST",
              body: JSON.stringify({ email: j.email }),
            });
            const data = await res.json().catch(() => ({}));
            const exists = Boolean(data?.exists);
            if (!cancelled) {
              setAuthExistsByResponseId((prev) => ({ ...prev, [j.id]: exists }));
            }
          } catch (err) {
            console.warn("Auth existence check failed:", err);
            if (!cancelled) {
              // Leave undefined to avoid hiding Approve unnecessarily
              setAuthExistsByResponseId((prev) => ({ ...prev }));
            }
          } finally {
            if (!cancelled) {
              setAuthCheckInFlight((prev) => ({ ...prev, [j.id]: false }));
            }
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, form, responses]);

  const filteredResponses = useMemo(() => {
    if (statusFilter === "all") return responses;
    return responses.filter((r) => (r.status || "pending") === statusFilter);
  }, [responses, statusFilter]);

  function logout() {
    signOut(auth);
  }

  async function handleApprove(res) {
    const questions = form?.questions || [];
    const payload = buildStudentPayload(questions, res.answers);
    if (!payload.email || payload.email === "unknown@example.com") {
      alert("This submission has no email. Add an Email question to the form or ensure the user filled it.");
      return;
    }
    setActioningId(res.id);
    try {
      const response = await makeAuthenticatedRequest("/api/create-student", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data?.error || "Failed to create student");
        return;
      }
      const docRef = firestoreHelpers.doc(db, "registerForms", formId, "responses", res.id);
      await firestoreHelpers.updateDoc(docRef, { status: "approved" });
      setResponses((prev) => prev.map((r) => (r.id === res.id ? { ...r, status: "approved" } : r)));

      const defaultPassword = DEFAULT_STUDENT_PASSWORD;
      let whatsappNote = "";

      const studentPhone = String(payload.phone || payload.phone1 || "").trim();
      if (studentPhone) {
        try {
          const waRes = await makeAuthenticatedRequest("/api/send-admission-whatsapp", {
            method: "POST",
            body: JSON.stringify({
              phone: studentPhone,
              name: payload.name,
              email: payload.email,
              password: defaultPassword,
            }),
          });
          const waData = await waRes.json().catch(() => ({}));
          if (!waRes.ok) {
            throw new Error(waData?.error || "Could not send WhatsApp messages");
          }
          if (waData.partial) {
            whatsappNote =
              "Welcome WhatsApp sent.\n\n" +
              "Password WhatsApp NOT sent.\n" +
              "Check template login_passwrod is approved in Meta (language: en_US).\n" +
              (waData.passwordError ? `Meta error: ${waData.passwordError}` : "");
          } else {
            whatsappNote = `WhatsApp welcome + login password sent to ${studentPhone}.`;
          }
        } catch (waErr) {
          console.warn("Admission WhatsApp error:", waErr);
          whatsappNote = `WhatsApp failed: ${waErr?.message || "Could not send WhatsApp messages."}`;
        }
      } else {
        whatsappNote = "No phone on submission — WhatsApp not sent.";
      }

      alert(`Approved. Student created. Default password: ${defaultPassword}.\n\n${whatsappNote}`);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to approve");
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(res) {
    setActioningId(res.id);
    try {
      const docRef = firestoreHelpers.doc(db, "registerForms", formId, "responses", res.id);
      await firestoreHelpers.updateDoc(docRef, { status: "rejected" });
      setResponses((prev) => prev.map((r) => (r.id === res.id ? { ...r, status: "rejected" } : r)));
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to reject");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(res) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setActioningId(res.id);
    try {
      const docRef = firestoreHelpers.doc(db, "registerForms", formId, "responses", res.id);
      await firestoreHelpers.deleteDoc(docRef);
      setResponses((prev) => prev.filter((r) => r.id !== res.id));
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete");
    } finally {
      setActioningId(null);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user || !isAdmin) return <div className="p-8">Access Denied</div>;
  if (form?.isFeedback && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Superadmin only</h1>
          <p className="text-sm text-gray-600 mb-6">
            This is a feedback form. Submissions can only be viewed by a superadmin account.
          </p>
          <button
            type="button"
            onClick={() => router.push("/Admin/register-form")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to forms
          </button>
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!form) return <div className="p-8">Loading...</div>;

  const questions = form.questions || [];
  const isFeedbackForm = Boolean(form.isFeedback);

  if (isFeedbackForm) {
    return (
      <motion.div className="min-h-screen bg-slate-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div
          className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div className="flex items-center gap-3" initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <button
              type="button"
              onClick={() => router.push("/Admin/register-form")}
              className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <span className="text-sm font-medium text-slate-700">Feedback responses</span>
              <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Superadmin
              </span>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <Link
              href={`/Admin/register-form/edit/${formId}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit form
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </motion.div>

        <div className="mx-auto max-w-5xl px-4 py-8">
          <motion.div
            className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <h1 className="text-2xl font-bold text-slate-900">{form.title || "Untitled feedback form"}</h1>
            {form.description ? (
              <p className="mt-2 text-sm text-slate-600">{form.description}</p>
            ) : null}
            <p className="mt-4 text-sm font-medium text-indigo-700">
              {responses.length} total response{responses.length === 1 ? "" : "s"}
            </p>
          </motion.div>

          {responses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              No feedback submissions yet.
            </div>
          ) : (
            <>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Summary</h2>
              <div className="mb-10 space-y-5">
                {questions.map((q, qIndex) => {
                  const isChoice = ["multiple", "checkbox", "dropdown"].includes(q.type);
                  const stats = isChoice ? computeChoiceStats(q, responses) : null;
                  const textAnswers = !isChoice
                    ? responses
                        .map((r) => ({
                          id: r.id,
                          text: answerDisplay(q, r.answers?.[q.id]),
                          at: r.submittedAt,
                        }))
                        .filter((a) => a.text !== "—")
                    : [];

                  return (
                    <motion.div
                      key={q.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      initial={{ y: 16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.08 + qIndex * 0.04 }}
                    >
                      <motion.div
                        className="mb-3 flex flex-wrap items-start justify-between gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.12 + qIndex * 0.04 }}
                      >
                        <motion.div
                          initial={{ x: -6, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.14 + qIndex * 0.04 }}
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Q{qIndex + 1} · {questionTypeLabel(q.type)}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-slate-900">
                            {q.title || "Untitled question"}
                          </h3>
                          {q.description ? (
                            <p className="mt-1 text-sm text-slate-500">{q.description}</p>
                          ) : null}
                        </motion.div>
                        {isChoice && stats ? (
                          <motion.div
                            className="rounded-xl bg-indigo-50 px-3 py-2 text-right"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.16 + qIndex * 0.04 }}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                              Top answer
                            </p>
                            <p className="text-sm font-bold text-indigo-900">{stats.top.label}</p>
                            <p className="text-xs text-indigo-700">
                              {stats.top.percent}% ({stats.top.count} of {stats.answered || responses.length})
                            </p>
                            {stats.numericAvg != null ? (
                              <p className="mt-1 text-xs font-medium text-indigo-800">
                                Avg score: {stats.numericAvg}
                              </p>
                            ) : null}
                          </motion.div>
                        ) : null}
                      </motion.div>

                      {isChoice && stats ? (
                        <div className="space-y-3">
                          {stats.breakdown.map((row, rowIdx) => (
                            <motion.div key={`${q.id}-opt-${rowIdx}`}>
                              <motion.div
                                className="mb-1 flex items-center justify-between text-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.18 + qIndex * 0.04 }}
                              >
                                <span className="font-medium text-slate-800">{row.label}</span>
                                <span className="text-slate-500">
                                  {row.count} · {row.percent}%
                                </span>
                              </motion.div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                <motion.div
                                  className="h-full rounded-full bg-indigo-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${row.percent}%` }}
                                  transition={{ duration: 0.5, delay: 0.2 + qIndex * 0.04 }}
                                />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                          {textAnswers.length === 0 ? (
                            <p className="text-sm text-slate-400">No answers yet.</p>
                          ) : (
                            textAnswers.map((a) => (
                              <motion.div
                                key={a.id}
                                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <p className="whitespace-pre-wrap text-sm text-slate-800">{a.text}</p>
                                <p className="mt-1 text-[11px] text-slate-400">{formatDate(a.at)}</p>
                              </motion.div>
                            ))
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <h2 className="mb-4 text-lg font-semibold text-slate-900">All responses</h2>
              <div className="space-y-4">
                {responses.map((res, resIndex) => (
                  <motion.div
                    key={res.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 + resIndex * 0.03 }}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Response #{responses.length - resIndex}
                        </p>
                        <p className="text-sm text-slate-700">{formatDate(res.submittedAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(res)}
                        disabled={actioningId === res.id}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {actioningId === res.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                    <dl className="space-y-4">
                      {questions.map((q, qIdx) => (
                        <motion.div
                          key={q.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 + resIndex * 0.03 + qIdx * 0.02 }}
                        >
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {q.title || "Question"}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                            {answerDisplay(q, res.answers?.[q.id])}
                          </dd>
                        </motion.div>
                      ))}
                    </dl>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/Admin/register-form")}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700">Submissions</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/Admin/register-form/edit/${formId}`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit form
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">{form.title || "Untitled form"}</h1>
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <p className="text-sm text-gray-500">
            {filteredResponses.length} of {responses.length} submission(s)
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter:</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  statusFilter === f.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredResponses.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
            {responses.length === 0 ? "No submissions yet." : "No submissions match the selected filter."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">Submitted</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                  {questions.map((q) => (
                    <th key={q.id} className="max-w-[180px] truncate px-4 py-3 font-medium text-gray-700">
                      {q.title || "Question"}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredResponses.map((res) => {
                  const status = res.status || "pending";
                  const isActioning = actioningId === res.id;
                  const authKnown = authExistsByResponseId[res.id];
                  const authMissing = authKnown === false;
                  const canShowApprove = status !== "approved" || authMissing;
                  return (
                    <tr key={res.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatDate(res.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            status === "approved"
                              ? "bg-green-100 text-green-800"
                              : status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending"}
                        </span>
                      </td>
                      {questions.map((q) => (
                        <td key={q.id} className="max-w-[180px] px-4 py-3 text-gray-900">
                          <span className="line-clamp-2 block" title={answerDisplay(q, res.answers?.[q.id])}>
                            {answerDisplay(q, res.answers?.[q.id])}
                          </span>
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {canShowApprove && (
                            <button
                              type="button"
                              onClick={() => handleApprove(res)}
                              disabled={isActioning}
                              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {isActioning ? "…" : status === "approved" ? "Approve again" : "Approve"}
                            </button>
                          )}
                          {status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => handleReject(res)}
                              disabled={isActioning}
                              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(res)}
                            disabled={isActioning}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
