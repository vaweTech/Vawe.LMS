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
import { ListRowSkeleton } from "@/components/PageSkeleton";
import { ChevronRight, ListChecks, Pencil, Plus, Trash2, Users } from "lucide-react";

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
      setLoading(false);
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
      <div className="min-h-screen bg-slate-50 p-4 md:p-6 xl:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5 md:mb-6">
            <div className="h-10 w-10 md:h-11 md:w-11 rounded-xl bg-[#00448a] text-white flex items-center justify-center shrink-0">
              <ListChecks className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Mock Tests</h1>
              <p className="text-xs md:text-sm text-slate-600">
                Create company groups, then add mock tests inside each group.
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[280px_1fr] xl:items-start">
            <form
              onSubmit={handleCreate}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 xl:sticky xl:top-6"
            >
              <h2 className="font-semibold text-slate-900 mb-3 md:mb-4">Create test group</h2>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] xl:grid-cols-1 gap-3 items-end">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Company name</label>
                  <input
                    value={form.label}
                    onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="Company name"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60 md:self-end xl:w-full xl:mt-1"
                >
                  <Plus className="h-4 w-4" />
                  Create group
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Slug is created automatically from the company name.
              </p>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">Test groups</h2>
                <span className="text-xs text-slate-500">{groups.length} groups</span>
              </div>

              {loading ? (
                <ListRowSkeleton count={6} />
              ) : groups.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No groups yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groups.map((group) => {
                    const slug = group.slug || group.id;
                    const isEditing = editingSlug === slug;
                    const count = testCounts[slug] || 0;
                    return (
                      <div key={slug} className="px-4 md:px-5 py-3.5 md:py-4">
                        {isEditing ? (
                          <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-[1fr_100px_auto] gap-2 md:gap-3">
                            <input
                              value={editForm.label}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, label: e.target.value }))
                              }
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-[#00448a] text-white text-sm"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSlug(null)}
                                className="px-4 py-2 rounded-lg border text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900 truncate" title={group.label || slug}>
                                {group.label || slug}
                              </p>
                              <p className="text-xs md:text-sm text-[#00448a] mt-0.5">
                                {count} mock test{count === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Link
                                href={`/Admin/mock-test/${slug}/results`}
                                title="Test Results"
                                className="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 md:px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                              >
                                <Users className="h-4 w-4" />
                                <span className="hidden lg:inline">Results</span>
                              </Link>
                              <Link
                                href={`/Admin/mock-test/${slug}`}
                                className="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 md:px-3 rounded-lg bg-[#00448a] text-white hover:bg-[#003a76] text-sm font-medium"
                              >
                                <span className="hidden sm:inline">Manage</span>
                                <span className="sm:hidden">Tests</span>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => startEdit(group)}
                                title="Edit"
                                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(group)}
                                title="Delete"
                                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
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
