"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db, firestoreHelpers } from "../../../lib/firebase";
import { qrCodeImageUrl } from "@/lib/interviewExamPapers";

function registerFormPublicUrl(formId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/register?formId=${encodeURIComponent(formId)}`;
}

function safeFileName(title) {
  const base = String(title || "register-form")
    .trim()
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "register-form"}-qr.png`;
}

export default function RegisterFormListPage() {
  const router = useRouter();
  const qrImgRef = useRef(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [qrForm, setQrForm] = useState(null);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = firestoreHelpers.doc(db, "users", u.uid);
        const snap = await firestoreHelpers.getDoc(ref);
        const userRole = snap.exists() ? snap.data().role : null;
        setIsSuperAdmin(userRole === "superadmin");
        setIsAdmin(userRole === "admin" || userRole === "superadmin");
      } else {
        setIsSuperAdmin(false);
        setIsAdmin(false);
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

  async function handleDownloadQr() {
    if (!qrForm) return;
    const publicUrl = registerFormPublicUrl(qrForm.id);
    const filename = safeFileName(qrForm.title);
    setQrDownloading(true);
    try {
      const img = qrImgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          URL.revokeObjectURL(a.href);
          return;
        }
      }
      const res = await fetch(qrCodeImageUrl(publicUrl, 512));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error(err);
      window.open(qrCodeImageUrl(publicUrl, 512), "_blank", "noopener,noreferrer");
    } finally {
      setQrDownloading(false);
    }
  }

  async function handleCopyLink() {
    if (!qrForm) return;
    try {
      await navigator.clipboard.writeText(registerFormPublicUrl(qrForm.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      alert("Could not copy the link. Copy it from the text box instead.");
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
                      {form.isFeedback ? (
                        <span className="ml-2 inline-flex align-middle rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                          Feedback
                        </span>
                      ) : null}
                    </h2>
                    {form.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{form.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-gray-400">
                      Created {formatDate(form.createdAt)} · {(form.questions || []).length} question(s)
                      {form.isFeedback ? " · Superadmin submissions only" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/Admin/register-form/edit/${form.id}`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setCopied(false);
                        setQrForm(form);
                      }}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      QR code
                    </button>
                    <a
                      href={`/register?formId=${encodeURIComponent(form.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Open form
                    </a>
                    {(!form.isFeedback || isSuperAdmin) && (
                      <Link
                        href={`/Admin/register-form/${form.id}/responses`}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Submissions
                      </Link>
                    )}
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

      {qrForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Form QR code</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Scan to open <span className="font-medium text-gray-700">{qrForm.title || "Untitled form"}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrForm(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 flex justify-center rounded-xl border border-gray-100 bg-gray-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={qrImgRef}
                src={qrCodeImageUrl(registerFormPublicUrl(qrForm.id), 280)}
                alt={`QR code for ${qrForm.title || "registration form"}`}
                width={280}
                height={280}
                crossOrigin="anonymous"
                className="rounded-lg bg-white"
              />
            </div>

            <label className="mt-4 block text-xs font-medium text-gray-600">Public link</label>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={registerFormPublicUrl(qrForm.id)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setQrForm(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={qrDownloading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {qrDownloading ? "Downloading…" : "Download QR"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
