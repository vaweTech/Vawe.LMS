"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db, firestoreHelpers } from "../../../../lib/firebase";
import { useAdminAccess } from "../../AdminAccessContext";
import { makeAuthenticatedRequest, handleAuthError } from "@/lib/authUtils";
import Link from "next/link";
import { Layers, ArrowLeft } from "lucide-react";
import { crtPoCollectionSegments, crtPoDocSegments } from "@/lib/collegeTenantFirestore";
import { tenantSegments } from "@/lib/tenantPath";

const DEFAULT_PO_PASSWORD = "VawePO@2025";

export default function POManagementPage() {
  const router = useRouter();
  const { user, loading, hasCrtManagerAccess: isAdmin, collegeSubdomain } = useAdminAccess();
  const [showForm, setShowForm] = useState(false);
  const [savingPo, setSavingPo] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);
  const [pos, setPos] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [editingPo, setEditingPo] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    empId: "",
    email: "",
    department: "",
    mobile: "",
    notes: "",
  });
  const [deletingId, setDeletingId] = useState(null);
  const [poForm, setPoForm] = useState({
    name: "",
    empId: "",
    email: "",
    department: "",
    mobile: "",
    notes: "",
  });
  const [crtPrograms, setCrtPrograms] = useState([]);
  const [crtBatches, setCrtBatches] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedPoId, setSelectedPoId] = useState("");
  const [assigningPo, setAssigningPo] = useState(false);

  const fetchPos = useCallback(async () => {
    if (!db) return;
    setLoadingPos(true);
    try {
      const poCol = firestoreHelpers.collection(db, ...crtPoCollectionSegments(collegeSubdomain));
      const poSnap = await firestoreHelpers.getDocs(poCol);

      const allPos = poSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() || {}),
      }));

      allPos.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

      setPos(allPos);
      setSelectedPoId((prev) =>
        prev && allPos.some((po) => po.id === prev) ? prev : allPos[0]?.id || ""
      );
    } finally {
      setLoadingPos(false);
    }
  }, [collegeSubdomain]);

  const fetchCrtPrograms = useCallback(async () => {
    if (!db) return;
    try {
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crt"))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCrtPrograms(list);
      setSelectedProgramId((prev) =>
        prev && list.some((program) => program.id === prev) ? prev : list[0]?.id || ""
      );
    } catch (err) {
      console.error("Failed to load CRT programs", err);
    }
  }, [collegeSubdomain]);

  const fetchCrtBatches = useCallback(async (programId) => {
    if (!db || !programId) {
      setCrtBatches([]);
      setSelectedBatchId("");
      return;
    }
    try {
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          programId,
          "batches"
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCrtBatches(list);
      setSelectedBatchId((prev) =>
        prev && list.some((batch) => batch.id === prev) ? prev : list[0]?.id || ""
      );
    } catch (err) {
      console.error("Failed to load CRT batches", err);
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetchPos();
    fetchCrtPrograms();
  }, [user, isAdmin, collegeSubdomain, fetchPos, fetchCrtPrograms]);

  useEffect(() => {
    fetchCrtBatches(selectedProgramId);
  }, [selectedProgramId, fetchCrtBatches]);

  const filteredPos = pos.filter((po) => {
    const term = filterText.trim().toLowerCase();
    if (!term) return true;
    const emp = String(po.empId || "").toLowerCase();
    const email = String(po.email || "").toLowerCase();
    return emp.includes(term) || email.includes(term);
  });

  function startEditPo(po) {
    setEditingPo(po);
    setEditForm({
      name: po.name || "",
      empId: po.empId || "",
      email: po.email || "",
      department: po.department || "",
      mobile: po.mobile || "",
      notes: po.notes || "",
    });
  }

  function closeEditPo() {
    setEditingPo(null);
    setEditForm({
      name: "",
      empId: "",
      email: "",
      department: "",
      mobile: "",
      notes: "",
    });
  }

  async function handleUpdatePo(e) {
    e.preventDefault();
    if (!editingPo) return;
    try {
      setSavingPo(true);
      const centralPoRef = firestoreHelpers.doc(db, ...crtPoDocSegments(collegeSubdomain, editingPo.id));
      await firestoreHelpers.updateDoc(centralPoRef, {
        name: editForm.name.trim(),
        empId: editForm.empId.trim(),
        email: editForm.email.trim(),
        department: editForm.department.trim(),
        mobile: editForm.mobile.trim(),
        notes: editForm.notes.trim(),
      });
      closeEditPo();
      await fetchPos();
      alert("PO updated.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update PO");
    } finally {
      setSavingPo(false);
    }
  }

  async function handleDeletePo(po) {
    const confirmed = window.confirm(
      "Delete this PO and remove their login (Firebase Auth)? Batches that still reference this PO may need reassignment."
    );
    if (!confirmed) return;
    try {
      setDeletingId(po.id);
      const res = await makeAuthenticatedRequest("/api/delete-po-user", {
        method: "POST",
        body: JSON.stringify({
          poId: po.id,
          uid: po.userId || undefined,
          ...(collegeSubdomain ? { collegeSubdomain } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to delete PO (${res.status})`);
      }
      await fetchPos();
      if (selectedProgramId) {
        await fetchCrtBatches(selectedProgramId);
      }
      alert("PO and login account removed.");
    } catch (err) {
      console.error(err);
      const msg = err?.message || "Failed to delete PO";
      handleAuthError(err, () =>
        alert("Your session expired. Please log in again.")
      );
      if (!String(msg).toLowerCase().includes("expired")) {
        alert(msg);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmitPo(e) {
    e.preventDefault();
    if (!poForm.name.trim() || !poForm.empId.trim()) return;
    try {
      setSavingPo(true);
      let defaultPassword = null;

      const res = await fetch("/api/create-po-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: poForm.name.trim(),
          empId: poForm.empId.trim(),
          email: poForm.email.trim(),
          department: poForm.department.trim(),
          mobile: poForm.mobile.trim(),
          notes: poForm.notes.trim(),
          createdBy: user?.uid || null,
          ...(collegeSubdomain ? { collegeSubdomain } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create PO user");
      }
      defaultPassword = data?.defaultPassword || null;
      if (defaultPassword) {
        alert(`PO created. Default password: ${defaultPassword}`);
      }
      setPoForm({
        name: "",
        empId: "",
        email: "",
        department: "",
        mobile: "",
        notes: "",
      });
      setShowForm(false);
      await fetchPos();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create PO user");
    } finally {
      setSavingPo(false);
    }
  }

  async function handleAssignPoToBatch(e) {
    e.preventDefault();
    if (!selectedProgramId || !selectedBatchId || !selectedPoId) {
      alert("Select CRT program, batch and PO.");
      return;
    }

    const selectedPo = pos.find((po) => po.id === selectedPoId);
    if (!selectedPo) {
      alert("Selected PO not found.");
      return;
    }

    try {
      setAssigningPo(true);
      const batchRef = firestoreHelpers.doc(
        db,
        "crt",
        selectedProgramId,
        "batches",
        selectedBatchId
      );

      await firestoreHelpers.updateDoc(batchRef, {
        poId: selectedPo.id,
        poEmpId: selectedPo.empId || "",
        poName: selectedPo.name || "",
        poEmail: selectedPo.email || "",
        poDepartment: selectedPo.department || "",
      });

      alert("PO assigned to batch successfully.");
      await fetchCrtBatches(selectedProgramId);
    } catch (err) {
      console.error("Failed to assign PO to batch", err);
      alert(err?.message || "Failed to assign PO to batch");
    } finally {
      setAssigningPo(false);
    }
  }

  function formatBatchOptionLabel(batch) {
    const name = batch.name || "Unnamed batch";
    const parts = [batch.poName, batch.poEmpId].filter(Boolean);
    if (parts.length === 0 && batch.poEmail) parts.push(String(batch.poEmail));
    const poLabel = parts.length ? parts.join(" ") : null;
    return poLabel ? `${name} — PO: ${poLabel}` : `${name} — no PO assigned`;
  }

  const selectedProgramName =
    crtPrograms.find((p) => p.id === selectedProgramId)?.name || "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading PO Management...</p>
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
      <div className="mx-auto px-4 py-10">
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00448a] to-cyan-600 flex items-center justify-center">
                <Layers className="w-6 h-6 text-white" />
              </div>
              PO Management
            </h1>
            <p className="text-slate-600 mt-1">
              Manage POs related to CRT programs.
            </p>
            <p className="text-xs text-slate-500 mt-2 max-w-xl">
              POs appear here only after they are saved to the database.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-medium transition-colors"
              disabled={showForm}
            >
              Create PO
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8">
          <div className="mt-2 border-t border-slate-200 pt-6">
            {loadingPos ? (
              <p className="text-sm text-slate-500">Loading POs...</p>
            ) : pos.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>No POs created yet.</p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76]"
                >
                  Create PO
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Filter by EMP Id or Email
                    </label>
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Search EMP Id or email"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="p-4 font-semibold text-slate-700">EMP Id</th>
                        <th className="p-4 font-semibold text-slate-700">Name</th>
                        <th className="p-4 font-semibold text-slate-700">Email</th>
                        <th className="p-4 font-semibold text-slate-700">Department</th>
                        <th className="p-4 font-semibold text-slate-700">Mobile</th>
                        <th className="p-4 font-semibold text-slate-700">Password</th>
                        <th className="p-4 font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPos.map((po) => (
                        <tr
                          key={po.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 text-sm"
                        >
                          <td className="p-4 text-slate-600">{po.empId || "—"}</td>
                          <td className="p-4 text-slate-900 font-medium">
                            {po.name || "—"}
                          </td>
                          <td className="p-4 text-slate-600">{po.email || "—"}</td>
                          <td className="p-4 text-slate-600">
                            {po.department || "—"}
                          </td>
                          <td className="p-4 text-slate-600">
                            {po.mobile || "—"}
                          </td>
                          <td className="p-4 text-slate-600">
                            {po.password || po.defaultPassword || "—"}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditPo(po)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePo(po)}
                                disabled={deletingId === po.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              >
                                {deletingId === po.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  Showing {filteredPos.length} of {pos.length} PO
                  {pos.length !== 1 ? "s" : ""}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">
            Assign PO to CRT batches
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-4">
            Pick a CRT program, select a <strong className="font-medium text-slate-700">batch</strong> below, then choose a PO to assign. All batches for the program are listed under the form.
          </p>
          <form
            onSubmit={handleAssignPoToBatch}
            className="grid gap-3 sm:gap-4 md:grid-cols-3"
          >
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                CRT program / course
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
              >
                {crtPrograms.length === 0 ? (
                  <option value="">No CRT programs</option>
                ) : (
                  crtPrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name || "Untitled program"}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                Batch
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
              >
                {crtBatches.length === 0 ? (
                  <option value="">No batches for this program</option>
                ) : (
                  crtBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {formatBatchOptionLabel(batch)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                PO
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                >
                  {pos.length === 0 ? (
                    <option value="">No POs available</option>
                  ) : (
                    <>
                      <option value="">Select PO</option>
                      {pos.map((po) => (
                        <option key={po.id} value={po.id}>
                          {(po.name || "Unnamed PO") + (po.empId ? ` (${po.empId})` : "")}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  type="submit"
                  disabled={
                    assigningPo ||
                    !selectedProgramId ||
                    !selectedBatchId ||
                    !selectedPoId
                  }
                  className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#00448a] text-white text-xs sm:text-sm font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigningPo ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </form>

          {selectedProgramId && crtBatches.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                Batches{selectedProgramName ? ` — ${selectedProgramName}` : ""}
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Each row is one batch in this program. The assigned PO is stored on the batch document.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90">
                      <th className="p-3 font-semibold text-slate-700">Batch</th>
                      <th className="p-3 font-semibold text-slate-700">Assigned PO</th>
                      <th className="p-3 font-semibold text-slate-700">EMP Id</th>
                      <th className="p-3 font-semibold text-slate-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crtBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                          batch.id === selectedBatchId ? "bg-[#00448a]/5" : ""
                        }`}
                      >
                        <td className="p-3 text-slate-900 font-medium">
                          {batch.name || "Unnamed batch"}
                        </td>
                        <td className="p-3 text-slate-600">
                          {batch.poName || "—"}
                        </td>
                        <td className="p-3 text-slate-600">
                          {batch.poEmpId || "—"}
                        </td>
                        <td className="p-3 text-slate-600">
                          {batch.poEmail || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedProgramId && crtBatches.length === 0 && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              This CRT program has no batches yet. Create batches in CRT Manager, then assign a PO here.
            </p>
          )}
        </div>
      </div>

      {/* Create PO Modal (same style as CRT Trainers create modal) */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-[#00448a] to-[#0066b3] px-6 py-4 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white">Create PO</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-white/90 hover:bg-white/20 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitPo} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    EMP Id
                  </label>
                  <input
                    type="text"
                    value={poForm.empId}
                    onChange={(e) =>
                      setPoForm((prev) => ({ ...prev, empId: e.target.value }))
                    }
                    placeholder="Employee ID"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={poForm.name}
                    onChange={(e) =>
                      setPoForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="PO full name"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={poForm.email}
                    onChange={(e) =>
                      setPoForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="po@example.com"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Default Password
                  </label>
                  <input
                    type="text"
                    value={DEFAULT_PO_PASSWORD}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-slate-700"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    This password will be saved for the new PO user.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>
                  <input
                    type="text"
                    value={poForm.department}
                    onChange={(e) =>
                      setPoForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    placeholder="Department"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={poForm.mobile}
                    onChange={(e) =>
                      setPoForm((prev) => ({ ...prev, mobile: e.target.value }))
                    }
                    placeholder="Mobile number"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={poForm.notes}
                    onChange={(e) =>
                      setPoForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Any additional information about this PO"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a] resize-none"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                A Firebase Auth user will be created with a default password for this PO.
              </p>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPo}
                  className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingPo ? "Creating…" : "Create PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {editingPo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeEditPo}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white">Edit PO</h2>
              <button
                type="button"
                onClick={closeEditPo}
                className="rounded-lg p-1.5 text-white/90 hover:bg-white/20 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePo} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    EMP Id
                  </label>
                  <input
                    type="text"
                    value={editForm.empId}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, empId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={editForm.mobile}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, mobile: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a] resize-none"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeEditPo}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPo}
                  className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingPo ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
