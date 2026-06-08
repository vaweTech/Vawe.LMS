"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db, firestoreHelpers } from "../../../lib/firebase";

export default function RegisterFormListPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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
    if (!user || !isAdmin) return;
    (async () => {
      setFormsLoading(true);
      try {
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "registerForms")
        );
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        list.sort((a, b) => {
          const ta = a.createdAt || "";
          const tb = b.createdAt || "";
          return tb.localeCompare(ta);
        });
        setForms(list);
      } catch (err) {
        console.error(err);
      } finally {
        setFormsLoading(false);
      }
    })();
  }, [user, isAdmin]);

  function logout() {
    signOut(auth);
  }

  async function handleDelete(formId, formTitle) {
    if (!confirm(`Delete form "${formTitle || "Untitled form"}"? This cannot be undone.`)) return;
    setDeletingId(formId);
    try {
      const docRef = firestoreHelpers.doc(db, "registerForms", formId);
      await firestoreHelpers.deleteDoc(docRef);
      setForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete form: " + (err?.message || err));
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user || !isAdmin) return <div className="p-8">Access Denied</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/Admin")}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700">Register Forms</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/Admin/register-form/create"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create form
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

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">All registration forms</h1>
        </div>

        {formsLoading ? (
          <p className="text-gray-500">Loading forms...</p>
        ) : forms.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500">No forms yet.</p>
            <Link
              href="/Admin/register-form/create"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Create your first form
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {forms.map((form) => (
              <li
                key={form.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium text-gray-900">
                      {form.title || "Untitled form"}
                    </h2>
                    {form.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{form.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-gray-400">
                      Created {formatDate(form.createdAt)} · {(form.questions || []).length} question(s)
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/Admin/register-form/edit/${form.id}`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <a
                      href={`/register?formId=${encodeURIComponent(form.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Open form
                    </a>
                    <Link
                      href={`/Admin/register-form/${form.id}/responses`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Submissions
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(form.id, form.title)}
                      disabled={deletingId === form.id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === form.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
