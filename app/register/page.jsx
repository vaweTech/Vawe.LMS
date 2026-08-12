"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { db, firestoreHelpers } from "../../lib/firebase";
import { orderBy, limit } from "firebase/firestore";

function RegisterHeader() {
  return (
    <header className="border-b border-gray-200 bg-[#00448a] shadow-sm">
      <div className="mx-auto flex max-w-2xl mt-[-75px] items-center gap-3 px-4 py-3">
        <Image src="/logo1.png" alt="Vawe Institutes" width={40} height={40} className="h-10 w-10 object-contain" />
        <span className="text-lg font-semibold text-white">VAWE INSTITUTES</span>
      </div>
    </header>
  );
}

function RegisterFormFallback() {
  return (
    <div className="min-h-screen bg-gray-50">
      <RegisterHeader />
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-600">Loading form...</p>
      </div>
    </div>
  );
}

function RegisterFormContent() {
  const searchParams = useSearchParams();
  const formIdFromUrl = useMemo(() => searchParams.get("formId"), [searchParams]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [verifiedPhones, setVerifiedPhones] = useState({});
  const [otpQuestionId, setOtpQuestionId] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpSendLoading, setOtpSendLoading] = useState(false);
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (formIdFromUrl) {
          const docRef = firestoreHelpers.doc(db, "registerForms", formIdFromUrl);
          const snap = await firestoreHelpers.getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setForm({ id: snap.id, ...data });
            const initial = {};
            (data.questions || []).forEach((question) => {
              initial[question.id] = question.type === "checkbox" ? [] : "";
            });
            setAnswers(initial);
          } else {
            setForm(null);
          }
        } else {
          const q = firestoreHelpers.query(
            firestoreHelpers.collection(db, "registerForms"),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const snap = await firestoreHelpers.getDocs(q);
          if (!snap.empty) {
            const doc = snap.docs[0];
            setForm({ id: doc.id, ...doc.data() });
            const initial = {};
            (doc.data().questions || []).forEach((question) => {
              initial[question.id] = question.type === "checkbox" ? [] : "";
            });
            setAnswers(initial);
          } else {
            setForm(null);
          }
        }
      } catch (err) {
        console.error(err);
        setError(err?.message || "Failed to load form");
      } finally {
        setLoading(false);
      }
    })();
  }, [formIdFromUrl]);

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function setCheckboxAnswer(questionId, optionIndex, checked) {
    setAnswers((prev) => {
      const arr = Array.isArray(prev[questionId]) ? [...prev[questionId]] : [];
      if (checked) {
        if (!arr.includes(optionIndex)) arr.push(optionIndex);
      } else {
        const i = arr.indexOf(optionIndex);
        if (i !== -1) arr.splice(i, 1);
      }
      return { ...prev, [questionId]: arr };
    });
  }

  const phoneVerifyQuestions = useMemo(
    () => (form?.questions || []).filter((q) => q.type === "phone" && q.phoneVerifyRequired),
    [form?.questions]
  );

  async function handleSendOtp(questionId) {
    const phone = (answers[questionId] || "").trim();
    if (!phone) {
      setOtpError("Please enter your phone number first.");
      return;
    }
    setOtpError("");
    setOtpSendLoading(true);
    try {
      const res = await fetch("/api/send-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(data?.error || "Failed to send OTP");
        return;
      }
      setOtpQuestionId(questionId);
      setOtpSent(true);
      setOtpInput("");
    } catch (err) {
      setOtpError(err?.message || "Failed to send OTP");
    } finally {
      setOtpSendLoading(false);
    }
  }

  async function handleVerifyOtp(questionId) {
    const phone = (answers[questionId] || "").trim();
    const otp = otpInput.trim();
    if (!phone || !otp) {
      setOtpError("Enter the OTP you received on WhatsApp.");
      return;
    }
    setOtpError("");
    setOtpVerifyLoading(true);
    try {
      const res = await fetch("/api/verify-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setOtpError(data?.reason === "expired" ? "OTP expired. Please request a new one." : data?.reason === "locked_out" ? "Too many attempts. Try again later." : data?.error || "Invalid OTP");
        return;
      }
      setVerifiedPhones((prev) => ({ ...prev, [questionId]: true }));
      setOtpQuestionId(null);
      setOtpSent(false);
      setOtpInput("");
    } catch (err) {
      setOtpError(err?.message || "Verification failed");
    } finally {
      setOtpVerifyLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form) return;
    const questions = form.questions || [];
    for (const q of questions) {
      if (q.required) {
        const val = answers[q.id];
        if (val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
          alert(`Please answer: ${q.title || "Question"}`);
          return;
        }
      }
    }
    for (const q of questions) {
      if (q.type === "phone" && q.phoneVerifyRequired && !verifiedPhones[q.id]) {
        alert("Please verify your phone number(s) via WhatsApp OTP before submitting.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        answers,
        submittedAt: new Date().toISOString(),
      };
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(db, "registerForms", form.id, "responses"),
        payload
      );
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Failed to submit: " + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RegisterHeader />
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RegisterHeader />
        <div className="flex items-center justify-center p-4 py-16">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RegisterHeader />
        <div className="flex items-center justify-center p-4 py-16">
          <p className="text-gray-600">No registration form available.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RegisterHeader />
        <div className="flex items-center justify-center p-4 py-16">
          <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Response recorded</h2>
            <p className="mt-2 text-gray-600">Thank you for submitting the form.</p>
          </div>
        </div>
      </div>
    );
  }

  const questions = form.questions || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <RegisterHeader />
      <div className="mx-auto max-w-2xl py-8 px-4">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-6">
            <h1 className="text-2xl font-semibold text-gray-900">{form.title || "Registration Form"}</h1>
            {form.description ? (
              <p className="mt-2 text-gray-600">{form.description}</p>
            ) : null}
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            {questions.map((q, index) => (
              <div key={q.id} className="mb-8">
                <label className="block">
                  <span className="text-base font-medium text-gray-900">
                    {q.title || "Question"}
                    {q.required && <span className="text-red-500"> *</span>}
                  </span>
                  {q.description ? (
                    <span className="mt-1 block text-sm text-gray-500">{q.description}</span>
                  ) : null}
                </label>
                <div className="mt-2">
                  {q.type === "short" && (
                    <input
                      type="text"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required={q.required}
                    />
                  )}
                  {q.type === "paragraph" && (
                    <textarea
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required={q.required}
                    />
                  )}
                  {q.type === "multiple" && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === i}
                            onChange={() => setAnswer(q.id, i)}
                            className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "checkbox" && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(answers[q.id] || []).includes(i)}
                            onChange={(e) => setCheckboxAnswer(q.id, i, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "dropdown" && (
                    <select
                      value={answers[q.id] !== undefined && answers[q.id] !== "" ? String(answers[q.id]) : ""}
                      onChange={(e) => setAnswer(q.id, e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required={q.required}
                    >
                      <option value="">Select</option>
                      {(q.options || []).map((opt, i) => (
                        <option key={i} value={i}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {q.type === "email" && (
                    <input
                      type="email"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required={q.required}
                    />
                  )}
                  {q.type === "phone" && (
                    <>
                      <input
                        type="tel"
                        value={answers[q.id] ?? ""}
                        onChange={(e) => {
                          setAnswer(q.id, e.target.value);
                          if (verifiedPhones[q.id]) setVerifiedPhones((prev) => ({ ...prev, [q.id]: false }));
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        required={q.required}
                      />
                      {q.phoneVerifyRequired && (
                        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          {verifiedPhones[q.id] ? (
                            <p className="flex items-center gap-2 text-sm font-medium text-green-700">
                              <span>✓</span> Phone verified via WhatsApp
                            </p>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSendOtp(q.id)}
                                disabled={otpSendLoading || !(answers[q.id] || "").trim()}
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {otpSendLoading ? "Sending…" : "Send OTP via WhatsApp"}
                              </button>
                              {otpQuestionId === q.id && otpSent && (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="Enter 6-digit OTP"
                                    value={otpInput}
                                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyOtp(q.id)}
                                    disabled={otpVerifyLoading || otpInput.length < 4}
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {otpVerifyLoading ? "Verifying…" : "Verify OTP"}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {q.type === "date" && (
                    <input
                      type="date"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      required={q.required}
                    />
                  )}
                </div>
              </div>
            ))}
            {otpError && (
              <p className="mt-4 text-sm text-red-600">{otpError}</p>
            )}
            <div className="mt-8">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
              {phoneVerifyQuestions.length > 0 && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  Verify all phone numbers marked with WhatsApp OTP before submitting.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterFormPage() {
  return (
    <Suspense fallback={<RegisterFormFallback />}>
      <RegisterFormContent />
    </Suspense>
  );
}