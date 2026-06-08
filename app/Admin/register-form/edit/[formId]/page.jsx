"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db, firestoreHelpers } from "../../../../../lib/firebase";

const FIELD_TYPES = [
  { value: "short", label: "Short answer", icon: "—" },
  { value: "paragraph", label: "Paragraph", icon: "¶" },
  { value: "multiple", label: "Multiple choice", icon: "○" },
  { value: "checkbox", label: "Checkboxes", icon: "☑" },
  { value: "dropdown", label: "Dropdown", icon: "▾" },
  { value: "email", label: "Email", icon: "@" },
  { value: "phone", label: "Phone", icon: "📞" },
  { value: "date", label: "Date", icon: "📅" },
];

function getDefaultQuestion(type = "short") {
  return {
    id: crypto.randomUUID?.() ?? Date.now().toString(36),
    type,
    title: "",
    description: "",
    required: false,
    options: type === "multiple" || type === "checkbox" || type === "dropdown" ? ["Option 1"] : undefined,
  };
}

function stripUndefined(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => stripUndefined(item));
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = stripUndefined(v);
  }
  return out;
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return [getDefaultQuestion("short")];
  return questions.map((q) => ({
    id: q.id ?? crypto.randomUUID?.() ?? Date.now().toString(36),
    type: q.type || "short",
    title: q.title ?? "",
    description: q.description ?? "",
    required: Boolean(q.required),
    phoneVerifyRequired: q.type === "phone" ? Boolean(q.phoneVerifyRequired) : undefined,
    options: ["multiple", "checkbox", "dropdown"].includes(q.type) && Array.isArray(q.options) ? q.options : undefined,
  }));
}

export default function EditRegisterFormPage() {
  const router = useRouter();
  const params = useParams();
  const formId = params?.formId ?? null;
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formLoadError, setFormLoadError] = useState(null);
  const [formTitle, setFormTitle] = useState("Untitled form");
  const [formDescription, setFormDescription] = useState("");
  const [questions, setQuestions] = useState([getDefaultQuestion("short")]);
  const [saving, setSaving] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = firestoreHelpers.doc(db, "users", u.uid);
        const snap = await firestoreHelpers.getDoc(ref);
        const userRole = snap.exists() ? snap.data().role : null;
        setIsAdmin(userRole === "admin" || userRole === "superadmin");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!formId || !user || !isAdmin) return;
    (async () => {
      try {
        const docRef = firestoreHelpers.doc(db, "registerForms", formId);
        const snap = await firestoreHelpers.getDoc(docRef);
        if (!snap.exists()) {
          setFormLoadError("Form not found");
          return;
        }
        const data = snap.data();
        setFormTitle(data.title ?? "Untitled form");
        setFormDescription(data.description ?? "");
        setQuestions(normalizeQuestions(data.questions));
      } catch (err) {
        console.error(err);
        setFormLoadError(err?.message || "Failed to load form");
      }
    })();
  }, [formId, user, isAdmin]);

  function logout() {
    signOut(auth);
  }

  function addQuestion(type = "short") {
    setQuestions((prev) => [...prev, getDefaultQuestion(type)]);
    setShowAddMenu(false);
  }

  function updateQuestion(id, updates) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const next = { ...q, ...updates };
        const needsOptions = ["multiple", "checkbox", "dropdown"].includes(next.type);
        if (needsOptions && !(next.options?.length)) next.options = ["Option 1"];
        if (!needsOptions) next.options = undefined;
        return next;
      })
    );
  }

  function removeQuestion(id) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function duplicateQuestion(id) {
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    const copy = { ...getDefaultQuestion(q.type), ...q, id: crypto.randomUUID?.() ?? Date.now().toString(36) };
    if (copy.options) copy.options = [...copy.options];
    const idx = questions.findIndex((x) => x.id === id);
    setQuestions((prev) => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
  }

  function moveQuestion(id, dir) {
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return;
    const next = dir === "up" ? idx - 1 : idx + 1;
    if (next < 0 || next >= questions.length) return;
    const arr = [...questions];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setQuestions(arr);
  }

  function addOption(questionId) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };
      })
    );
  }

  function updateOption(questionId, optionIndex, value) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const opts = [...q.options];
        opts[optionIndex] = value;
        return { ...q, options: opts };
      })
    );
  }

  function removeOption(questionId, optionIndex) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const opts = q.options.filter((_, i) => i !== optionIndex);
        return { ...q, options: opts.length ? opts : ["Option 1"] };
      })
    );
  }

  async function saveForm() {
    if (!formTitle.trim()) {
      alert("Please enter a form title.");
      return;
    }
    if (!formId) return;
    setSaving(true);
    try {
      const payload = stripUndefined({
        title: formTitle.trim(),
        description: formDescription.trim(),
        questions,
        updatedAt: new Date().toISOString(),
      });
      const docRef = firestoreHelpers.doc(db, "registerForms", formId);
      await firestoreHelpers.updateDoc(docRef, payload);
      alert("Form updated successfully.");
      router.push("/Admin/register-form");
    } catch (err) {
      console.error(err);
      alert("Failed to update form: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user || !isAdmin) return <div className="p-8">Access Denied</div>;
  if (formLoadError) return <div className="p-8 text-red-600">{formLoadError}</div>;

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
          <span className="text-sm font-medium text-gray-700">Edit form</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveForm}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Form title"
            className="w-full border-0 border-b-2 border-transparent bg-transparent pb-2 text-2xl font-medium text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-0"
          />
          <input
            type="text"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Form description (optional)"
            className="mt-2 w-full border-0 bg-transparent text-sm text-gray-500 placeholder-gray-400 outline-none focus:ring-0"
          />
        </div>

        {questions.map((q, index) => (
          <div
            key={q.id}
            className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                    placeholder="Question"
                    className="flex-1 border-0 border-b border-transparent bg-transparent pb-1 text-base font-medium text-gray-900 outline-none focus:border-indigo-500"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
                    className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {q.description !== undefined && (
                  <input
                    type="text"
                    value={q.description}
                    onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="mt-1 w-full border-0 bg-transparent text-sm text-gray-500 outline-none focus:ring-0"
                  />
                )}
                <div className="mt-4">
                  {q.type === "short" && (
                    <input
                      type="text"
                      placeholder="Short answer text"
                      disabled
                      className="w-full max-w-md border-0 border-b border-gray-300 bg-transparent py-1 text-sm text-gray-400 outline-none"
                    />
                  )}
                  {q.type === "paragraph" && (
                    <textarea
                      placeholder="Long answer text"
                      disabled
                      rows={2}
                      className="w-full max-w-md resize-none border-0 border-b border-gray-300 bg-transparent py-1 text-sm text-gray-400 outline-none"
                    />
                  )}
                  {(q.type === "multiple" || q.type === "checkbox") && (
                    <div className="space-y-2">
                      {q.options?.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-gray-500">
                            {q.type === "multiple" ? "○" : "☐"}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.id, i, e.target.value)}
                            className="flex-1 border-0 border-b border-transparent bg-transparent py-0 text-sm outline-none focus:border-indigo-500"
                          />
                          {q.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(q.id, i)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Add option
                      </button>
                    </div>
                  )}
                  {q.type === "dropdown" && (
                    <div className="space-y-2">
                      {q.options?.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-gray-500">{i + 1}.</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.id, i, e.target.value)}
                            className="flex-1 border-0 border-b border-transparent bg-transparent py-0 text-sm outline-none focus:border-indigo-500"
                          />
                          {q.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(q.id, i)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Add option
                      </button>
                    </div>
                  )}
                  {(q.type === "email" || q.type === "phone" || q.type === "date") && (
                    <input
                      type={q.type === "date" ? "date" : "text"}
                      placeholder={q.type === "email" ? "Email" : q.type === "phone" ? "Phone" : ""}
                      disabled
                      className="w-full max-w-md border-0 border-b border-gray-300 bg-transparent py-1 text-sm text-gray-400 outline-none"
                    />
                  )}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Required
                </label>
                {q.type === "phone" && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={!!q.phoneVerifyRequired}
                      onChange={(e) => updateQuestion(q.id, { phoneVerifyRequired: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Require WhatsApp OTP verification
                  </label>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveQuestion(q.id, "up")}
                  disabled={index === 0}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(q.id, "down")}
                  disabled={index === questions.length - 1}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => duplicateQuestion(q.id)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Duplicate"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="rounded p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50"
                  aria-label="Delete"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="relative mt-6">
          <button
            type="button"
            onClick={() => setShowAddMenu((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-6 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add question
          </button>
          {showAddMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAddMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
                {FIELD_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => addQuestion(t.value)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className="w-6 text-center text-gray-500">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
