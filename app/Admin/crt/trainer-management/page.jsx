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
import { enrichCrtCoursesWithSubjectType } from "@/lib/crtCourseSubjectType";

/** Must match default in /api/create-trainer (Auth + Firestore `trainerPassword`). */
const DEFAULT_TRAINER_PASSWORD = "VaweTrainer@2025";

function trainerIsOnBatch(batch, trainerId) {
  if (!batch || !trainerId) return false;
  const ids =
    Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0
      ? batch.trainerIds
      : batch.trainerId
        ? [batch.trainerId]
        : [];
  return ids.includes(trainerId);
}

function getTrainerEntry(batch, trainerId) {
  if (!batch || !trainerId || !Array.isArray(batch.assignedTrainers)) return null;
  return batch.assignedTrainers.find((t) => t.id === trainerId) || null;
}

/** Previously assigned subject ids for a trainer + track on this batch. */
function getTrainerSubjectIdsForTrack(batch, trainerId, trackType, crtCourses) {
  if (!batch || !trainerId || !trackType) return [];

  const entry = getTrainerEntry(batch, trainerId);
  const trackKey = trackType === "nonTechnical" ? "nonTechnical" : "technical";
  let subjectIds = [];

  if (entry?.trackAssignments?.[trackKey]?.length) {
    subjectIds = entry.trackAssignments[trackKey];
  } else if (entry?.trainerTrackType === trackType && Array.isArray(entry.assignedSubjectIds)) {
    subjectIds = entry.assignedSubjectIds;
  } else if (trainerIsOnBatch(batch, trainerId) && batch.trainerTrackType === trackType) {
    subjectIds = batch.assignedSubjectIds ?? batch.assignedCourseIds ?? [];
  }

  return subjectIds.filter((id) => {
    const course = crtCourses.find((c) => c.id === id);
    if (!course) return false;
    return trackType === "nonTechnical"
      ? course.isNonTechnical === true
      : course.isNonTechnical !== true;
  });
}

function defaultSubjectIdsForTrack(trackType, crtCourses, previousIds) {
  if (previousIds.length > 0) return previousIds;
  if (trackType === "nonTechnical") {
    return crtCourses.filter((c) => c?.isNonTechnical === true).map((c) => c.id);
  }
  return [];
}

function unionSubjectIdsFromTrackAssignments(trackAssignments) {
  const tech = Array.isArray(trackAssignments?.technical) ? trackAssignments.technical : [];
  const nonTech = Array.isArray(trackAssignments?.nonTechnical)
    ? trackAssignments.nonTechnical
    : [];
  return [...new Set([...tech, ...nonTech].map(String))];
}

/**
 * Unlock all chapters for assigned courses on this batch so trainer/students can open them.
 * Path: …/crt/{programId}/batches/{batchId}/courses/{courseId}/chapterUnlocks/{chapterId}
 * Also mirrors to legacy `crt/…` when using a college tenant path (trainer portal reads legacy).
 */
async function unlockAssignedCoursesForBatch(
  db,
  collegeSubdomain,
  programId,
  batchId,
  courseIds,
  trainerId
) {
  const ids = [...new Set((courseIds || []).map(String).filter(Boolean))];
  if (!db || !programId || !batchId || ids.length === 0) {
    return { unlockedCourses: 0, unlockedChapters: 0 };
  }

  let unlockedCourses = 0;
  let unlockedChapters = 0;
  const nowIso = new Date().toISOString();

  const commitUnlocks = async (pathPrefixSegments, courseId, chapterIds) => {
    let writer = firestoreHelpers.writeBatch(db);
    let ops = 0;
    for (const chapterId of chapterIds) {
      const ref = firestoreHelpers.doc(
        db,
        ...pathPrefixSegments,
        programId,
        "batches",
        batchId,
        "courses",
        courseId,
        "chapterUnlocks",
        chapterId
      );
      writer.set(
        ref,
        {
          unlocked: true,
          unlockedAt: nowIso,
          unlockedByAdminAssign: true,
          trainerId: trainerId || null,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      ops += 1;
      if (ops >= 400) {
        await writer.commit();
        writer = firestoreHelpers.writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await writer.commit();
  };

  for (const courseId of ids) {
    const chaptersSnap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(
        db,
        ...tenantSegments(collegeSubdomain, "crt"),
        programId,
        "courses",
        courseId,
        "chapters"
      )
    );
    let chapterIds = chaptersSnap.docs.map((d) => d.id);

    if (chapterIds.length === 0 && collegeSubdomain) {
      const legacyChapters = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, "crt", programId, "courses", courseId, "chapters")
      );
      chapterIds = legacyChapters.docs.map((d) => d.id);
    }

    if (chapterIds.length === 0) continue;

    await commitUnlocks(tenantSegments(collegeSubdomain, "crt"), courseId, chapterIds);
    if (collegeSubdomain) {
      await commitUnlocks(["crt"], courseId, chapterIds);
    }
    unlockedCourses += 1;
    unlockedChapters += chapterIds.length;
  }

  return { unlockedCourses, unlockedChapters };
}

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
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [crtBatches, setCrtBatches] = useState([]);
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
        const programId = programDoc.id;
        const coursesSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            ...tenantSegments(collegeSubdomain, "crt"),
            programId,
            "courses"
          )
        );
        const courseTitleById = Object.fromEntries(
          coursesSnap.docs.map((d) => [
            d.id,
            d.data()?.title || d.data()?.name || d.id,
          ])
        );
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
          const trainerIds =
            Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0
              ? batch.trainerIds
              : batch.trainerId
                ? [batch.trainerId]
                : [];
          trainerIds.forEach((trainerId) => {
            if (!trainerId) return;
            if (!map[trainerId]) map[trainerId] = [];
            const entry = getTrainerEntry(batch, trainerId);
            let subjectIds = [];
            if (entry?.trackAssignments) {
              subjectIds = [
                ...(entry.trackAssignments.technical || []),
                ...(entry.trackAssignments.nonTechnical || []),
              ];
            } else if (Array.isArray(entry?.assignedSubjectIds)) {
              subjectIds = entry.assignedSubjectIds;
            } else if (Array.isArray(batch.assignedSubjectIds)) {
              subjectIds = batch.assignedSubjectIds;
            } else if (Array.isArray(batch.assignedCourseIds)) {
              subjectIds = batch.assignedCourseIds;
            }
            const assignedSubjectNames = subjectIds
              .map((id) => courseTitleById[id])
              .filter(Boolean);
            map[trainerId].push({
              programId,
              batchId: batchDoc.id,
              programName,
              batchName: batch.name || batchDoc.id,
              trainerTrackType: entry?.trainerTrackType || batch.trainerTrackType || "",
              assignedSubjectIds: subjectIds,
              assignedSubjectNames,
            });
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
          ...tenantSegments(collegeSubdomain, "crt"),
          programId,
          "batches",
          batchId
        );
        const batchSnap = await firestoreHelpers.getDoc(batchRef);
        const batch = batchSnap.data() || {};
        const currentIds =
          Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0
            ? batch.trainerIds
            : batch.trainerId
              ? [batch.trainerId]
              : [];
        const nextIds = currentIds.filter((id) => id !== trainerId);
        const nextTrainers = (batch.assignedTrainers || []).filter((t) => t.id !== trainerId);
        const primary = trainers.find((t) => t.id === nextIds[0]);

        await firestoreHelpers.updateDoc(batchRef, {
          trainerIds: nextIds,
          trainerId: nextIds[0] || null,
          trainerName: primary?.name || nextTrainers.map((t) => t.name).filter(Boolean).join(", ") || "",
          trainerEmail: primary?.email || "",
          trainerEmpId: primary?.empId || "",
          assignedTrainers: nextTrainers,
          ...(nextIds.length === 0
            ? {
                trainerTrackType: null,
                assignedCourseIds: [],
                assignedSubjectIds: [],
              }
            : {}),
          updatedAt: new Date().toISOString(),
        });
        await fetchTrainerAssignedClasses();
        alert("Class removed from trainer.");
      } catch (err) {
        console.error("Failed to remove class assignment", err);
        alert(err.message || "Failed to remove class.");
      }
    },
    [fetchTrainerAssignedClasses, collegeSubdomain, trainers]
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
      const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const list = (
        await enrichCrtCoursesWithSubjectType(db, firestoreHelpers, rawList, collegeSubdomain)
      ).sort((a, b) =>
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
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      setCrtBatches(list);
      setSelectedBatchId((prev) =>
        prev && list.some((b) => b.id === prev) ? prev : list[0]?.id || ""
      );
    } catch (err) {
      console.error("Failed to load CRT batches", err);
      setCrtBatches([]);
      setSelectedBatchId("");
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    fetchCrtCourses(selectedProgramId);
    fetchCrtBatches(selectedProgramId);
  }, [selectedProgramId, fetchCrtCourses, fetchCrtBatches]);

  useEffect(() => {
    const batch = crtBatches.find((b) => b.id === selectedBatchId);
    const previousIds = getTrainerSubjectIdsForTrack(
      batch,
      selectedTrainerId,
      selectedTrackType,
      crtCourses
    );
    setSelectedSubjectIds(
      defaultSubjectIdsForTrack(selectedTrackType, crtCourses, previousIds)
    );
  }, [
    selectedProgramId,
    selectedTrackType,
    selectedTrainerId,
    selectedBatchId,
    crtBatches,
    crtCourses,
  ]);

  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedTrainerId("");
      return;
    }
    const batch = crtBatches.find((b) => b.id === selectedBatchId);
    if (!batch) {
      setSelectedTrainerId("");
      return;
    }
    const existingIds =
      Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0
        ? batch.trainerIds
        : batch.trainerId
          ? [batch.trainerId]
          : [];
    setSelectedTrainerId(existingIds[0] || "");
  }, [selectedBatchId, crtBatches]);

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
    if (!selectedProgramId || !selectedBatchId || !selectedTrainerId) {
      alert("Select CRT program, batch, and trainer.");
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
    const subjectIdsToAssign = selectedSubjectIds;

    if (selectedTrackType === "technical" && subjectIdsToAssign.length === 0) {
      alert("Select at least one technical subject.");
      return;
    }
    if (selectedTrackType === "nonTechnical" && subjectIdsToAssign.length === 0) {
      alert("Select at least one non-technical subject.");
      return;
    }

    setAssigning(true);
    try {
      const batchRef = firestoreHelpers.doc(
        db,
        ...tenantSegments(collegeSubdomain, "crt"),
        selectedProgramId,
        "batches",
        selectedBatchId
      );
      const batchSnap = await firestoreHelpers.getDoc(batchRef);
      const batch = batchSnap.data() || {};
      const existingIds =
        Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0
          ? batch.trainerIds
          : batch.trainerId
            ? [batch.trainerId]
            : [];
      const nextIds = [...new Set([...existingIds, selectedTrainerId])];
      const existingAssigned = Array.isArray(batch.assignedTrainers) ? batch.assignedTrainers : [];
      const trackKey = selectedTrackType === "nonTechnical" ? "nonTechnical" : "technical";
      const assignedTrainers = existingAssigned
        .filter((t) => nextIds.includes(t.id))
        .map((t) => {
          if (t.id !== trainer.id) return t;
          const trackAssignments = {
            ...(t.trackAssignments || {}),
            [trackKey]: subjectIdsToAssign,
          };
          return {
            ...t,
            name: trainer.name || t.name || "",
            email: trainer.email || t.email || "",
            empId: trainer.empId || t.empId || "",
            trackAssignments,
            trainerTrackType: selectedTrackType,
            assignedSubjectIds: unionSubjectIdsFromTrackAssignments(trackAssignments),
          };
        });
      if (!assignedTrainers.some((t) => t.id === trainer.id)) {
        const trackAssignments = { [trackKey]: subjectIdsToAssign };
        assignedTrainers.push({
          id: trainer.id,
          name: trainer.name || "",
          email: trainer.email || "",
          empId: trainer.empId || "",
          trackAssignments,
          trainerTrackType: selectedTrackType,
          assignedSubjectIds: unionSubjectIdsFromTrackAssignments(trackAssignments),
        });
      }
      const selectedTrainers = nextIds
        .map((id) => trainers.find((t) => t.id === id) || assignedTrainers.find((t) => t.id === id))
        .filter(Boolean);
      const primary = selectedTrainers[0] || trainer;
      const trainerEntry = assignedTrainers.find((t) => t.id === trainer.id);
      const allAssignedSubjectIds = unionSubjectIdsFromTrackAssignments(
        trainerEntry?.trackAssignments || { [trackKey]: subjectIdsToAssign }
      );

      await firestoreHelpers.updateDoc(batchRef, {
        trainerIds: nextIds,
        trainerId: primary.id,
        trainerName: selectedTrainers.map((t) => t.name || t.email).filter(Boolean).join(", "),
        trainerEmail: primary.email || "",
        trainerEmpId: primary.empId || "",
        assignedTrainers,
        trainerTrackType: selectedTrackType,
        assignedCourseIds: allAssignedSubjectIds,
        assignedSubjectIds: allAssignedSubjectIds,
        updatedAt: new Date().toISOString(),
      });

      try {
        await unlockAssignedCoursesForBatch(
          db,
          collegeSubdomain,
          selectedProgramId,
          selectedBatchId,
          subjectIdsToAssign,
          trainer.id
        );
      } catch (unlockErr) {
        console.error("Assigned subjects but failed to unlock courses", unlockErr);
      }

      await fetchTrainerAssignedClasses();
      await fetchCrtBatches(selectedProgramId);
      alert("Assigned successfully");
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
                                      className="inline-flex flex-col items-start gap-0.5 rounded-lg bg-blue-50 border border-blue-200 px-2 py-1 text-xs text-blue-700 max-w-xs"
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        {c.programName}
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
                                      {c.trainerTrackType === "technical" &&
                                        Array.isArray(c.assignedSubjectNames) &&
                                        c.assignedSubjectNames.length > 0 && (
                                          <span className="text-[10px] text-blue-600/90">
                                            {c.assignedSubjectNames.join(", ")}
                                          </span>
                                        )}
                                      {c.trainerTrackType === "nonTechnical" && (
                                        <span className="text-[10px] text-amber-700">
                                          Non-technical
                                        </span>
                                      )}
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

            {/* Assign trainers to CRT batch */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">
                Assign trainers to CRT batch
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-4">
                Select CRT program, pick one batch, choose one or more trainers, then assign.
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
                    Batch
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                  >
                    {crtBatches.length === 0 ? (
                      <option value="">No batches</option>
                    ) : (
                      crtBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.id}
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
                              {t.name || t.email || "Unnamed"}
                              {t.empId ? ` (${t.empId})` : ""}
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
                        !selectedBatchId ||
                        !selectedTrainerId ||
                        (selectedTrackType === "technical" &&
                          selectedSubjectIds.length === 0) ||
                        (selectedTrackType === "nonTechnical" &&
                          selectedSubjectIds.length === 0)
                      }
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#00448a] text-white text-xs sm:text-sm font-medium hover:bg-[#003a76] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {assigning ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedTrackType === "technical"
                      ? "Trainer will be assigned only to the selected technical subjects."
                      : "Trainer will be assigned to all non-technical subjects in this CRT."}
                  </p>
                </div>

                {crtCourses.length > 0 && selectedTrackType === "technical" && (
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                      Technical subjects
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {crtCourses.filter((c) => c?.isNonTechnical !== true).length === 0 ? (
                        <p className="text-xs sm:text-sm text-slate-500">
                          No technical subjects in this CRT. Mark courses as non-technical in course settings if needed.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {crtCourses
                            .filter((c) => c?.isNonTechnical !== true)
                            .map((subject) => (
                              <label
                                key={subject.id}
                                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer"
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
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]/30"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">
                                    {subject.title || subject.name || "Untitled subject"}
                                  </span>
                                  <span className="mt-1 inline-flex rounded-full bg-[#00448a]/10 px-2 py-0.5 text-[10px] font-medium text-[#00448a]">
                                    Technical subjects
                                  </span>
                                </span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Shows this trainer&apos;s previously assigned technical subjects for this batch. Check subjects to assign or update.
                    </p>
                  </div>
                )}

                {crtCourses.length > 0 && selectedTrackType === "nonTechnical" && (
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">
                      Non-technical (Aptitude &amp; Soft Skills)
                    </label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {crtCourses.filter((c) => c?.isNonTechnical === true).length === 0 ? (
                        <p className="text-xs sm:text-sm text-slate-500">
                          No non-technical subjects in this CRT. Enable the toggle on a course to mark it as non-technical.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {crtCourses
                            .filter((c) => c?.isNonTechnical === true)
                            .map((subject) => (
                              <label
                                key={subject.id}
                                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer ring-1 ring-amber-200"
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
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">
                                    {subject.title || subject.name || "Untitled subject"}
                                  </span>
                                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                    Non-technical (Aptitude &amp; Soft Skills)
                                  </span>
                                </span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Shows this trainer&apos;s previously assigned non-technical subjects for this batch. All are selected by default if none were assigned yet.
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
