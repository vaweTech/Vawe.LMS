"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, writeBatch, setDoc, getDoc, deleteField } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import CheckAdminAuth from "@/lib/CheckAdminAuth";

function isTrainerLocked(t) {
  return t?.locked === true || t?.status === "hold" || t?.status === "locked";
}

async function getInternshipCourseCopyIds(internshipId) {
  const coursesSnap = await getDocs(
    collection(db, "internships", internshipId, "courses")
  );
  return coursesSnap.docs.map((d) => d.id);
}

async function syncTrainerChapterAccessOnAssign(
  trainerId,
  courseIds,
  internshipIds,
  prevCourseIds,
  prevInternshipIds
) {
  if (!trainerId) return;

  const removedCourseIds = prevCourseIds.filter((id) => !courseIds.includes(id));
  const removedInternshipIds = prevInternshipIds.filter((id) => !internshipIds.includes(id));

  const copyIdsToClear = [];
  for (const internshipId of removedInternshipIds) {
    try {
      const copyIds = await getInternshipCourseCopyIds(internshipId);
      copyIdsToClear.push(...copyIds);
    } catch (e) {
      console.error(`Failed to load removed internship ${internshipId}:`, e);
    }
  }

  const payload = {};

  for (const courseId of courseIds) {
    try {
      const snap = await getDocs(collection(db, "courses", courseId, "chapters"));
      payload[`chapterAccess.${courseId}`] = snap.docs.map((d) => d.id);
    } catch (e) {
      console.error(`Failed to load chapters for course ${courseId}:`, e);
    }
  }

  for (const internshipId of internshipIds) {
    try {
      const coursesSnap = await getDocs(
        collection(db, "internships", internshipId, "courses")
      );
      for (const courseDoc of coursesSnap.docs) {
        const copyId = courseDoc.id;
        const chSnap = await getDocs(
          collection(db, "internships", internshipId, "courses", copyId, "chapters")
        );
        payload[`chapterAccess.${copyId}`] = chSnap.docs.map((d) => d.id);
      }
    } catch (e) {
      console.error(`Failed to load internship ${internshipId} courses:`, e);
    }
  }

  for (const id of removedCourseIds) {
    payload[`chapterAccess.${id}`] = deleteField();
  }
  for (const id of copyIdsToClear) {
    payload[`chapterAccess.${id}`] = deleteField();
  }

  if (Object.keys(payload).length === 0) return;

  await setDoc(doc(db, "users", trainerId), payload, { merge: true });
}

export default function ManageTrainersPage() {
  const router = useRouter();
  const [trainers, setTrainers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [internships, setInternships] = useState([]);
  const [newTrainer, setNewTrainer] = useState({ name: "", email: "" });
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [trainerClasses, setTrainerClasses] = useState([]);
  const [trainerCourses, setTrainerCourses] = useState([]);
  const [trainerInternships, setTrainerInternships] = useState([]);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [lockingId, setLockingId] = useState(null);

  useEffect(() => {
    (async () => {
      const [tSnap, cSnap, crSnap, iSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "internships")),
      ]);
      setTrainers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "trainer"));
      setClasses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCourses(crSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setInternships(iSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  async function handleCreateTrainer(e) {
    e.preventDefault();
    if (!newTrainer.name || !newTrainer.email) return alert("Name and Email required");
    // Create via server route to also create Firebase Auth user with default password
    const res = await fetch('/api/create-trainer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTrainer) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Create trainer failed');
    setNewTrainer({ name: "", email: "" });
    const tSnap = await getDocs(collection(db, "users"));
    setTrainers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "trainer"));
    alert("Trainer created. Default password: VaweTrainer@2025");
  }

  async function handleAssign() {
    if (!selectedTrainerId) return alert("Select a trainer");

    const userRef = doc(db, "users", selectedTrainerId);
    const userSnap = await getDoc(userRef);
    const prevData = userSnap.exists() ? userSnap.data() : {};
    const prevCourses = Array.isArray(prevData.trainerCourses) ? prevData.trainerCourses : [];
    const prevInternships = Array.isArray(prevData.trainerInternships)
      ? prevData.trainerInternships
      : [];

    const batch = writeBatch(db);
    batch.update(userRef, {
      trainerClasses,
      trainerCourses,
      trainerInternships,
    });
    await batch.commit();

    await syncTrainerChapterAccessOnAssign(
      selectedTrainerId,
      trainerCourses,
      trainerInternships,
      prevCourses,
      prevInternships
    );
    // refresh trainers list to reflect changes
    const tSnap = await getDocs(collection(db, "users"));
    setTrainers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "trainer"));
    alert(
      trainerCourses.length === 0 && trainerInternships.length === 0
        ? "Access removed. Assigned courses/internships are locked for this trainer."
        : "Access updated for trainer. All chapters unlocked for assigned courses/internships."
    );
  }

  function openEdit(t) {
    setEditingTrainer(t);
    setEditForm({ name: t.name || "", email: t.email || "" });
  }

  async function handleUpdateTrainer(e) {
    e.preventDefault();
    if (!editingTrainer?.id) return;
    if (!editForm.name?.trim() || !editForm.email?.trim()) {
      alert("Name and Email are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/update-trainer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editingTrainer.id,
          name: editForm.name.trim(),
          email: editForm.email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingTrainer(null);
      const tSnap = await getDocs(collection(db, "users"));
      setTrainers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "trainer"));
      alert("Trainer updated.");
    } catch (err) {
      alert(err.message || "Failed to update trainer");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLock(t) {
    const locked = isTrainerLocked(t);
    const label = t.name || t.email || "this trainer";
    if (
      !confirm(
        locked
          ? `Unlock "${label}"? They will be able to log in again.`
          : `Lock "${label}"? They will not be able to log in until unlocked.`
      )
    ) {
      return;
    }
    setLockingId(t.id);
    try {
      const res = await fetch("/api/update-trainer-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: t.id, active: locked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update lock status");
      setTrainers((prev) =>
        prev.map((tr) =>
          tr.id === t.id
            ? { ...tr, locked: !locked, status: locked ? "active" : "hold" }
            : tr
        )
      );
      alert(
        locked
          ? "Trainer unlocked. They can log in again."
          : "Trainer locked. Login is disabled for this account."
      );
    } catch (err) {
      alert(err.message || "Failed to update lock status");
    } finally {
      setLockingId(null);
    }
  }

  async function handleDeleteTrainer(t) {
    if (!confirm(`Delete trainer "${t.name || t.email}"? This cannot be undone.`)) return;
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/delete-trainer?uid=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (selectedTrainerId === t.id) {
        setSelectedTrainerId("");
        setTrainerClasses([]);
        setTrainerCourses([]);
        setTrainerInternships([]);
      }
      const tSnap = await getDocs(collection(db, "users"));
      setTrainers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "trainer"));
      alert("Trainer deleted.");
    } catch (err) {
      alert(err.message || "Failed to delete trainer");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <CheckAdminAuth>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Manage Trainers</h1>
          <button
            onClick={() => router.back()}
            className="px-3 py-1.5 rounded bg-gray-600 hover:bg-gray-700 text-white"
          >
            ⬅ Back
          </button>
        </div>

        <form onSubmit={handleCreateTrainer} className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <input className="border p-2 rounded" placeholder="Trainer Name" value={newTrainer.name} onChange={(e) => setNewTrainer({ ...newTrainer, name: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Trainer Email" value={newTrainer.email} onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })} />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Create Trainer</button>
        </form>

        <div className="bg-white border rounded p-4 mb-6">
          <h2 className="font-semibold mb-2">Select Trainer</h2>
          <select
            className="border p-2 rounded w-full"
            value={selectedTrainerId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTrainerId(id);
              const t = trainers.find((tr) => tr.id === id);
              if (t) {
                setTrainerClasses(Array.isArray(t.trainerClasses) ? t.trainerClasses : []);
                setTrainerCourses(Array.isArray(t.trainerCourses) ? t.trainerCourses : []);
                setTrainerInternships(Array.isArray(t.trainerInternships) ? t.trainerInternships : []);
              } else {
                setTrainerClasses([]);
                setTrainerCourses([]);
                setTrainerInternships([]);
              }
            }}
          >
            <option value="">Choose…</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.email}{isTrainerLocked(t) ? " (Locked)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded p-4">
            <h3 className="font-semibold mb-2">Grant Class Access</h3>
            <div className="space-y-2 max-h-60 overflow-auto border rounded p-2">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={trainerClasses.includes(c.id)} onChange={(e) => {
                    setTrainerClasses((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id));
                  }} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded p-4">
            <h3 className="font-semibold mb-2">Grant Course Access</h3>
            <div className="space-y-2 max-h-60 overflow-auto border rounded p-2">
              {courses.map((cr) => (
                <label key={cr.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={trainerCourses.includes(cr.id)} onChange={(e) => {
                    setTrainerCourses((prev) => e.target.checked ? [...prev, cr.id] : prev.filter((id) => id !== cr.id));
                  }} />
                  <span>{cr.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white border rounded p-4">
          <h3 className="font-semibold mb-2">Grant Internship Access</h3>
          <div className="space-y-2 max-h-60 overflow-auto border rounded p-2">
            {internships.map((it) => (
              <label key={it.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={trainerInternships.includes(it.id)}
                  onChange={(e) => {
                    setTrainerInternships((prev) =>
                      e.target.checked ? [...prev, it.id] : prev.filter((id) => id !== it.id)
                    );
                  }}
                />
                <span>{it.name || it.id}</span>
              </label>
            ))}
            {internships.length === 0 && (
              <p className="text-sm text-gray-500">No internships available.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button onClick={handleAssign} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded">Save Access</button>
        </div>

        {/* Trainers List */}
        <div className="mt-8 bg-white border rounded p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3">All Trainers</h2>
          {trainers.length === 0 ? (
            <p className="text-sm text-gray-500">No trainers yet.</p>
          ) : (
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">Name</th>
                  <th className="p-2 border text-left">Email</th>
                  <th className="p-2 border text-left">Password</th>
                  <th className="p-2 border text-left">Classes</th>
                  <th className="p-2 border text-left">Courses</th>
                  <th className="p-2 border text-left">Internships</th>
                  <th className="p-2 border text-left">Status</th>
                  <th className="p-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map((t) => {
                  const cls = Array.isArray(t.trainerClasses) ? t.trainerClasses : [];
                  const crs = Array.isArray(t.trainerCourses) ? t.trainerCourses : [];
                  const ints = Array.isArray(t.trainerInternships) ? t.trainerInternships : [];
                  const classNames = cls
                    .map((id) => classes.find((c) => c.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');
                  const courseNames = crs
                    .map((id) => courses.find((c) => c.id === id)?.title)
                    .filter(Boolean)
                    .join(', ');
                  const internshipNames = ints
                    .map((id) => internships.find((i) => i.id === id)?.name || id)
                    .filter(Boolean)
                    .join(', ');
                  const isDeleting = deletingId === t.id;
                  const isLocking = lockingId === t.id;
                  const locked = isTrainerLocked(t);
                  return (
                    <tr key={t.id} className={`border-t ${locked ? "bg-gray-50 text-gray-500" : ""}`}>
                      <td className="p-2 border">{t.name || '-'}</td>
                      <td className="p-2 border">{t.email || '-'}</td>
                      <td className="p-2 border font-mono text-xs">{t.trainerPassword || "VaweTrainer@2025"}</td>
                      <td className="p-2 border">{classNames || '-'}</td>
                      <td className="p-2 border">{courseNames || '-'}</td>
                      <td className="p-2 border">{internshipNames || '-'}</td>
                      <td className="p-2 border">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                            locked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {locked ? "Locked" : "Active"}
                        </span>
                      </td>
                      <td className="p-2 border">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleLock(t)}
                            disabled={isLocking || isDeleting}
                            className={`px-2 py-1 rounded text-white text-xs disabled:opacity-50 ${
                              locked
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-slate-700 hover:bg-slate-800"
                            }`}
                          >
                            {isLocking ? "…" : locked ? "Unlock" : "Lock"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTrainer(t)}
                            disabled={isDeleting || isLocking}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs"
                          >
                            {isDeleting ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Trainer Modal */}
        {editingTrainer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !saving && setEditingTrainer(null)}>
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold mb-3">Edit Trainer</h3>
              <form onSubmit={handleUpdateTrainer} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Name</label>
                  <input
                    className="border p-2 rounded w-full"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Trainer Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="border p-2 rounded w-full"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Trainer Email"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => !saving && setEditingTrainer(null)}
                    className="px-3 py-1.5 rounded border bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CheckAdminAuth>
  );
}


