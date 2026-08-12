"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import {
  createMockTestGroup,
  deleteMockTestGroup,
  fetchMockTestGroups,
  fetchMockTestsForCompany,
  slugFromMockTestLabel,
  updateMockTestGroup,
} from "@/lib/mockTests";
import { ChevronRight, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";

const emptyForm = { label: "", order: 0 };

export default function AdminMockTestGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [testCounts, setTestCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingSlug, setEditingSlug] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function loadGroups() {
    setLoading(true);
    try {
      const list = await fetchMockTestGroups();
      setGroups(list);
      const counts = {};
      await Promise.all(
        list.map(async (group) => {
          const slug = group.slug || group.id;
          const tests = await fetchMockTestsForCompany(slug);
          counts[slug] = tests.length;
        })
      );
      setTestCounts(counts);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to load mock test groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.label.trim()) {
      alert("Enter a group name.");
      return;
    }
    setSaving(true);
    try {
      const slug = slugFromMockTestLabel(form.label);
      if (!slug) {
        alert("Could not generate a slug from that name. Use letters or numbers.");
        return;
      }
      await createMockTestGroup({
        slug,
        label: form.label.trim(),
        order: form.order,
      });
      setForm(emptyForm);
      await loadGroups();
      alert("Mock test group created.");
    } catch (err) {
      alert(err?.message || "Failed to create group.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(group) {
    const slug = group.slug || group.id;
    setEditingSlug(slug);
    setEditForm({
      label: group.label || slug,
      order: group.order || 0,
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editingSlug) return;
    setSaving(true);
    try {
      await updateMockTestGroup(editingSlug, {
        label: editForm.label,
        order: editForm.order,
      });
      setEditingSlug(null);
      await loadGroups();
      alert("Group updated.");
    } catch (err) {
      alert(err?.message || "Failed to update group.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group) {
    const slug = group.slug || group.id;
    const count = testCounts[slug] || 0;
    const ok = confirm(
      `Delete "${group.label || slug}"?\n\nThis will also delete ${count} mock test(s).`
    );
    if (!ok) return;
    setSaving(true);
    try {
      await deleteMockTestGroup(slug);
      if (editingSlug === slug) setEditingSlug(null);
      await loadGroups();
      alert("Group deleted.");
    } catch (err) {
      alert(err?.message || "Failed to delete group.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CheckAdminAuth>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-[#00448a] text-white flex items-center justify-center">
              <ListChecks className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Mock Tests</h1>
              <p className="text-sm text-slate-600">
                Create company groups, then add mock tests inside each group.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <form
              onSubmit={handleCreate}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-fit"
            >
              <h2 className="font-semibold text-slate-900 mb-4">Create test group</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Company name</label>
                  <input
                    value={form.label}
                    onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="Company name"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Slug is created automatically from the company name.
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00448a] text-white hover:bg-[#003a76] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Create group
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">Test groups</h2>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading groups...</div>
              ) : groups.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No groups yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groups.map((group) => {
                    const slug = group.slug || group.id;
                    const isEditing = editingSlug === slug;
                    return (
                      <div key={slug} className="p-5">
                        {isEditing ? (
                          <form onSubmit={handleUpdate} className="space-y-3">
                            <input
                              value={editForm.label}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, label: e.target.value }))
                              }
                              className="w-full border rounded-lg px-3 py-2"
                            />
                            <input
                              type="number"
                              value={editForm.order}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  order: Number(e.target.value) || 0,
                                }))
                              }
                              className="w-full border rounded-lg px-3 py-2"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-[#00448a] text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSlug(null)}
                                className="px-4 py-2 rounded-lg border"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {group.label || slug}
                              </p>
                              <p className="text-sm text-[#00448a] mt-1">
                                {testCounts[slug] || 0} mock test
                                {(testCounts[slug] || 0) === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/Admin/mock-test/${slug}`}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00448a] text-white hover:bg-[#003a76] text-sm"
                              >
                                Manage tests
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => startEdit(group)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(group)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CheckAdminAuth>
  );
}
