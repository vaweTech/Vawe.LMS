"use client";

import { useState, useCallback, useEffect } from "react";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

const ROOT_DOMAIN = "skillwins.in";
const COLLEGE_HOSTS_COLLECTION = "collegeHosts";

function normalizeSubdomain(raw) {
    return raw
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function SuperAdminPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSubdomain, setEditingSubdomain] = useState("");
    const [name, setName] = useState("");
    const [subdomain, setSubdomain] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [moduleLms, setModuleLms] = useState(true);
    const [moduleCrt, setModuleCrt] = useState(true);
    const [studentLimit, setStudentLimit] = useState("");
    const [crtStudentLimit, setCrtStudentLimit] = useState("");
    const [colleges, setColleges] = useState([]);
    const [saveError, setSaveError] = useState("");
    const [createInfo, setCreateInfo] = useState("");
    const [saving, setSaving] = useState(false);
    const [rowActionLoading, setRowActionLoading] = useState({});

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setEditingSubdomain("");
        setName("");
        setSubdomain("");
        setEmail("");
        setPassword("");
        setModuleLms(true);
        setModuleCrt(true);
        setStudentLimit("");
        setCrtStudentLimit("");
        setSaveError("");
    }, []);

    useEffect(() => {
        if (!isFirebaseConfigured || !db) return undefined;
        const colRef = collection(db, COLLEGE_HOSTS_COLLECTION);
        const unsub = onSnapshot(
            colRef,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                rows.sort((a, b) => {
                    const ta = a.createdAt?.toMillis?.() ?? 0;
                    const tb = b.createdAt?.toMillis?.() ?? 0;
                    return tb - ta;
                });
                setColleges(rows);
            },
            (err) => {
                console.error("collegeHosts listener:", err);
                setSaveError(err.message || "Could not load college list.");
            }
        );
        return () => unsub();
    }, []);

    const previewHost = subdomain
        ? `${subdomain}.${ROOT_DOMAIN}`
        : `your-college.${ROOT_DOMAIN}`;

    const handleCreate = async () => {
        const host = subdomain ? `${subdomain}.${ROOT_DOMAIN}` : "";
        if (!name.trim() || !host || !email.trim()) return;
        if (!moduleLms && !moduleCrt) {
            setSaveError("Select at least one module: LMS and/or CRT.");
            return;
        }
        if (!isFirebaseConfigured || !db) {
            setSaveError("Firebase is not configured; data cannot be saved.");
            return;
        }
        const user = auth?.currentUser;
        if (!user) {
            setSaveError("You must be signed in as an admin.");
            return;
        }
        setSaveError("");
        setCreateInfo("");
        setSaving(true);
        try {
            const token = await user.getIdToken(true);
            const editing = !!editingSubdomain;
            const res = await fetch("/api/create-college-admin", {
                method: editing ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: name.trim(),
                    subdomain: editingSubdomain || subdomain, 
                    email: email.trim().toLowerCase(),
                    password: password.trim() || undefined,
                    moduleLms,
                    moduleCrt,
                    studentLimit:
                        studentLimit === "" ? undefined : Math.max(0, Number.parseInt(studentLimit, 10) || 0),
                    crtStudentLimit:
                        crtStudentLimit === ""
                            ? undefined
                            : Math.max(0, Number.parseInt(crtStudentLimit, 10) || 0),
                    host,
                    rootDomain: ROOT_DOMAIN,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSaveError(data?.error || `Request failed (${res.status})`);
                return;
            }
            let msg = editing ? "College admin updated." : "College admin account created.";
            if (!editing && data.defaultPasswordUsed && data.initialPassword) {
                msg += ` Initial password: ${data.initialPassword} (share securely; user should change it).`;
            }
            setCreateInfo(msg);
            closeModal();
        } catch (e) {
            console.error(e);
            setSaveError(e?.message || "Failed to create college admin.");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (row) => {
        setEditingSubdomain(row.subdomain || row.id || "");
        setName(row.name || "");
        setSubdomain(row.subdomain || row.id || "");
        setEmail(row.collegeAdminEmail || "");
        setPassword("");
        setModuleLms(!!row.moduleLms);
        setModuleCrt(!!row.moduleCrt);
        setStudentLimit(
            row.studentLimit === undefined || row.studentLimit === null ? "" : String(row.studentLimit)
        );
        setCrtStudentLimit(
            row.crtStudentLimit === undefined || row.crtStudentLimit === null
                ? ""
                : String(row.crtStudentLimit)
        );
        setSaveError("");
        setCreateInfo("");
        setModalOpen(true);
    };

    const handleLockToggle = async (row) => {
        const sub = row.subdomain || row.id;
        if (!sub) return;
        const isLocked = row.status === "locked" || row.locked === true;
        const confirmText = isLocked
            ? "Do you want to unlock this college admin?"
            : "Do you want to lock this college admin?";
        if (!window.confirm(confirmText)) return;

        const user = auth?.currentUser;
        if (!user) {
            setSaveError("You must be signed in as an admin.");
            return;
        }
        setSaveError("");
        setCreateInfo("");
        setRowActionLoading((prev) => ({ ...prev, [sub]: true }));
        try {
            const token = await user.getIdToken(true);
            const res = await fetch("/api/create-college-admin", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    subdomain: sub,
                    locked: !isLocked,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSaveError(data?.error || `Request failed (${res.status})`);
                return;
            }
            setCreateInfo(!isLocked ? "College admin locked." : "College admin unlocked.");
        } catch (e) {
            console.error(e);
            setSaveError(e?.message || "Failed to update lock state.");
        } finally {
            setRowActionLoading((prev) => ({ ...prev, [sub]: false }));
        }
    };

    const handleDeleteCollege = async (row) => {
        const sub = row.subdomain || row.id;
        if (!sub) return;
        const label = row.name || sub;
        if (
            !window.confirm(
                `Delete "${label}" college admin? This removes login access and college host mapping permanently.`
            )
        ) {
            return;
        }
        const user = auth?.currentUser;
        if (!user) {
            setSaveError("You must be signed in as an admin.");
            return;
        }
        setSaveError("");
        setCreateInfo("");
        setRowActionLoading((prev) => ({ ...prev, [sub]: true }));
        try {
            const token = await user.getIdToken(true);
            const res = await fetch("/api/create-college-admin", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    subdomain: sub,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSaveError(data?.error || `Request failed (${res.status})`);
                return;
            }
            setCreateInfo("College deleted successfully.");
        } catch (e) {
            console.error(e);
            setSaveError(e?.message || "Failed to delete college.");
        } finally {
            setRowActionLoading((prev) => ({ ...prev, [sub]: false }));
        }
    };

    return (
        <div>
            <CheckAdminAuth>
                <h1 className="text-2xl font-bold text-center">Super Admin Page</h1>
                <p className="text-gray-600 text-center">This is the super admin page</p>
                {createInfo ? (
                    <p className="mx-auto mt-4 max-w-lg rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900">
                        {createInfo}
                    </p>
                ) : null}
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            closeModal();
                            setModalOpen(true);
                        }}
                        className="bg-blue-500 text-white px-4 py-2 w-52 mx-auto rounded-md hover:bg-blue-600 cursor-pointer"
                    >
                        Create College Admin
                    </button>
                    {modalOpen && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                            onClick={closeModal}
                            role="presentation"
                        >
                            <div
                                className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="create-college-admin-title"
                            >
                                <div className="mb-4 flex items-center justify-between">
                                    <h2
                                        id="create-college-admin-title"
                                        className="text-lg font-semibold"
                                    >
                                        {editingSubdomain ? "Edit College Admin" : "Create College Admin"}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="text-gray-600 hover:text-gray-800"
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <form
                                    className="flex flex-col gap-4"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleCreate();
                                    }}
                                >
                                    {saveError ? (
                                        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                            {saveError}
                                        </p>
                                    ) : null}
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="college-name" className="text-sm font-medium text-gray-800">
                                            College name
                                        </label>
                                        <input
                                            id="college-name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. C R Reddy College"
                                            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            autoComplete="organization"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="college-admin-email" className="text-sm font-medium text-gray-800">
                                            College admin email (login)
                                        </label>
                                        <input
                                            id="college-admin-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value.trim())}
                                            placeholder="principal@college.edu"
                                            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            autoComplete="email"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="college-admin-password" className="text-sm font-medium text-gray-800">
                                            Password (optional)
                                        </label>
                                        <input
                                            id="college-admin-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={editingSubdomain ? "Leave blank to keep current password" : "Leave blank to use generated default"}
                                            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            autoComplete="new-password"
                                        />
                                        <p className="text-xs text-gray-500">
                                            {editingSubdomain
                                                ? "If empty, existing password remains unchanged."
                                                : "If empty, a default password is set and shown once after creation."}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="college-subdomain" className="text-sm font-medium text-gray-800">
                                            Subdomain
                                        </label>
                                        <p className="text-xs text-gray-500">
                                            Your site will use this host on{" "}
                                            <span className="font-medium text-gray-700">{ROOT_DOMAIN}</span> (example:{" "}
                                            <span className="font-mono text-gray-800">crreddy.{ROOT_DOMAIN}</span>).
                                        </p>
                                        <div className="flex min-h-[42px] items-stretch overflow-hidden rounded border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                                            <input
                                                id="college-subdomain"
                                                type="text"
                                                inputMode="text"
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                                spellCheck={false}
                                                value={subdomain}
                                                onChange={(e) =>
                                                    setSubdomain(normalizeSubdomain(e.target.value))
                                                }
                                                placeholder="crreddy"
                                                disabled={!!editingSubdomain}
                                                className="min-w-0 flex-1 border-0 px-3 py-2 outline-none font-mono text-sm"
                                                autoComplete="off"
                                            />
                                            <span className="flex shrink-0 items-center border-l border-gray-200 bg-gray-50 px-3 font-mono text-sm text-gray-600">
                                                .{ROOT_DOMAIN}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600">
                                            Full URL:{" "}
                                            <span className="font-mono font-medium text-gray-900">{previewHost}</span>
                                        </p>
                                    </div>
                                    <fieldset className="rounded border border-gray-200 px-3 py-3">
                                        <legend className="px-1 text-sm font-medium text-gray-800">
                                            Modules (permissions)
                                        </legend>
                                        <p className="mb-2 text-xs text-gray-500">
                                            LMS: shows LMS admin tools (content, users, programs, internships, etc.). CRT: shows CRT manager pages only. If both are selected, both LMS and CRT sections are shown.
                                        </p>
                                        <label className="flex cursor-pointer items-center gap-2 py-1">
                                            <input
                                                type="checkbox"
                                                checked={moduleLms}
                                                onChange={(e) => setModuleLms(e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className="text-sm text-gray-800">LMS</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 py-1">
                                            <input
                                                type="checkbox"
                                                checked={moduleCrt}
                                                onChange={(e) => setModuleCrt(e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <span className="text-sm text-gray-800">CRT</span>
                                        </label>
                                    </fieldset>
                                    <fieldset className="rounded border border-gray-200 px-3 py-3">
                                        <legend className="px-1 text-sm font-medium text-gray-800">
                                            Student limits (optional)
                                        </legend>
                                        <p className="mb-2 text-xs text-gray-500">
                                            Set max students allowed for this college. Leave blank for no limit.
                                        </p>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="student-limit" className="text-sm font-medium text-gray-800">
                                                    Student role limit
                                                </label>
                                                <input
                                                    id="student-limit"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={studentLimit}
                                                    onChange={(e) => setStudentLimit(e.target.value)}
                                                    placeholder="e.g. 500"
                                                    className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label htmlFor="crt-student-limit" className="text-sm font-medium text-gray-800">
                                                    CRT Student role limit
                                                </label>
                                                <input
                                                    id="crt-student-limit"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={crtStudentLimit}
                                                    onChange={(e) => setCrtStudentLimit(e.target.value)}
                                                    placeholder="e.g. 300"
                                                    className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </fieldset>
                                    <button
                                        type="submit"
                                        disabled={
                                            !name.trim() ||
                                            !(editingSubdomain || subdomain) ||
                                            !email.trim() ||
                                            saving ||
                                            (!moduleLms && !moduleCrt)
                                        }
                                        className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {saving ? "Saving…" : editingSubdomain ? "Update" : "Create"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>

                <section className="mx-auto mt-10 max-w-4xl px-2">
                    <h2 className="mb-3 text-lg font-semibold text-gray-900">Registered colleges</h2>
                    {!isFirebaseConfigured || !db ? (
                        <p className="text-sm text-amber-800">Firebase is not configured, so the list cannot load.</p>
                    ) : colleges.length === 0 ? (
                        <p className="text-sm text-gray-500">No colleges yet. Create one using the button above.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[480px] text-left text-sm">
                                <thead className="bg-gray-50 text-gray-700">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Name</th>
                                        <th className="px-3 py-2 font-medium">Host</th>
                                        <th className="px-3 py-2 font-medium">Admin email</th>
                                        <th className="px-3 py-2 font-medium">LMS</th>
                                        <th className="px-3 py-2 font-medium">CRT</th>
                                        <th className="px-3 py-2 font-medium">Student limit</th>
                                        <th className="px-3 py-2 font-medium">CRT limit</th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                        <th className="px-3 py-2 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {colleges.map((row) => {
                                        const rowKey = row.subdomain || row.id;
                                        const rowBusy = !!rowActionLoading[rowKey];
                                        const isLocked = row.status === "locked" || row.locked === true;
                                        return (
                                        <tr key={row.id} className="border-t border-gray-100">
                                            <td className="px-3 py-2">{row.name}</td>
                                            <td className="px-3 py-2 font-mono text-gray-800">{row.host || row.id}</td>
                                            <td className="px-3 py-2 text-gray-700">{row.collegeAdminEmail || "—"}</td>
                                            <td className="px-3 py-2">{row.moduleLms ? "Yes" : "—"}</td>
                                            <td className="px-3 py-2">{row.moduleCrt ? "Yes" : "—"}</td>
                                            <td className="px-3 py-2">{row.studentLimit ?? "—"}</td>
                                            <td className="px-3 py-2">{row.crtStudentLimit ?? "—"}</td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                        isLocked
                                                            ? "bg-red-100 text-red-700"
                                                            : "bg-emerald-100 text-emerald-700"
                                                    }`}
                                                >
                                                    {isLocked ? "Locked" : "Active"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(row)}
                                                        disabled={rowBusy}
                                                        className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLockToggle(row)}
                                                        disabled={rowBusy}
                                                        className={`rounded px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                                                            isLocked
                                                                ? "bg-emerald-600 hover:bg-emerald-700"
                                                                : "bg-amber-600 hover:bg-amber-700"
                                                        }`}
                                                    >
                                                        {rowBusy ? "Please wait..." : isLocked ? "Unlock" : "Lock"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCollege(row)}
                                                        disabled={rowBusy}
                                                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </CheckAdminAuth>
        </div>
    );
}
export default SuperAdminPage;
