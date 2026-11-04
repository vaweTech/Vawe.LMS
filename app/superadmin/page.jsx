"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
    Building2,
    CheckCircle2,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    Lock,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    Unlock,
    Users,
    X,
    AlertTriangle,
    GraduationCap,
    Briefcase,
} from "lucide-react";

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
    const [listLoaded, setListLoaded] = useState(false);
    const [pageError, setPageError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [moduleFilter, setModuleFilter] = useState("all");
    const [showPassword, setShowPassword] = useState(false);
    const [copiedKey, setCopiedKey] = useState("");
    const [initialPassword, setInitialPassword] = useState("");

    const stats = useMemo(() => {
        const locked = colleges.filter((c) => c.status === "locked" || c.locked === true).length;
        return {
            total: colleges.length,
            active: colleges.length - locked,
            locked,
            lms: colleges.filter((c) => c.moduleLms).length,
            crt: colleges.filter((c) => c.moduleCrt).length,
        };
    }, [colleges]);

    const visibleColleges = useMemo(() => {
        const q = query.trim().toLowerCase();
        return colleges.filter((c) => {
            const isLocked = c.status === "locked" || c.locked === true;
            if (statusFilter === "active" && isLocked) return false;
            if (statusFilter === "locked" && !isLocked) return false;
            if (moduleFilter === "lms" && !c.moduleLms) return false;
            if (moduleFilter === "crt" && !c.moduleCrt) return false;
            if (moduleFilter === "both" && !(c.moduleLms && c.moduleCrt)) return false;
            if (!q) return true;
            return [c.name, c.subdomain, c.id, c.host, c.collegeAdminEmail]
                .some((v) => String(v || "").toLowerCase().includes(q));
        });
    }, [colleges, query, statusFilter, moduleFilter]);

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
        setShowPassword(false);
    }, []);

    useEffect(() => {
        if (!modalOpen) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape" && !saving) closeModal();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modalOpen, saving, closeModal]);

    const copyText = async (text, key) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 1500);
        } catch (_) {
            window.prompt("Copy this:", text);
        }
    };

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
                setListLoaded(true);
            },
            (err) => {
                console.error("collegeHosts listener:", err);
                setPageError(err.message || "Could not load college list.");
                setListLoaded(true);
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
            setCreateInfo(
                editing
                    ? `${name.trim()} updated.`
                    : `${name.trim()} created. Its admin signs in at ${data.host || host} with ${email.trim().toLowerCase()}.`
            );
            setInitialPassword(!editing && data.defaultPasswordUsed && data.initialPassword ? data.initialPassword : "");
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
        setInitialPassword("");
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
            setPageError("You must be signed in as an admin.");
            return;
        }
        setPageError("");
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
                setPageError(data?.error || `Request failed (${res.status})`);
                return;
            }
            setCreateInfo(!isLocked ? `${row.name || sub} locked — its admin can no longer sign in.` : `${row.name || sub} unlocked.`);
        } catch (e) {
            console.error(e);
            setPageError(e?.message || "Failed to update lock state.");
        } finally {
            setRowActionLoading((prev) => ({ ...prev, [sub]: false }));
        }
    };

    const handleDeleteCollege = async (row) => {
        const sub = row.subdomain || row.id;
        if (!sub) return;
        const label = row.name || sub;
        const typed = window.prompt(
            `Delete "${label}"? This permanently removes the college admin login and the ${sub}.${ROOT_DOMAIN} mapping.\n\nType "${sub}" to confirm:`
        );
        if (typed === null) return;
        if (typed.trim().toLowerCase() !== sub) {
            setPageError(`Delete cancelled — the subdomain you typed did not match "${sub}".`);
            return;
        }
        const user = auth?.currentUser;
        if (!user) {
            setPageError("You must be signed in as an admin.");
            return;
        }
        setPageError("");
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
                setPageError(data?.error || `Request failed (${res.status})`);
                return;
            }
            setCreateInfo(`${label} deleted.`);
        } catch (e) {
            console.error(e);
            setPageError(e?.message || "Failed to delete college.");
        } finally {
            setRowActionLoading((prev) => ({ ...prev, [sub]: false }));
        }
    };

    const openCreate = () => {
        closeModal();
        setCreateInfo("");
        setInitialPassword("");
        setModalOpen(true);
    };

    const inputCls =
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500";

    const canSubmit =
        !!name.trim() && !!(editingSubdomain || subdomain) && !!email.trim() && !saving && (moduleLms || moduleCrt);

    return (
        <CheckAdminAuth>
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    {/* Header */}
                    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Super Admin</h1>
                                <p className="text-sm text-slate-500">
                                    Create and manage college logins on <span className="font-medium text-slate-700">{ROOT_DOMAIN}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create college
                        </button>
                    </header>

                    {/* Feedback */}
                    {createInfo ? (
                        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                            <div className="min-w-0 flex-1">
                                <p>{createInfo}</p>
                                {initialPassword ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="text-emerald-800">Initial password:</span>
                                        <code className="rounded bg-white px-2 py-0.5 font-mono text-emerald-900 ring-1 ring-emerald-200">
                                            {initialPassword}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={() => copyText(initialPassword, "initial-password")}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            {copiedKey === "initial-password" ? "Copied" : "Copy"}
                                        </button>
                                        <span className="text-xs text-emerald-700">Share it securely and ask the admin to change it.</span>
                                    </div>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCreateInfo("");
                                    setInitialPassword("");
                                }}
                                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : null}
                    {pageError ? (
                        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            <p className="flex-1">{pageError}</p>
                            <button
                                type="button"
                                onClick={() => setPageError("")}
                                className="rounded p-1 text-red-700 hover:bg-red-100"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : null}

                    {/* Stats */}
                    <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <StatCard icon={Building2} label="Colleges" value={stats.total} tone="blue" />
                        <StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="emerald" />
                        <StatCard icon={Lock} label="Locked" value={stats.locked} tone="red" />
                        <StatCard icon={GraduationCap} label="With LMS" value={stats.lms} tone="indigo" />
                        <StatCard icon={Briefcase} label="With CRT" value={stats.crt} tone="amber" />
                    </section>

                    {/* List */}
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
                            <h2 className="text-base font-semibold text-slate-900 lg:mr-auto">
                                Registered colleges
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                    {visibleColleges.length}
                                    {visibleColleges.length !== colleges.length ? ` of ${colleges.length}` : ""}
                                </span>
                            </h2>
                            <div className="relative lg:w-72">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name, subdomain or email…"
                                    className={`${inputCls} pl-9`}
                                    aria-label="Search colleges"
                                />
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className={`${inputCls} lg:w-36`}
                                    aria-label="Filter by status"
                                >
                                    <option value="all">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="locked">Locked</option>
                                </select>
                                <select
                                    value={moduleFilter}
                                    onChange={(e) => setModuleFilter(e.target.value)}
                                    className={`${inputCls} lg:w-36`}
                                    aria-label="Filter by module"
                                >
                                    <option value="all">All modules</option>
                                    <option value="lms">LMS</option>
                                    <option value="crt">CRT</option>
                                    <option value="both">LMS + CRT</option>
                                </select>
                            </div>
                        </div>

                        {!isFirebaseConfigured || !db ? (
                            <EmptyState
                                icon={AlertTriangle}
                                title="Firebase is not configured"
                                text="The college list cannot load until Firebase is configured."
                            />
                        ) : !listLoaded ? (
                            <div className="space-y-3 p-4" aria-busy="true">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                                ))}
                            </div>
                        ) : colleges.length === 0 ? (
                            <EmptyState
                                icon={Building2}
                                title="No colleges yet"
                                text="Create the first college login to give a college its own LMS / CRT portal."
                                action={
                                    <button
                                        type="button"
                                        onClick={openCreate}
                                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create college
                                    </button>
                                }
                            />
                        ) : visibleColleges.length === 0 ? (
                            <EmptyState icon={Search} title="No matches" text="No colleges match your search or filters." />
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {visibleColleges.map((row) => {
                                    const rowKey = row.subdomain || row.id;
                                    const rowBusy = !!rowActionLoading[rowKey];
                                    const isLocked = row.status === "locked" || row.locked === true;
                                    const host = row.host || `${rowKey}.${ROOT_DOMAIN}`;
                                    return (
                                        <li
                                            key={row.id}
                                            className={`flex flex-col gap-4 p-4 transition hover:bg-slate-50/70 lg:flex-row lg:items-center ${
                                                isLocked ? "bg-red-50/30" : ""
                                            }`}
                                        >
                                            {/* Identity */}
                                            <div className="flex min-w-0 items-center gap-3 lg:w-[34%]">
                                                <div
                                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
                                                        isLocked ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-700"
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    {(row.name || rowKey || "?").trim().charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate font-semibold text-slate-900">{row.name || rowKey}</p>
                                                        <span
                                                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                                isLocked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                                                            }`}
                                                        >
                                                            <span className={`h-1.5 w-1.5 rounded-full ${isLocked ? "bg-red-500" : "bg-emerald-500"}`} />
                                                            {isLocked ? "Locked" : "Active"}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1 text-sm">
                                                        <a
                                                            href={`https://${host}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-blue-600 hover:underline"
                                                        >
                                                            <span className="truncate">{host}</span>
                                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyText(`https://${host}`, `host-${rowKey}`)}
                                                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                            title="Copy URL"
                                                            aria-label={`Copy ${host}`}
                                                        >
                                                            {copiedKey === `host-${rowKey}` ? (
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Admin */}
                                            <div className="min-w-0 lg:w-[24%]">
                                                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Admin login</p>
                                                <p className="truncate text-sm text-slate-700" title={row.collegeAdminEmail}>
                                                    {row.collegeAdminEmail || "—"}
                                                </p>
                                            </div>

                                            {/* Modules & limits */}
                                            <div className="flex flex-wrap items-center gap-2 lg:w-[24%]">
                                                {row.moduleLms ? (
                                                    <ModuleChip label="LMS" limit={row.studentLimit} tone="indigo" />
                                                ) : null}
                                                {row.moduleCrt ? (
                                                    <ModuleChip label="CRT" limit={row.crtStudentLimit} tone="amber" />
                                                ) : null}
                                                {!row.moduleLms && !row.moduleCrt ? (
                                                    <span className="text-xs text-slate-400">No modules</span>
                                                ) : null}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1.5 lg:ml-auto">
                                                <IconButton onClick={() => handleEdit(row)} disabled={rowBusy} label="Edit" icon={Pencil} />
                                                <IconButton
                                                    onClick={() => handleLockToggle(row)}
                                                    disabled={rowBusy}
                                                    label={rowBusy ? "Working…" : isLocked ? "Unlock" : "Lock"}
                                                    icon={isLocked ? Unlock : Lock}
                                                    tone={isLocked ? "emerald" : "amber"}
                                                />
                                                <IconButton
                                                    onClick={() => handleDeleteCollege(row)}
                                                    disabled={rowBusy}
                                                    label="Delete"
                                                    icon={Trash2}
                                                    tone="red"
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>

            {/* Create / edit modal */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                    onClick={() => !saving && closeModal()}
                    role="presentation"
                >
                    <div
                        className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-college-admin-title"
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h2 id="create-college-admin-title" className="text-lg font-semibold text-slate-900">
                                    {editingSubdomain ? "Edit college" : "Create college"}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {editingSubdomain
                                        ? "Update the college details, modules and admin login."
                                        : "Sets up the college portal and its admin login."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form
                            className="flex min-h-0 flex-1 flex-col"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleCreate();
                            }}
                        >
                            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                                {saveError ? (
                                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        {saveError}
                                    </div>
                                ) : null}

                                <FormSection title="College" step={1}>
                                    <Field label="College name" htmlFor="college-name">
                                        <input
                                            id="college-name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. C R Reddy College"
                                            className={inputCls}
                                            autoComplete="organization"
                                            autoFocus
                                        />
                                    </Field>
                                    <Field
                                        label="Subdomain"
                                        htmlFor="college-subdomain"
                                        hint={editingSubdomain ? "The subdomain can't be changed after creation." : "Lowercase letters, numbers and hyphens only."}
                                    >
                                        <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                                            <input
                                                id="college-subdomain"
                                                type="text"
                                                inputMode="text"
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                                spellCheck={false}
                                                value={subdomain}
                                                onChange={(e) => setSubdomain(normalizeSubdomain(e.target.value))}
                                                placeholder="crreddy"
                                                disabled={!!editingSubdomain}
                                                className="min-w-0 flex-1 border-0 px-3 py-2.5 font-mono text-sm outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                                autoComplete="off"
                                            />
                                            <span className="flex shrink-0 items-center border-l border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-500">
                                                .{ROOT_DOMAIN}
                                            </span>
                                        </div>
                                        <p className="mt-1.5 text-xs text-slate-500">
                                            Portal URL: <span className="font-mono font-medium text-slate-800">{previewHost}</span>
                                        </p>
                                    </Field>
                                </FormSection>

                                <FormSection title="Admin login" step={2}>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field label="Admin email" htmlFor="college-admin-email">
                                            <input
                                                id="college-admin-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value.trim())}
                                                placeholder="principal@college.edu"
                                                className={inputCls}
                                                autoComplete="email"
                                            />
                                        </Field>
                                        <Field
                                            label="Password (optional)"
                                            htmlFor="college-admin-password"
                                            hint={
                                                editingSubdomain
                                                    ? "Leave empty to keep the current password."
                                                    : "Leave empty to use the default; it's shown once after creation."
                                            }
                                        >
                                            <div className="relative">
                                                <input
                                                    id="college-admin-password"
                                                    type={showPassword ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder={editingSubdomain ? "Unchanged" : "Default password"}
                                                    className={`${inputCls} pr-10`}
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((v) => !v)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </Field>
                                    </div>
                                </FormSection>

                                <FormSection title="Modules & limits" step={3}>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <ModuleToggle
                                            checked={moduleLms}
                                            onChange={setModuleLms}
                                            icon={GraduationCap}
                                            title="LMS"
                                            text="Content, users, programs, internships and other LMS admin tools."
                                            limitId="student-limit"
                                            limitLabel="Student limit"
                                            limit={studentLimit}
                                            onLimitChange={setStudentLimit}
                                            placeholder="e.g. 500"
                                        />
                                        <ModuleToggle
                                            checked={moduleCrt}
                                            onChange={setModuleCrt}
                                            icon={Briefcase}
                                            title="CRT"
                                            text="CRT manager pages: programs, tests, placements."
                                            limitId="crt-student-limit"
                                            limitLabel="CRT student limit"
                                            limit={crtStudentLimit}
                                            onLimitChange={setCrtStudentLimit}
                                            placeholder="e.g. 300"
                                        />
                                    </div>
                                    {!moduleLms && !moduleCrt ? (
                                        <p className="mt-2 text-xs font-medium text-red-600">Select at least one module.</p>
                                    ) : (
                                        <p className="mt-2 text-xs text-slate-500">Leave a limit empty for no limit.</p>
                                    )}
                                </FormSection>
                            </div>

                            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={saving}
                                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                    ) : null}
                                    {saving ? "Saving…" : editingSubdomain ? "Save changes" : "Create college"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </CheckAdminAuth>
    );
}

const TONES = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    indigo: "bg-indigo-100 text-indigo-700",
    amber: "bg-amber-100 text-amber-800",
};

function StatCard({ icon: Icon, label, value, tone }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONES[tone]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
            </div>
        </div>
    );
}

function ModuleChip({ label, limit, tone }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
            {label}
            <span className="inline-flex items-center gap-0.5 font-normal opacity-80">
                <Users className="h-3 w-3" />
                {limit === undefined || limit === null || limit === "" ? "No limit" : limit}
            </span>
        </span>
    );
}

function IconButton({ onClick, disabled, label, icon: Icon, tone = "slate" }) {
    const tones = {
        slate: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        amber: "text-amber-700 hover:bg-amber-50",
        emerald: "text-emerald-700 hover:bg-emerald-50",
        red: "text-red-600 hover:bg-red-50",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}

function EmptyState({ icon: Icon, title, text, action }) {
    return (
        <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Icon className="h-6 w-6" />
            </div>
            <p className="mt-3 font-semibold text-slate-800">{title}</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
            {action}
        </div>
    );
}

function FormSection({ title, step, children }) {
    return (
        <section>
            <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {step}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function Field({ label, htmlFor, hint, children }) {
    return (
        <div>
            <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
            </label>
            {children}
            {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
    );
}

function ModuleToggle({ checked, onChange, icon: Icon, title, text, limitId, limitLabel, limit, onLimitChange, placeholder }) {
    return (
        <div
            className={`rounded-xl border-2 p-4 transition ${
                checked ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-white"
            }`}
        >
            <label className="flex cursor-pointer items-start gap-3">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Icon className="h-4 w-4 text-blue-600" />
                        {title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
                </span>
            </label>
            {checked ? (
                <div className="mt-3">
                    <label htmlFor={limitId} className="mb-1 block text-xs font-medium text-slate-600">
                        {limitLabel}
                    </label>
                    <input
                        id={limitId}
                        type="number"
                        min="0"
                        step="1"
                        value={limit}
                        onChange={(e) => onLimitChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
            ) : null}
        </div>
    );
}

export default SuperAdminPage;
