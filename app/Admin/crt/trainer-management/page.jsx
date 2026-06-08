"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { db, firestoreHelpers, isFirebaseConfigured } from "../../../../lib/firebase";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "../../AdminAccessContext";
import { motion } from "framer-motion";
import { ArrowLeft, UserCog, UserPlus, X, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { crtTrainerCollectionSegments, crtTrainerDocSegments } from "@/lib/collegeTenantFirestore";
import { tenantSegments } from "@/lib/tenantPath";

/** Must match default in /api/create-trainer (Auth + Firestore `trainerPassword`). */
const DEFAULT_TRAINER_PASSWORD = "VaweTrainer@2025";

export default function CRTTrainerManagementPage() {
  const router = useRouter();
  const { user, loading, hasCrtManagerAccess: isAdmin, collegeSubdomain } = useAdminAccess();
  const [trainers, setTrainers] = useState([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "", empId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [pendingSync, setPendingSync] = useState(null);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [deletingId, setDeletingId] = useState(null);
  const [crtPrograms, setCrtPrograms] = useState([]);
  const [crtCourses, setCrtCourses] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [selectedTrackType, setSelectedTrackType] = useState("technical");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [trainerAssignedClasses, setTrainerAssignedClasses] = useState({});
  const [assigning, setAssigning] = useState(false);

  const fetchTrainers = useCallback(async () => {
    if (!db) return;
    setLoadingTrainers(true);
    try {
      // users (collection) -> crtTrainers (document) -> trainers (subcollection)
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, ...crtTrainerCollectionSegments(collegeSubdomain))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setTrainers(list);
    } catch (err) {
      console.error(err);
      alert("Failed to load trainers.");
    } finally {
      setLoadingTrainers(false);
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    if (user && isAdmin && isFirebaseConfigured) {
      fetchTrainers();
    }
  }, [user, isAdmin, fetchTrainers]);

  // Load CRT programs (courses) for assigning trainers to batches
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
      if (!selectedProgramId && list.length > 0) {
        setSelectedProgramId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load CRT programs", err);
    }
  }, [selectedProgramId, collegeSubdomain]);

  useEffect(() => {
    if (user && isAdmin && isFirebaseConfigured) {
      fetchCrtPrograms();
    }
  }, [user, isAdmin, fetchCrtPrograms]);

  const fetchTrainerAssignedClasses = useCallback(async () => {
    if (!db) return;
    try {
      const programsSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, ...tenantSegments(collegeSubdomain, "crt"))
      );
      const map = {};
      for (const programDoc of programsSnap.docs) {
        const programName = programDoc.data()?.name || programDoc.id;
        const batchesSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            ...tenantSegments(collegeSubdomain, "crt"),
            programDoc.id,
            "batches"
          )
        );
        batchesSnap.docs.forEach((batchDoc) => {
          const batch = batchDoc.data() || {};
          if (!batch.trainerId) return;
          if (!map[batch.trainerId]) map[batch.trainerId] = [];
          map[batch.trainerId].push({
            programId: programDoc.id,
            batchId: batchDoc.id,
            programName,
            batchName: batch.name || batchDoc.id,
          });
        });
      }
      setTrainerAssignedClasses(map);
    } catch (err) {
      console.error("Failed to load trainer assigned classes", err);
      setTrainerAssignedClasses({});
    }
  }, [collegeSubdomain]);

  const handleRemoveAssignedClass = useCallback(
    async (trainerId, programId, batchId) => {
      if (!db || !trainerId || !programId || !batchId) return;
      const confirmed = window.confirm(
        "Remove this class assignment from trainer?"
      );
      if (!confirmed) return;
      try {
        const batchRef = firestoreHelpers.doc(
          db,
          "crt",
          programId,
          "batches",
          batchId
        );
        await firestoreHelpers.updateDoc(batchRef, {
          trainerId: null,
          trainerName: "",
          trainerEmail: "",
          trainerEmpId: "",
          trainerTrackType: null,
          assignedCourseIds: [],
          assignedSubjectIds: [],
          updatedAt: new Date().toISOString(),
        });
        await fetchTrainerAssignedClasses();
        alert("Class removed from trainer.");
      } catch (err) {
        console.error("Failed to remove class assignment", err);
        alert(err.message || "Failed to remove class.");
      }
    },
    [fetchTrainerAssignedClasses]
  );

  // Load CRT subjects/courses for selected program
  const fetchCrtCourses = useCallback(async (programId) => {
    if (!db || !programId) {
      setCrtCourses([]);
      setSelectedSubjectIds([]);
      return;
    }
    try {
      const snap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          programId,
          "courses"
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.title || a.name || "").localeCompare(b.title || b.name || "")
        );
      setCrtCourses(list);
      setSelectedSubjectIds((prev) => prev.filter((id) => list.some((c) => c.id === id)));
    } catch (err) {
      console.error("Failed to load CRT subjects", err);
      setCrtCourses([]);
      setSelectedSubjectIds([]);
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    fetchCrtCourses(selectedProgramId);
  }, [selectedProgramId, fetchCrtCourses]);

  useEffect(() => {
    setSelectedSubjectIds([]);
  }, [selectedProgramId, selectedTrackType]);

  useEffect(() => {
    if (user && isAdmin && isFirebaseConfigured) {
      fetchTrainerAssignedClasses();
    }
  }, [user, isAdmin, fetchTrainerAssignedClasses]);

  const openCreateModal = () => {
    setCreateForm({ name: "", email: "", phone: "", empId: "" });
    setPendingSync(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setPendingSync(null);
  };

  const openEditModal = (trainer) => {
    setEditingTrainer(trainer);
    setEditForm({
      name: trainer.name || "",
      phone: trainer.phone || "",
    });
  };

  const closeEditModal = () => {
    setEditingTrainer(null);
    setEditForm({ name: "", email: "" });
  };

  const syncTrainerDoc = async (uid, trainerData) => {
    const res = await fetch("/api/sync-trainer-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid,
        name: trainerData.name,
        email: trainerData.email,
        phone: trainerData.phone || "",
        empId: trainerData.empId || "",
        role: trainerData.role || "crtTrainer",
        trainerPassword: trainerData.trainerPassword || DEFAULT_TRAINER_PASSWORD,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save profile");
    return data;
  };

  const handleCreateTrainer = async (e) => {
    e.preventDefault();
    if (!createForm.name?.trim() || !createForm.email?.trim()) {
      alert("Name and Email are required.");
      return;
    }
    setSubmitting(true);
    setPendingSync(null);
    try {
      const res = await fetch("/api/create-trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone?.trim() || undefined,
          empId: createForm.empId?.trim() || undefined,
          crtTrainer: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create trainer failed");

      if (data.needsSync && data.uid && data.trainerData) {
        try {
          await syncTrainerDoc(data.uid, data.trainerData);
        } catch (syncErr) {
          setPendingSync({ uid: data.uid, trainerData: data.trainerData });
          setSubmitting(false);
          return;
        }
      }

      // Store in users/crtTrainers/trainers/{uid} (doc id = Auth uid)
      if (db && data.uid) {
        const trainerDoc = firestoreHelpers.doc(db, ...crtTrainerDocSegments(collegeSubdomain, data.uid));
        await firestoreHelpers.setDoc(trainerDoc, {
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone?.trim() || "",
          empId: createForm.empId?.trim() || "",
          role: "crtTrainer",
          trainerPassword: DEFAULT_TRAINER_PASSWORD,
          createdAt: new Date().toISOString(),
        });
      }

      setShowCreateModal(false);
      setCreateForm({ name: "", email: "", phone: "", empId: "" });
      setPendingSync(null);
      await fetchTrainers();
      alert("Trainer created. Default password: VaweTrainer@2025");
    } catch (err) {
      alert(err.message || "Failed to create trainer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetrySync = async () => {
    if (!pendingSync) return;
    setSubmitting(true);
    try {
      await syncTrainerDoc(pendingSync.uid, pendingSync.trainerData);
      if (db) {
        const trainerDoc = firestoreHelpers.doc(
          db,
          ...crtTrainerDocSegments(collegeSubdomain, pendingSync.uid)
        );
        await firestoreHelpers.setDoc(trainerDoc, {
          name: pendingSync.trainerData.name || "",
          email: pendingSync.trainerData.email || "",
          phone: pendingSync.trainerData.phone || "",
          empId: pendingSync.trainerData.empId || "",
          role: "crtTrainer",
          trainerPassword:
            pendingSync.trainerData.trainerPassword || DEFAULT_TRAINER_PASSWORD,
          createdAt: new Date().toISOString(),
        });
      }
      setShowCreateModal(false);
      setCreateForm({ name: "", email: "", phone: "", empId: "" });
      setPendingSync(null);
      await fetchTrainers();
      alert("Trainer profile saved. Default password: VaweTrainer@2025");
    } catch (err) {
      alert(err.message || "Could not save profile. Try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTrainer = async (e) => {
    e.preventDefault();
    if (!editingTrainer) return;
    const name = editForm.name.trim();
    const phone = editForm.phone.trim();
    if (!name && !phone) {
      alert("Provide at least name or phone.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/update-trainer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editingTrainer.id,
          name: name || undefined,
          phone: phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update trainer failed");
      if (db) {
        const trainerRef = firestoreHelpers.doc(
          db,
          ...crtTrainerDocSegments(collegeSubdomain, editingTrainer.id)
        );
        await firestoreHelpers.updateDoc(trainerRef, {
          name: name || editingTrainer.name || "",
          phone: phone ?? editingTrainer.phone ?? "",
        });
      }
      await fetchTrainers();
      closeEditModal();
      alert("Trainer updated.");
    } catch (err) {
      alert(err.message || "Failed to update trainer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTrainer = async (trainer) => {
    const confirmed = window.confirm(
      "This trainer's account and data will be deleted permanently. Are you sure?"
    );
    if (!confirmed) return;
    setDeletingId(trainer.id);
    try {
      if (db) {
        const trainerRef = firestoreHelpers.doc(
          db,
          ...crtTrainerDocSegments(collegeSubdomain, trainer.id)
        );
        await firestoreHelpers.deleteDoc(trainerRef);
      }
      const res = await fetch(`/api/delete-trainer?uid=${encodeURIComponent(trainer.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete trainer failed");
      await fetchTrainers();
      alert("Trainer deleted.");
    } catch (err) {
      alert(err.message || "Failed to delete trainer");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssignTrainerToBatch = async (e) => {
    e.preventDefault();
    if (!selectedProgramId || !selectedTrainerId) {
      alert("Select program and trainer.");
      return;
    }
    const trainer = trainers.find((t) => t.id === selectedTrainerId);
    if (!trainer) {
      alert("Selected trainer not found.");
      return;
    }
    if (!db) {
      alert("Firebase is not configured.");
      return;
    }
    const nonTechnicalCourses = crtCourses.filter((c) => c?.isNonTechnical === true);
    const subjectIdsToAssign =
      selectedTrackType === "technical"
        ? selectedSubjectIds
        : nonTechnicalCourses.map((c) => c.id);

    if (selectedTrackType === "technical" && subjectIdsToAssign.length === 0) {
      alert("Select at least one technical subject.");
      return;
    }

    setAssigning(true);
    try {
      const batchesSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...tenantSegments(collegeSubdomain, "crt"),
          selectedProgramId,
          "batches"
        )
      );
      if (batchesSnap.empty) {
        alert("No batches found under selected CRT.");
        setAssigning(false);
        return;
      }
      await Promise.all(
        batchesSnap.docs.map((batchDoc) =>
          firestoreHelpers.updateDoc(
            firestoreHelpers.doc(
              db,
              ...tenantSegments(collegeSubdomain, "crt"),
              selectedProgramId,
              "batches",
              batchDoc.id
            ),
            {
              trainerId: trainer.id,
              trainerName: trainer.name || "",
              trainerEmail: trainer.email || "",
              trainerEmpId: trainer.empId || "",
              trainerTrackType: selectedTrackType,
              assignedCourseIds: subjectIdsToAssign,
              assignedSubjectIds: subjectIdsToAssign,
              updatedAt: new Date().toISOString(),
            }
          )
        )
      );
      await fetchTrainerAssignedClasses();
      alert(
        selectedTrackType === "technical"
          ? `Trainer assigned to all batches with ${subjectIdsToAssign.length} selected technical subject(s).`
          : "Trainer assigned to all batches with non-technical subjects."
      );
    } catch (err) {
      console.error("Failed to assign trainer to batch", err);
      alert(err.message || "Failed to assign trainer");
    } finally {
      setAssigning(false);
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
      <div className="mx-auto px-4 py-10 w-full">
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              CRT Trainers
            </h1>
            <p className="text-slate-600 mt-1">
              View CRT trainers and create new trainer accounts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Create Trainer
            </button>
          </div>
        </div>

        {!isFirebaseConfigured ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            <p>Firebase is not configured. Configure .env.local to load trainers.</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {loadingTrainers && trainers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin text-[#00448a]" />
                  <p>Loading trainers...</p>
                </div>
              ) : trainers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <UserCog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No trainers registered yet.</p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76]"
                  >
                    <UserPlus className="w-4 h-4" /> Create Trainer
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="p-4 font-semibold text-slate-700">EMP Id</th>
                        <th className="p-4 font-semibold text-slate-700">Name</th>
                        <th className="p-4 font-semibold text-slate-700">Email</th>
                        <th className="p-4 font-semibold text-slate-700">Password</th>
                        <th className="p-4 font-semibold text-slate-700">Assigned Classes</th>
                        <th className="p-4 font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainers.map((t) => {
                        const isDeleting = deletingId === t.id;
                        return (
                          <tr
                            key={t.id}
                            className="border-b border-slate-100 hover:bg-slate-50/50"
                          >
                            <td className="p-4 text-slate-600">{t.empId || "—"}</td>
                            <td className="p-4 text-slate-900 font-medium">
                              {t.name || "—"}
                            </td>
                            <td className="p-4 text-slate-600">{t.email || "—"}</td>
                            <td className="p-4 text-slate-800 font-mono text-xs max-w-[200px] break-all">
                              {t.trainerPassword || DEFAULT_TRAINER_PASSWORD}
                            </td>
                            <td className="p-4 text-slate-600">
                              {Array.isArray(trainerAssignedClasses[t.id]) &&
                              trainerAssignedClasses[t.id].length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {trainerAssignedClasses[t.id].map((c, idx) => (
                                    <span
                                      key={`${c.programName}-${c.batchName}-${idx}`}
                                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700"
                                    >
                                      {c.programName} - {c.batchName}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveAssignedClass(
                                            t.id,
                                            c.programId,
                                            c.batchId
                                          )
                                        }
                                        className="rounded-full px-1 text-blue-700 hover:bg-blue-100"
                                        title="Remove class from trainer"
                                        aria-label={`Remove ${c.batchName} from ${t.name || "trainer"}`}
                                      >
                                        x
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "Not assigned"
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(t)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTrainer(t)}
                                  disabled={isDeleting}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {isDeleting ? "Deleting..." : "Delete"}
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
            </motion.div>

            {trainers.length > 0 && (
              <p className="mt-4 text-sm text-slate-500">
                Total: {trainers.length} trainer{trainers.length !== 1 ? "s" : ""}
              </p>
            )}

            {/* Assign trainer to CRT batch */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">
                Assign trainer to CRT
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-4">
                Select CRT, choose technical/non-technical, then assign trainer for all batches in that CRT.
              </p>
              <form
                onSubmit={handleAssignTrainerToBatch}
                className="grid gap-3 sm:gap-4 md:grid-cols-2"
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
                      crtPrograms.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || "Untitled program"}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                    Track type
                  </label>
                  <select
                    value={selectedTrackType}
                    onChange={(e) => setSelectedTrackType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  >
                    <option value="technical">Technical</option>
                    <option value="nonTechnical">Non-technical</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                    Trainer
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTrainerId}
                      onChange={(e) => setSelectedTrainerId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    >
                      {trainers.length === 0 ? (
                        <option value="">No trainers</option>
                      ) : (
                        <>
                          <option value="">Select trainer</option>
                          {trainers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name || t.email || "Unnamed"}{" "}
                              {t.empId ? `(${t.empId})` : ""}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <button
                      type="submit"
                      disabled={
                        assigning ||
                        !selectedProgramId ||
                        !selectedTrainerId ||
                        (selectedTrackType === "technical" &&
                          selectedSubjectIds.length === 0)
                      }
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#00448a] text-white text-xs sm:text-sm font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {assigning ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                </div>

                {selectedTrackType === "technical" && (
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                      Technical subjects
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {crtCourses.filter((c) => c?.isNonTechnical !== true).length === 0 ? (
                        <p className="text-xs sm:text-sm text-slate-500">
                          No technical subjects found for this CRT.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {crtCourses
                            .filter((c) => c?.isNonTechnical !== true)
                            .map((subject) => (
                              <label
                                key={subject.id}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSubjectIds.includes(subject.id)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedSubjectIds((prev) =>
                                      checked
                                        ? [...prev, subject.id]
                                        : prev.filter((id) => id !== subject.id)
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]/30"
                                />
                                <span>{subject.title || subject.name || "Untitled subject"}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Trainer will be assigned only to the selected technical subjects.
                    </p>
                  </div>
                )}
              </form>
            </div>
          </>
        )}

        {/* Edit Trainer Modal */}
        {editingTrainer && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeEditModal}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4 rounded-t-2xl">
                <h2 className="text-lg font-bold text-white">Edit Trainer</h2>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg p-1.5 text-white/90 hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateTrainer} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Trainer full name"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="Trainer phone number"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email (read only)
                    </p>
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
                      {editingTrainer?.email || "No email"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Only name and phone can be changed here. Email, password and role stay the same.
                </p>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Trainer Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeCreateModal}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-[#00448a] to-[#0066b3] px-6 py-4 rounded-t-2xl">
                <h2 className="text-lg font-bold text-white">Create Trainer</h2>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-lg p-1.5 text-white/90 hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateTrainer} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">EMP Id</label>
                    <input
                      type="text"
                      value={createForm.empId}
                      onChange={(e) => setCreateForm((f) => ({ ...f, empId: e.target.value }))}
                      placeholder="Employee ID"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Name *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Trainer full name"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email *</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="trainer@example.com"
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  A Firebase Auth user will be created with default password: VaweTrainer@2025
                </p>
                {pendingSync && (
                  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <p className="font-medium">Account created. Profile could not be saved (network error).</p>
                    <p className="mt-1 text-xs">Click &quot;Retry save profile&quot; to save trainer details to the database.</p>
                    <button
                      type="button"
                      onClick={handleRetrySync}
                      disabled={submitting}
                      className="mt-3 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                    >
                      {submitting ? "Saving…" : "Retry save profile"}
                    </button>
                  </div>
                )}
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Creating…" : "Create Trainer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
