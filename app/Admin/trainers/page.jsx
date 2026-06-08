"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import CheckAdminAuth from "@/lib/CheckAdminAuth";

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
    const batch = writeBatch(db);
    batch.update(doc(db, "users", selectedTrainerId), {
      trainerClasses,
      trainerCourses,
      trainerInternships,
    });
    await batch.commit();
    // refresh trainers list to reflect changes
    const tSnap = await getDocs(collection(db, "users"));
    setTrainers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "trainer"));
    alert("Access updated for trainer.");
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
              <option key={t.id} value={t.id}>{t.name || t.email}</option>
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
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="p-2 border">{t.name || '-'}</td>
                      <td className="p-2 border">{t.email || '-'}</td>
                      <td className="p-2 border font-mono text-xs">{t.trainerPassword || "VaweTrainer@2025"}</td>
                      <td className="p-2 border">{classNames || '-'}</td>
                      <td className="p-2 border">{courseNames || '-'}</td>
                      <td className="p-2 border">{internshipNames || '-'}</td>
                      <td className="p-2 border">
                        <div className="flex gap-2">
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
                            disabled={isDeleting}
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


