"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import {
  buildMockSectionMap,
  createEmptyMockCodingQuestion,
  createEmptyMockQuestion,
  createMockTest,
  deleteMockTest,
  fetchMockTest,
  fetchMockTestBlocks,
  fetchMockTestGroup,
  fetchMockTestsForCompany,
  getMockQuestionSubSection,
  getMockTestCompanyLabel,
  isMockTestLocked,
  mockSubSectionTimingKey,
  normalizeMockCompanyNames,
  normalizeMockSectionOrder,
  normalizeMockSectionTimings,
  normalizeMockSubSectionOrder,
  normalizeMockSubSectionTimings,
  sanitizeMockQuestions,
  sumMockSubSectionTimingsForSection,
  summarizeMockTestQuestions,
  syncSectionTimingsFromSubSections,
  unblockMockTestAccount,
  updateMockTest,
  updateMockTestGroup,
} from "@/lib/mockTests";
import {
  MOCK_PUBLIC_MODE_RANDOM,
  MOCK_PUBLIC_MODE_SEQUENTIAL,
  buildMockPublicJoinUrl,
  createMockPublicLink, 
  deleteMockPublicLink,
  fetchMockPublicLinks,
  qrCodeImageUrl, 
  updateMockPublicLink,
} from "@/lib/mockTestPublicLinks";
import { parseDayMcqRows } from "@/lib/dayMcqUpload";
import { ListRowSkeleton, StatsSkeleton } from "@/components/PageSkeleton";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  FileQuestion,
  Link2,
  ListChecks,
  Lock,
  Pencil,
  Plus,
  QrCode,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from "lucide-react";

const SCOPE_ALL = "__ALL__";
const SCOPE_UNASSIGNED = "__UNASSIGNED__";

const emptyTestForm = {
  title: "",
  order: 1,
  durationMinutes: 60,
};

function TestLockToggle({ locked, busy, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!locked}
      aria-label={locked ? "Unlock test" : "Lock test"}
      title={locked ? "Unlock test" : "Lock test"}
      disabled={busy}
      onClick={onToggle}
      className={`relative inline-flex h-9 w-[88px] shrink-0 items-center rounded-full p-1 disabled:opacity-60 ${
        locked ? "bg-rose-500" : "bg-emerald-500"
      } transition-colors duration-300 ease-out`}
    >
      <span
        className={`pointer-events-none absolute inset-y-0 flex items-center text-[10px] font-bold uppercase tracking-wide text-white transition-opacity duration-200 ${
          locked ? "right-2.5 opacity-100" : "right-2.5 opacity-0"
        }`}
      >
        Lock
      </span>
      <span
        className={`pointer-events-none absolute inset-y-0 flex items-center text-[10px] font-bold uppercase tracking-wide text-white transition-opacity duration-200 ${
          locked ? "left-2.5 opacity-0" : "left-2.5 opacity-100"
        }`}
      >
        Open
      </span>
      <span
        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          locked ? "translate-x-0" : "translate-x-[52px]"
        }`}
      >
        <Lock
          className={`absolute h-3.5 w-3.5 text-rose-600 transition-all duration-300 ${
            locked ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-12 opacity-0"
          }`}
        />
        <Unlock
          className={`absolute h-3.5 w-3.5 text-emerald-600 transition-all duration-300 ${
            locked ? "scale-50 rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}

function ensureDraftId(q, idx) {
  return {
    ...q,
    draftId: q.draftId || `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
  };
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "upload_preset",
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default"
  );
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!response.ok) throw new Error("Upload failed");
  const data = await response.json();
  return data.secure_url;
}

async function uploadMockQuestionImage(file) {
  if (!file) return "";
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    alert("Cloudinary configuration missing. Please check environment variables.");
    return "";
  }
  try {
    return await uploadToCloudinary(file);
  } catch (e) {
    console.error(e);
    alert("Failed to upload image. Please try again.");
    return "";
  }
}

function QuestionCompanyNamesField({ draftId, companyNames, onUpdate }) {
  const [draft, setDraft] = useState("");
  const list = normalizeMockCompanyNames(companyNames);

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    const exists = list.some((x) => x.toLowerCase() === t.toLowerCase());
    if (!exists) onUpdate(draftId, { companyNames: [...list, t] });
    setDraft("");
  };

  const remove = (tag) => {
    onUpdate(draftId, { companyNames: list.filter((x) => x !== tag) });
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        Company names
      </label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
        {list.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No companies yet</span>
        ) : (
          list.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/90 px-2.5 py-1 text-xs font-medium"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="rounded-full p-0.5 hover:bg-amber-200/80 text-amber-900 leading-none"
                aria-label={`Remove company ${t}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Type a company, then Enter or Add"
          className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
        />
        <button
          type="button"
          onClick={commit}
          className="px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-800 hover:border-[#00448a]/40 hover:text-[#00448a] transition-colors shrink-0"
        >
          Add
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        Add one or more company tags for this question (optional).
      </p>
    </div>
  );
}

function hasUnassignedSections(drafts) {
  return drafts.some((q) => !String(q.section || "").trim());
}

function hasUnassignedSubSections(drafts, sectionScope) {
  if (sectionScope === SCOPE_ALL || sectionScope === SCOPE_UNASSIGNED) return false;
  return drafts.some((q) => {
    if (String(q.section || "").trim() !== sectionScope) return false;
    return !getMockQuestionSubSection(q);
  });
}

function SubSectionTabs({
  scope,
  setScope,
  subSectionNames,
  allLabel = "All sub-sections",
  showUnassigned = false,
}) {
  if (!subSectionNames.length && scope === SCOPE_ALL && !showUnassigned) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-dashed border-gray-200">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-full sm:w-auto">
        Sub-sections
      </p>
      <button
        type="button"
        onClick={() => setScope(SCOPE_ALL)}
        className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
          scope === SCOPE_ALL
            ? "bg-[#26ebe5] text-[#00448a] border-[#26ebe5] shadow-sm"
            : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"
        }`}
      >
        {allLabel}
      </button>
      {subSectionNames.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setScope(name)}
          className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
            scope === name
              ? "bg-[#26ebe5] text-[#00448a] border-[#26ebe5] shadow-sm"
              : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"
          }`}
        >
          {name}
        </button>
      ))}
      {showUnassigned ? (
        <button
          type="button"
          onClick={() => setScope(SCOPE_UNASSIGNED)}
          className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
            scope === SCOPE_UNASSIGNED
              ? "bg-[#26ebe5] text-[#00448a] border-[#26ebe5] shadow-sm"
              : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"
          }`}
        >
          Unassigned
        </button>
      ) : null}
    </div>
  );
}

function filterDraftsByScope(list, sectionScope, subScope) {
  let filtered = list;
  if (sectionScope === SCOPE_UNASSIGNED) {
    filtered = filtered.filter((q) => !String(q.section || "").trim());
  } else if (sectionScope !== SCOPE_ALL) {
    filtered = filtered.filter((q) => String(q.section || "").trim() === sectionScope);
  }
  if (subScope === SCOPE_UNASSIGNED) {
    filtered = filtered.filter((q) => !getMockQuestionSubSection(q));
  } else if (subScope !== SCOPE_ALL) {
    filtered = filtered.filter((q) => getMockQuestionSubSection(q) === subScope);
  }
  return filtered;
}

function scopeTitle(base, sectionScope, subScope) {
  if (sectionScope === SCOPE_ALL) return `${base} (All)`;
  if (sectionScope === SCOPE_UNASSIGNED) return `${base} (Unassigned section)`;
  if (subScope === SCOPE_ALL) return `${base} (${sectionScope})`;
  if (subScope === SCOPE_UNASSIGNED) return `${base} (${sectionScope} — unassigned sub-section)`;
  return `${base} (${sectionScope} › ${subScope})`;
}

function collectSubSectionsForSection(section, sectionMap, drafts) {
  const sec = String(section || "").trim();
  if (!sec) return [];
  const ordered = [];
  const seen = new Set();
  (Array.isArray(sectionMap[sec]) ? sectionMap[sec] : []).forEach((sub) => {
    const name = String(sub || "").trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    ordered.push(name);
  });
  (Array.isArray(drafts) ? drafts : []).forEach((q) => {
    if (String(q.section || "").trim() !== sec) return;
    const sub = getMockQuestionSubSection(q);
    if (!sub || seen.has(sub)) return;
    seen.add(sub);
    ordered.push(sub);
  });
  return ordered;
}

function moveListItem(list, index, direction) {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return list;
  const tmp = next[index];
  next[index] = next[target];
  next[target] = tmp;
  return next;
}

function SectionTabs({ scope, setScope, sectionNames, allLabel, showUnassigned = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setScope(SCOPE_ALL)}
        className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
          scope === SCOPE_ALL
            ? "bg-[#00448a] text-white border-[#00448a] shadow-sm"
            : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"
        }`}
      >
        {allLabel}
      </button>
      {sectionNames.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => setScope(name)}
          className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
            scope === name
              ? "bg-[#00448a] text-white border-[#00448a] shadow-sm"
              : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"
          }`}
          title={`View questions in ${name}`}
        >
          {name}
        </button>
      ))}
      {showUnassigned ? (
        <button
          type="button"
          onClick={() => setScope(SCOPE_UNASSIGNED)}
          className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
            scope === SCOPE_UNASSIGNED
              ? "bg-[#00448a] text-white border-[#00448a] shadow-sm"
              : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"
          }`}
        >
          Unassigned
        </button>
      ) : null}
    </div>
  );
}

export default function AdminMockTestCompanyPage() {
  const { companySlug } = useParams();
  const [group, setGroup] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockingAll, setLockingAll] = useState(false);
  const [lockingTestId, setLockingTestId] = useState(null);
  const [lockedAccountsByTest, setLockedAccountsByTest] = useState({});
  const [unlockingAccountKey, setUnlockingAccountKey] = useState("");
  const [lockedAccountsModalTestId, setLockedAccountsModalTestId] = useState(null);
  const [testForm, setTestForm] = useState(emptyTestForm);
  const [editingTestId, setEditingTestId] = useState(null);
  const [editMeta, setEditMeta] = useState(emptyTestForm);
  const [questionEditId, setQuestionEditId] = useState(null);
  const [questionDrafts, setQuestionDrafts] = useState([]);
  const [passageShareSize, setPassageShareSize] = useState(4);
  const [passageModalDraftId, setPassageModalDraftId] = useState("");
  const [uploadInfo, setUploadInfo] = useState("");
  const [questionType, setQuestionType] = useState("mcq");
  const [sectionMap, setSectionMap] = useState({});
  const [sectionOrder, setSectionOrder] = useState([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSubSectionName, setNewSubSectionName] = useState("");
  const [newSubSectionParent, setNewSubSectionParent] = useState("");
  const [activeMcqScope, setActiveMcqScope] = useState(SCOPE_ALL);
  const [activeMcqSubScope, setActiveMcqSubScope] = useState(SCOPE_ALL);
  const [activeCodingScope, setActiveCodingScope] = useState(SCOPE_ALL);
  const [imageUploadKey, setImageUploadKey] = useState("");
  const [uploadPreview, setUploadPreview] = useState(null);
  const [sectionTimings, setSectionTimings] = useState({});
  const [subSectionTimings, setSubSectionTimings] = useState({});
  const [publicLinks, setPublicLinks] = useState([]);
  const [publicLinksLoading, setPublicLinksLoading] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkTestIds, setLinkTestIds] = useState([]);
  const [linkMode, setLinkMode] = useState("");
  const [showLinkModeModal, setShowLinkModeModal] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState("");
  const [linkOrigin, setLinkOrigin] = useState("");

  const mcqDrafts = useMemo(
    () => questionDrafts.filter((q) => (q?.type || "mcq") === "mcq"),
    [questionDrafts]
  );
  const codingDrafts = useMemo(
    () => questionDrafts.filter((q) => q?.type === "coding"),
    [questionDrafts]
  );

  const discoveredSectionNames = useMemo(() => {
    const names = new Set(Object.keys(sectionMap || {}));
    questionDrafts.forEach((q) => {
      const s = String(q.section || "").trim();
      if (s) names.add(s);
    });
    return Array.from(names);
  }, [sectionMap, questionDrafts]);

  const allSectionNames = useMemo(
    () => normalizeMockSectionOrder(sectionOrder, discoveredSectionNames),
    [sectionOrder, discoveredSectionNames]
  );

  const mcqSectionNames = allSectionNames;
  const codingSectionNames = allSectionNames;

  const activeSectionScope = activeMcqScope;

  const setActiveSectionScope = useCallback((scope) => {
    setActiveMcqScope(scope);
    setActiveCodingScope(scope);
  }, []);

  const sectionSubSectionNames = useMemo(() => {
    if (activeSectionScope === SCOPE_ALL || activeSectionScope === SCOPE_UNASSIGNED) return [];
    return collectSubSectionsForSection(activeSectionScope, sectionMap, questionDrafts);
  }, [activeSectionScope, sectionMap, questionDrafts]);

  const hasMcqUnassignedSection = useMemo(
    () => hasUnassignedSections(mcqDrafts),
    [mcqDrafts]
  );
  const hasCodingUnassignedSection = useMemo(
    () => hasUnassignedSections(codingDrafts),
    [codingDrafts]
  );
  const hasUnassignedSection = hasMcqUnassignedSection || hasCodingUnassignedSection;
  const hasUnassignedSubSection = useMemo(
    () => hasUnassignedSubSections(questionDrafts, activeSectionScope),
    [questionDrafts, activeSectionScope]
  );

  const visibleMcqs = useMemo(
    () => filterDraftsByScope(mcqDrafts, activeSectionScope, activeMcqSubScope),
    [mcqDrafts, activeSectionScope, activeMcqSubScope]
  );

  const visibleCoding = useMemo(
    () => filterDraftsByScope(codingDrafts, activeSectionScope, activeMcqSubScope),
    [codingDrafts, activeSectionScope, activeMcqSubScope]
  );

  useEffect(() => {
    setActiveMcqSubScope(SCOPE_ALL);
  }, [activeSectionScope]);

  useEffect(() => {
    if (!discoveredSectionNames.length) return;
    setSectionOrder((prev) => normalizeMockSectionOrder(prev, discoveredSectionNames));
  }, [discoveredSectionNames]);

  useEffect(() => {
    if (!hasUnassignedSection && activeSectionScope === SCOPE_UNASSIGNED) {
      setActiveSectionScope(SCOPE_ALL);
    }
  }, [hasUnassignedSection, activeSectionScope, setActiveSectionScope]);

  useEffect(() => {
    if (!hasUnassignedSubSection && activeMcqSubScope === SCOPE_UNASSIGNED) {
      setActiveMcqSubScope(SCOPE_ALL);
    }
  }, [hasUnassignedSubSection, activeMcqSubScope]);

  const pageStats = useMemo(() => {
    let mcq = 0;
    let coding = 0;
    tests.forEach((t) => {
      const s = summarizeMockTestQuestions(t.questions);
      mcq += s.mcq;
      coding += s.coding;
    });
    return { mcq, coding, total: tests.length };
  }, [tests]);

  const editingTest = useMemo(
    () => tests.find((t) => t.id === questionEditId) || null,
    [tests, questionEditId]
  );

  function closeQuestionEditor() {
    setQuestionEditId(null);
    setQuestionDrafts([]);
    setSectionMap({});
    setSectionOrder([]);
    setSectionTimings({});
    setSubSectionTimings({});
    setUploadInfo("");
    setPassageModalDraftId("");
  }

  function moveSection(sec, direction) {
    setSectionOrder((prev) => {
      const list = normalizeMockSectionOrder(prev, discoveredSectionNames);
      const index = list.indexOf(sec);
      if (index < 0) return list;
      return moveListItem(list, index, direction);
    });
  }

  function moveSubSection(sec, sub, direction) {
    setSectionMap((prev) => {
      const current = collectSubSectionsForSection(sec, prev, questionDrafts);
      const index = current.indexOf(sub);
      if (index < 0) return prev;
      return {
        ...prev,
        [sec]: moveListItem(current, index, direction),
      };
    });
  }

  const companyLabel = getMockTestCompanyLabel(companySlug, group ? [group] : undefined);

  useEffect(() => {
    if (typeof window !== "undefined") setLinkOrigin(window.location.origin);
  }, []);

  const loadPublicLinks = useCallback(async () => {
    if (!companySlug) return;
    setPublicLinksLoading(true);
    try {
      const list = await fetchMockPublicLinks(companySlug);
      setPublicLinks(list);
    } catch (e) {
      console.error(e);
    } finally {
      setPublicLinksLoading(false);
    }
  }, [companySlug]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, testList] = await Promise.all([
        fetchMockTestGroup(companySlug),
        fetchMockTestsForCompany(companySlug),
      ]);
      setGroup(groupData);
      setTests(testList);
      const blockLists = await Promise.all(
        testList.map((t) => fetchMockTestBlocks(companySlug, t.id).catch(() => []))
      );
      const byTest = {};
      testList.forEach((t, i) => {
        byTest[t.id] = blockLists[i] || [];
      });
      setLockedAccountsByTest(byTest);
      loadPublicLinks();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to load mock tests.");
    } finally {
      setLoading(false);
    }
  }, [companySlug, loadPublicLinks]);

  useEffect(() => {
    if (companySlug) loadData();
  }, [companySlug, loadData]);

  function toggleLinkTest(testId) {
    setLinkTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
    setLinkMode("");
  }

  function moveLinkTest(index, delta) {
    setLinkTestIds((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function finalizeCreatePublicLink(mode) {
    if (linkTestIds.length < 1) {
      alert("Select at least one test.");
      return;
    }
    if (linkTestIds.length > 1 && !mode) {
      alert("Choose random or one-by-one.");
      return;
    }
    setCreatingLink(true);
    try {
      const testTitles = linkTestIds.map(
        (id) => tests.find((t) => t.id === id)?.title || "Mock Test"
      );
      const created = await createMockPublicLink({
        companySlug,
        label: linkLabel,
        testIds: linkTestIds,
        testTitles,
        mode: linkTestIds.length > 1 ? mode : undefined,
      });
      setLinkLabel("");
      setLinkTestIds([]);
      setLinkMode("");
      setShowLinkModeModal(false);
      await loadPublicLinks();
      const url = buildMockPublicJoinUrl(created.id, linkOrigin || window.location.origin);
      alert(
        created.mode === MOCK_PUBLIC_MODE_SEQUENTIAL
          ? `Public link created.\nCandidates take all selected tests one by one.\n${url}`
          : linkTestIds.length > 1
            ? `Public link created.\nEach candidate gets one random paper.\n${url}`
            : `Public link created.\n${url}`
      );
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to create public link.");
    } finally {
      setCreatingLink(false);
    }
  }

  function handleGeneratePublicLink() {
    if (linkTestIds.length < 1) {
      alert("Select at least one test for the public link.");
      return;
    }
    if (linkTestIds.length === 1) {
      finalizeCreatePublicLink(undefined);
      return;
    }
    setShowLinkModeModal(true);
  }

  async function copyPublicLink(id) {
    const url = buildMockPublicJoinUrl(id, linkOrigin || window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(""), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function handleCreateTest(e) {
    e.preventDefault();
    if (!testForm.title.trim()) {
      alert("Enter a test title.");
      return;
    }
    setSaving(true);
    try {
      await createMockTest(companySlug, testForm);
      setTestForm({ ...emptyTestForm, order: tests.length + 1 });
      await loadData();
      alert("Mock test created.");
    } catch (err) {
      alert(err?.message || "Failed to create test.");
    } finally {
      setSaving(false);
    }
  }

  function startEditMeta(test) {
    setEditingTestId(test.id);
    setEditMeta({
      title: test.title || "",
      order: test.order || 1,
      durationMinutes: test.durationMinutes || 60,
    });
    setQuestionEditId(null);
  }

  async function saveMeta() {
    if (!editingTestId) return;
    setSaving(true);
    try {
      await updateMockTest(companySlug, editingTestId, editMeta);
      setEditingTestId(null);
      await loadData();
      alert("Test updated.");
    } catch (err) {
      alert(err?.message || "Failed to update test.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTest(test) {
    const ok = confirm(`Delete "${test.title || test.id}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await deleteMockTest(companySlug, test.id);
      if (questionEditId === test.id) {
        setQuestionEditId(null);
        setQuestionDrafts([]);
      }
      if (editingTestId === test.id) setEditingTestId(null);
      await loadData();
      alert("Test deleted.");
    } catch (err) {
      alert(err?.message || "Failed to delete test.");
    } finally {
      setSaving(false);
    }
  }

  const allTestsLocked =
    tests.length > 0 && tests.every((t) => isMockTestLocked(t, group));

  async function handleToggleAllLocks() {
    const nextLocked = !allTestsLocked;
    const ok = confirm(
      nextLocked
        ? "Lock all tests? Students will not be able to start them until you unlock."
        : "Unlock all tests? Students will be able to start them."
    );
    if (!ok) return;
    setLockingAll(true);
    try {
      await updateMockTestGroup(companySlug, { locked: nextLocked });
      await Promise.all(
        tests.map((t) => updateMockTest(companySlug, t.id, { locked: nextLocked }))
      );
      setGroup((prev) => (prev ? { ...prev, locked: nextLocked } : { locked: nextLocked }));
      setTests((prev) => prev.map((t) => ({ ...t, locked: nextLocked })));
      alert(nextLocked ? "All tests locked." : "All tests unlocked. Students can start them.");
    } catch (err) {
      alert(err?.message || "Failed to update lock.");
    } finally {
      setLockingAll(false);
    }
  }

  async function handleToggleTestLock(test) {
    const currentlyLocked = isMockTestLocked(test, group);
    const nextLocked = !currentlyLocked;
    setLockingTestId(test.id);
    try {
      await updateMockTest(companySlug, test.id, { locked: nextLocked });
      if (!nextLocked && group?.locked) {
        await updateMockTestGroup(companySlug, { locked: false });
        setGroup((prev) => (prev ? { ...prev, locked: false } : prev));
      }
      setTests((prev) =>
        prev.map((t) => (t.id === test.id ? { ...t, locked: nextLocked } : t))
      );
    } catch (err) {
      alert(err?.message || "Failed to update lock.");
    } finally {
      setLockingTestId(null);
    }
  }

  async function handleUnlockAccount(test, account) {
    const accountId = String(account?.userId || account?.id || "").trim();
    if (!accountId) return;
    const label = account?.name || account?.email || accountId;
    if (!confirm(`Unlock "${label}" for this test? They will be allowed to take it again.`)) return;
    const key = `${test.id}:${accountId}`;
    setUnlockingAccountKey(key);
    try {
      await unblockMockTestAccount(companySlug, test.id, accountId);
      setLockedAccountsByTest((prev) => {
        const nextList = (prev[test.id] || []).filter(
          (row) => String(row.userId || row.id) !== accountId
        );
        if (nextList.length === 0) setLockedAccountsModalTestId(null);
        return { ...prev, [test.id]: nextList };
      });
    } catch (err) {
      alert(err?.message || "Failed to unlock this account.");
    } finally {
      setUnlockingAccountKey("");
    }
  }

  async function openQuestionEditor(testId) {
    setSaving(true);
    try {
      const test = await fetchMockTest(companySlug, testId);
      setQuestionEditId(testId);
      setEditingTestId(null);
      setQuestionType("mcq");
      setActiveMcqScope(SCOPE_ALL);
      setActiveMcqSubScope(SCOPE_ALL);
      setActiveCodingScope(SCOPE_ALL);
      setNewSectionName("");
      setNewSubSectionName("");
      setNewSubSectionParent("");
      const loaded = Array.isArray(test?.questions) && test.questions.length
        ? test.questions.map((q, idx) => {
            if (q?.type === "coding") {
              return ensureDraftId(
                {
                  ...createEmptyMockCodingQuestion(),
                  ...q,
                  section: String(q?.section || "").trim(),
                  subSection: getMockQuestionSubSection(q),
                  companyNames: normalizeMockCompanyNames(q?.companyNames ?? q?.companyName),
                  testCases: Array.isArray(q.testCases) && q.testCases.length
                    ? q.testCases.map((tc) => ({
                        input: tc?.input ?? "",
                        output: tc?.output ?? "",
                        hidden: !!tc?.hidden,
                      }))
                    : [{ input: "", output: "", hidden: false }],
                },
                idx
              );
            }
            return ensureDraftId(
              {
                ...createEmptyMockQuestion(),
                ...q,
                companyNames: normalizeMockCompanyNames(q?.companyNames ?? q?.companyName),
                questionImage: String(q?.questionImage || "").trim(),
                options: [...(q.options || ["", "", "", ""])],
              },
              idx
            );
          })
        : [ensureDraftId(createEmptyMockQuestion(), 0)];
      setQuestionDrafts(loaded);
      const map = buildMockSectionMap(loaded);
      const savedSubOrder = normalizeMockSubSectionOrder(test?.subSectionOrder);
      const mergedMap = { ...map };
      Object.entries(savedSubOrder).forEach(([sec, orderedSubs]) => {
        mergedMap[sec] = normalizeMockSectionOrder(
          orderedSubs,
          collectSubSectionsForSection(sec, map, loaded)
        );
      });
      setSectionMap(mergedMap);
      const knownSecs = Array.from(
        new Set([
          ...Object.keys(mergedMap),
          ...loaded.map((q) => String(q.section || "").trim()).filter(Boolean),
        ])
      );
      setSectionOrder(normalizeMockSectionOrder(test?.sectionOrder, knownSecs));
      const loadedSubs = normalizeMockSubSectionTimings(test?.subSectionTimings);
      const sectionToSubs = {};
      Object.keys(mergedMap || {}).forEach((sec) => {
        sectionToSubs[sec] = collectSubSectionsForSection(sec, mergedMap, loaded);
      });
      setSubSectionTimings(loadedSubs);
      setSectionTimings(
        syncSectionTimingsFromSubSections(test?.sectionTimings, loadedSubs, sectionToSubs)
      );
      setUploadInfo("");
    } catch (err) {
      alert(err?.message || "Failed to load questions.");
    } finally {
      setSaving(false);
    }
  }

  function updateQuestionDraftById(draftId, patch) {
    setQuestionDrafts((prev) =>
      prev.map((q) => (q.draftId === draftId ? { ...q, ...patch } : q))
    );
  }

  function updatePassageText(draftId, text) {
    setQuestionDrafts((prev) => {
      const source = prev.find((q) => q.draftId === draftId);
      const group = String(source?.passageGroup || "").trim();
      if (!group) {
        return prev.map((q) => (q.draftId === draftId ? { ...q, description: text } : q));
      }
      return prev.map((q) =>
        String(q?.passageGroup || "").trim() === group ? { ...q, description: text } : q
      );
    });
  }

  function sharePassageWithNext(draftId) {
    const count = Math.max(2, Math.min(10, Number(passageShareSize) || 4));
    const visibleIds = filterDraftsByScope(
      questionDrafts.filter((q) => (q?.type || "mcq") === "mcq"),
      activeSectionScope,
      activeMcqSubScope
    ).map((q) => q.draftId);
    const start = visibleIds.indexOf(draftId);
    if (start < 0) return;
    const targetIds = visibleIds.slice(start, start + count);
    const source = questionDrafts.find((q) => q.draftId === draftId);
    const text = String(source?.description || "").trim();
    if (!text) {
      alert("Write the passage first, then share it with the next questions.");
      return;
    }
    if (targetIds.length < 2) {
      alert("Add the next MCQs in this list, then share the passage with them.");
      return;
    }
    const group =
      String(source?.passageGroup || "").trim() ||
      `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const idSet = new Set(targetIds);
    setQuestionDrafts((prev) =>
      prev.map((q) =>
        idSet.has(q.draftId) ? { ...q, description: text, passageGroup: group } : q
      )
    );
  }

  function removeQuestionDraft(draftId) {
    setQuestionDrafts((prev) => prev.filter((q) => q.draftId !== draftId));
  }

  function updateQuestionDraft(index, patch) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function updateQuestionOption(draftId, optIndex, value) {
    setQuestionDrafts((prev) =>
      prev.map((q) => {
        if (q.draftId !== draftId) return q;
        const options = [...(q.options || ["", "", "", ""])];
        options[optIndex] = value;
        return { ...q, options };
      })
    );
  }

  function toggleCorrectAnswer(draftId, optIndex) {
    setQuestionDrafts((prev) =>
      prev.map((q) => {
        if (q.draftId !== draftId) return q;
        const current = Array.isArray(q.correctAnswers) ? [...q.correctAnswers] : [];
        const exists = current.includes(optIndex);
        const next = exists
          ? current.filter((v) => v !== optIndex)
          : [...current, optIndex].sort((a, b) => a - b);
        return { ...q, correctAnswers: next, isMultiple: next.length > 1 };
      })
    );
  }

  function scopeSection(activeScope) {
    return activeScope === SCOPE_ALL || activeScope === SCOPE_UNASSIGNED ? "" : activeScope;
  }

  function scopeSubSection(activeSubScope) {
    return activeSubScope === SCOPE_ALL || activeSubScope === SCOPE_UNASSIGNED ? "" : activeSubScope;
  }

  function addQuestion(type) {
    const section = scopeSection(activeSectionScope);
    const subSection = scopeSubSection(activeMcqSubScope);
    const base =
      type === "coding"
        ? createEmptyMockCodingQuestion(section, subSection)
        : createEmptyMockQuestion(section, subSection);
    setQuestionDrafts((prev) => [...prev, ensureDraftId(base, prev.length)]);
  }

  function addSection() {
    const n = String(newSectionName || "").trim();
    if (!n) return;
    setSectionMap((prev) => ({ ...prev, [n]: prev[n] || [] }));
    setSectionOrder((prev) => (prev.includes(n) ? prev : [...prev, n]));
    setNewSectionName("");
    setActiveSectionScope(n);
  }

  function addSubSection() {
    const n = String(newSubSectionName || "").trim();
    const section =
      activeSectionScope !== SCOPE_ALL && activeSectionScope !== SCOPE_UNASSIGNED
        ? activeSectionScope
        : String(newSubSectionParent || "").trim();
    if (!n || !section) {
      alert("Select a section first, then add a sub-section.");
      return;
    }
    setSectionMap((prev) => ({
      ...prev,
      [section]: Array.from(new Set([...(prev[section] || []), n])),
    }));
    setNewSubSectionName("");
    setNewSubSectionParent("");
    setActiveSectionScope(section);
    setActiveMcqSubScope(n);
  }

  async function runQuestionImageUpload(file, draftId) {
    setImageUploadKey(`${draftId}:q`);
    const url = await uploadMockQuestionImage(file);
    setImageUploadKey("");
    if (url) updateQuestionDraftById(draftId, { questionImage: url });
  }

  function updateTestCase(draftId, tcIndex, field, value) {
    setQuestionDrafts((prev) =>
      prev.map((q) => {
        if (q.draftId !== draftId) return q;
        const testCases = [...(q.testCases || [{ input: "", output: "", hidden: false }])];
        testCases[tcIndex] = { ...testCases[tcIndex], [field]: value };
        return { ...q, testCases };
      })
    );
  }

  function addTestCase(draftId) {
    setQuestionDrafts((prev) =>
      prev.map((q) => {
        if (q.draftId !== draftId) return q;
        return {
          ...q,
          testCases: [...(q.testCases || []), { input: "", output: "", hidden: false }],
        };
      })
    );
  }

  async function saveQuestions() {
    if (!questionEditId) return;
    const cleaned = sanitizeMockQuestions(questionDrafts);
    if (!cleaned.length) {
      alert("Add at least one valid question.");
      return;
    }
    setSaving(true);
    try {
      const sectionToSubs = {};
      Object.keys(sectionMap || {}).forEach((sec) => {
        sectionToSubs[sec] = collectSubSectionsForSection(sec, sectionMap, cleaned);
      });
      const cleanedSubs = normalizeMockSubSectionTimings(subSectionTimings);
      const cleanedSections = syncSectionTimingsFromSubSections(
        sectionTimings,
        cleanedSubs,
        sectionToSubs
      );
      const knownSecs = Array.from(
        new Set([
          ...Object.keys(sectionMap || {}),
          ...cleaned.map((q) => String(q.section || "").trim()).filter(Boolean),
        ])
      );
      const cleanedSectionOrder = normalizeMockSectionOrder(sectionOrder, knownSecs);
      const cleanedSubSectionOrder = {};
      cleanedSectionOrder.forEach((sec) => {
        const subs = collectSubSectionsForSection(sec, sectionMap, cleaned);
        if (subs.length) cleanedSubSectionOrder[sec] = subs;
      });
      await updateMockTest(companySlug, questionEditId, {
        questions: cleaned,
        sectionTimings: cleanedSections,
        subSectionTimings: cleanedSubs,
        sectionOrder: cleanedSectionOrder,
        subSectionOrder: normalizeMockSubSectionOrder(cleanedSubSectionOrder),
      });
      setQuestionEditId(null);
      setQuestionDrafts([]);
      setSectionOrder([]);
      setSectionTimings({});
      setSubSectionTimings({});
      await loadData();
      alert("Questions saved.");
    } catch (err) {
      alert(err?.message || "Failed to save questions.");
    } finally {
      setSaving(false);
    }
  }

  function applyUploadedQuestions(questions, mode = "append") {
    const incoming = sanitizeMockQuestions(questions).map((q, idx) => {
      if (q.type === "coding") {
        return ensureDraftId(
          {
            ...createEmptyMockCodingQuestion(q.section, getMockQuestionSubSection(q)),
            ...q,
            subSection: getMockQuestionSubSection(q),
            companyNames: normalizeMockCompanyNames(q?.companyNames),
          },
          idx
        );
      }
      return ensureDraftId(
        {
          ...createEmptyMockQuestion(q.section),
          ...q,
          companyNames: normalizeMockCompanyNames(q?.companyNames),
        },
        idx
      );
    });
    if (!incoming.length) {
      alert("No valid questions to apply.");
      return;
    }
    setQuestionDrafts((prev) => {
      const base =
        prev.length === 1 && !String(prev[0]?.question || "").trim() ? [] : prev;
      return mode === "replace" ? incoming : [...base, ...incoming];
    });
    setSectionMap((prev) => {
      const merged = { ...prev, ...buildMockSectionMap(incoming) };
      incoming.forEach((q) => {
        const sec = String(q.section || "").trim();
        const sub = getMockQuestionSubSection(q);
        if (sec && sub) {
          merged[sec] = Array.from(new Set([...(merged[sec] || []), sub]));
        }
      });
      return merged;
    });
    setUploadInfo(`Attached ${incoming.length} question(s). Remember to Save.`);
    setUploadPreview(null);
  }

  function openUploadPreview(questions, errors = [], fileName = "") {
    const cleaned = sanitizeMockQuestions(questions);
    if (!cleaned.length) {
      alert("No valid questions found in the file.");
      return;
    }
    setUploadPreview({
      questions: cleaned,
      errors: Array.isArray(errors) ? errors : [],
      fileName: fileName || "Uploaded file",
    });
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { questions, errors } = parseDayMcqRows(results.data || []);
        openUploadPreview(questions, errors, file.name);
      },
      error: (err) => alert(err?.message || "CSV parse failed."),
    });
    e.target.value = "";
  }

  async function handleExcelUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readXlsxFile(file);
      if (!rows.length) {
        alert("Excel file is empty.");
        return;
      }
      const [headerRow, ...bodyRows] = rows;
      const headers = headerRow.map((h) => String(h || "").trim());
      const data = bodyRows
        .map((row) => {
          const obj = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] == null ? "" : String(row[idx]).trim();
          });
          return obj;
        })
        .filter((row) => Object.values(row).some(Boolean));
      const { questions, errors } = parseDayMcqRows(data);
      openUploadPreview(questions, errors, file.name);
    } catch (err) {
      alert(err?.message || "Excel parse failed.");
    }
    e.target.value = "";
  }

  return (
    <CheckAdminAuth>
      {uploadPreview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-preview-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 id="upload-preview-title" className="text-lg font-bold text-slate-900">
                  Preview uploaded questions
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {uploadPreview.fileName} · {uploadPreview.questions.length} question
                  {uploadPreview.questions.length === 1 ? "" : "s"}
                  {uploadPreview.errors?.length
                    ? ` · ${uploadPreview.errors.length} row warning(s)`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadPreview(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/80">
              {uploadPreview.questions.map((q, idx) => {
                const isCoding = q.type === "coding";
                const options = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {idx + 1}.
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          isCoding
                            ? "bg-violet-50 text-violet-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {isCoding ? "Coding" : "MCQ"}
                      </span>
                      {q.section ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#26ebe5]/15 text-[#00448a]">
                          {q.section}
                          {q.subSection ? ` › ${q.subSection}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">
                      {q.question || q.title || "Untitled question"}
                    </p>
                    {!isCoding && options.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {options.map((opt, oi) => (
                          <li
                            key={oi}
                            className={`text-xs px-2 py-1 rounded border ${
                              (q.correctAnswers || []).includes(oi)
                                ? "border-green-300 bg-green-50 text-green-800"
                                : "border-slate-100 text-slate-600"
                            }`}
                          >
                            {String.fromCharCode(65 + oi)}. {opt}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {isCoding && Array.isArray(q.testCases) && q.testCases.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {q.testCases.length} test case{q.testCases.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUploadPreview(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyUploadedQuestions(uploadPreview.questions, "append")}
                className="px-5 py-2.5 rounded-xl bg-[#00448a] text-white text-sm font-semibold hover:bg-[#003a76] shadow-sm"
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLinkModeModal ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-link-mode-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 id="public-link-mode-title" className="text-lg font-bold text-slate-900">
                  How should candidates get these tests?
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  You selected {linkTestIds.length} tests. Choose one option.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModeModal(false);
                  setLinkMode("");
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                {
                  value: MOCK_PUBLIC_MODE_RANDOM,
                  title: "Random question paper",
                  hint: "When a candidate opens the link, they get one random paper from the selected tests.",
                },
                {
                  value: MOCK_PUBLIC_MODE_SEQUENTIAL,
                  title: "One by one — all tests",
                  hint: "Each candidate takes every selected test, in the order below.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 cursor-pointer ${
                    linkMode === opt.value
                      ? "border-[#00448a]/40 bg-[#00448a]/5"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="mock-public-link-mode"
                    value={opt.value}
                    checked={linkMode === opt.value}
                    onChange={() => setLinkMode(opt.value)}
                    className="mt-1 text-[#00448a] focus:ring-[#00448a]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{opt.hint}</span>
                  </span>
                </label>
              ))}

              {!linkMode ? (
                <p className="text-xs font-medium text-amber-700">Please choose one option to continue.</p>
              ) : null}

              {linkMode === MOCK_PUBLIC_MODE_SEQUENTIAL ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Test order
                  </p>
                  <ol className="space-y-2">
                    {linkTestIds.map((id, i) => (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                      >
                        <span className="w-6 text-sm font-semibold text-[#00448a]">{i + 1}.</span>
                        <span className="flex-1 min-w-0 truncate text-sm text-slate-900">
                          {tests.find((t) => t.id === id)?.title || "Untitled"}
                        </span>
                        <button
                          type="button"
                          onClick={() => moveLinkTest(i, -1)}
                          disabled={i === 0}
                          className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-white disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLinkTest(i, 1)}
                          disabled={i === linkTestIds.length - 1}
                          className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-white disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => finalizeCreatePublicLink(linkMode)}
                disabled={creatingLink || !linkMode}
                className="w-full mt-2 px-4 py-3 text-sm font-semibold rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] disabled:opacity-60"
              >
                {creatingLink ? "Generating…" : "Generate link & QR code"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lockedAccountsModalTestId ? (() => {
        const modalTest = tests.find((t) => t.id === lockedAccountsModalTestId);
        const modalAccounts = lockedAccountsByTest[lockedAccountsModalTestId] || [];
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="locked-accounts-title"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="locked-accounts-title" className="text-lg font-bold text-slate-900">
                    Locked accounts
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate">
                    {modalTest?.title || "This test"} · {modalAccounts.length} locked
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLockedAccountsModalTestId(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {modalAccounts.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 text-center">
                    No locked accounts for this test.
                  </p>
                ) : (
                  modalAccounts.map((account) => {
                    const accountId = String(account.userId || account.id || "");
                    const key = `${lockedAccountsModalTestId}:${accountId}`;
                    return (
                      <div key={accountId} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {account.name || account.email || accountId}
                          </p>
                          {account.email ? (
                            <p className="text-xs text-slate-500 truncate">{account.email}</p>
                          ) : null}
                          <p className="text-[11px] text-orange-700 mt-0.5 truncate">
                            {account.reason || "Locked after tab switches"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlockAccount(modalTest, account)}
                          disabled={unlockingAccountKey === key || !modalTest}
                          className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60 shrink-0"
                        >
                          <Unlock className="h-4 w-4" />
                          {unlockingAccountKey === key ? "…" : "Unlock"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })() : null}

      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {!questionEditId ? (
            <>
              <Link
                href="/Admin/mock-test"
                className="inline-flex items-center gap-2 text-sm text-[#00448a] hover:underline mb-5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to groups
              </Link>

              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-2xl bg-[#00448a] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#00448a]/20">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00448a]/70">
                      Mock test group
                    </p>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{companyLabel}</h1>
                    <p className="text-xs md:text-sm text-slate-600 mt-0.5">
                      Manage tests, sections, and questions for this company.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleAllLocks}
                    disabled={lockingAll || tests.length === 0}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-white disabled:opacity-60 ${
                      allTestsLocked
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    {allTestsLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {lockingAll ? "…" : allTestsLocked ? "Unlock all" : "Lock all"}
                  </button>
                  <Link
                    href={`/Admin/mock-test/${companySlug}/results`}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Results</span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 md:mb-6">
                {[
                  { label: "Tests", value: pageStats.total, icon: ListChecks, tone: "bg-[#00448a]/10 text-[#00448a]" },
                  { label: "MCQ", value: pageStats.mcq, icon: FileQuestion, tone: "bg-blue-50 text-blue-700" },
                  { label: "Coding", value: pageStats.coding, icon: Code2, tone: "bg-violet-50 text-violet-700" },
                  {
                    label: "Sections",
                    value: new Set(tests.flatMap((t) => summarizeMockTestQuestions(t.questions).sections)).size,
                    icon: Clock,
                    tone: "bg-cyan-50 text-cyan-800",
                  },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <div
                    key={label}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3"
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-xl font-bold text-slate-900">{loading ? "—" : value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-5 md:mb-6 grid gap-5 lg:grid-cols-2">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-[#00448a]/10 text-[#00448a] flex items-center justify-center shrink-0">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">Public test link</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No LMS login. Candidates enter name, college, branch, and verify mobile on WhatsApp.
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Link label (optional)</label>
                    <input
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      placeholder="e.g. Campus drive — Day 1"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                    />
                  </div>

                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Select tests
                  </p>
                  {tests.length === 0 ? (
                    <p className="text-sm text-slate-500 mb-3">Create a test first, then generate a public link.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100 mb-3">
                      {tests.map((test) => {
                        const checked = linkTestIds.includes(test.id);
                        return (
                          <label
                            key={test.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${
                              checked ? "bg-[#00448a]/5" : "hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLinkTest(test.id)}
                              className="rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                              {test.title || "Untitled test"}
                            </span>
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {summarizeMockTestQuestions(test.questions).mcq +
                                summarizeMockTestQuestions(test.questions).coding}{" "}
                              Q
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {linkTestIds.length > 1 ? (
                    <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Multiple tests selected — you will choose <strong>one by one</strong> or{" "}
                      <strong>random paper</strong> next.
                    </div>
                  ) : linkTestIds.length === 1 ? (
                    <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Single test — generates a direct public link to that paper.
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleGeneratePublicLink}
                    disabled={creatingLink || linkTestIds.length === 0}
                    className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] disabled:opacity-60 text-sm font-semibold shadow-sm"
                  >
                    <QrCode className="h-4 w-4" />
                    {creatingLink ? "Generating…" : "Generate link & QR"}
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">Your public links</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {publicLinksLoading ? "Loading…" : `${publicLinks.length} link(s)`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadPublicLinks}
                      disabled={publicLinksLoading}
                      className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:border-[#00448a]/30 disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  </div>

                  {publicLinks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-10 px-4 text-center text-sm text-slate-500">
                      No public links yet. Select tests on the left and generate one.
                    </div>
                  ) : (
                    <ul className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                      {publicLinks.map((link) => {
                        const joinUrl = buildMockPublicJoinUrl(link.id, linkOrigin);
                        const qrUrl = qrCodeImageUrl(joinUrl, 160);
                        const titles = (link.testIds || []).map(
                          (id, i) =>
                            tests.find((t) => t.id === id)?.title ||
                            link.testTitles?.[i] ||
                            id
                        );
                        return (
                          <li
                            key={link.id}
                            className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4"
                          >
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="shrink-0 flex flex-col items-center gap-1.5">
                                <Image
                                  src={qrUrl}
                                  alt={`QR for ${link.label || "public link"}`}
                                  width={160}
                                  height={160}
                                  unoptimized
                                  className="rounded-lg border border-slate-200 bg-white p-1"
                                />
                                <a
                                  href={qrUrl}
                                  download={`mock-public-${link.id}.png`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium text-[#00448a] hover:underline"
                                >
                                  Download QR
                                </a>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <p className="font-semibold text-slate-900">
                                    {link.label || "Untitled link"}
                                  </p>
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                      link.active !== false
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {link.active !== false ? "Active" : "Inactive"}
                                  </span>
                                  {(link.testIds || []).length > 1 ? (
                                    <span
                                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                        link.mode === MOCK_PUBLIC_MODE_SEQUENTIAL
                                          ? "bg-indigo-100 text-indigo-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {link.mode === MOCK_PUBLIC_MODE_SEQUENTIAL
                                        ? "One by one"
                                        : "Random paper"}
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800">
                                      Direct
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                                  {titles.join(", ") || "—"}
                                </p>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <input
                                    readOnly
                                    value={joinUrl}
                                    className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => copyPublicLink(link.id)}
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:border-[#00448a]/40"
                                  >
                                    {copiedLinkId === link.id ? "Copied!" : "Copy"}
                                  </button>
                                  <a
                                    href={joinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#00448a] text-white hover:bg-[#003a76]"
                                  >
                                    Open
                                  </a>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await updateMockPublicLink(link.id, {
                                          active: link.active === false,
                                        });
                                        await loadPublicLinks();
                                      } catch (e) {
                                        alert(e?.message || "Failed to update link.");
                                      }
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white"
                                  >
                                    {link.active === false ? "Activate" : "Deactivate"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm("Delete this public link?")) return;
                                      try {
                                        await deleteMockPublicLink(link.id);
                                        await loadPublicLinks();
                                      } catch (e) {
                                        alert(e?.message || "Failed to delete link.");
                                      }
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[260px_1fr] xl:items-start">
                <form
                  onSubmit={handleCreateTest}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 xl:sticky xl:top-6"
                >
                  <h2 className="font-semibold text-slate-900 mb-0.5">New mock test</h2>
                  <p className="text-xs text-slate-500 mb-3">Add a test, then open it to add questions.</p>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_88px_88px_auto] xl:grid-cols-1 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                      <input
                        value={testForm.title}
                        onChange={(e) => setTestForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Mock Test 1"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Order</label>
                      <input
                        type="number"
                        value={testForm.order}
                        onChange={(e) =>
                          setTestForm((p) => ({ ...p, order: Number(e.target.value) || 1 }))
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Minutes</label>
                      <input
                        type="number"
                        value={testForm.durationMinutes}
                        onChange={(e) =>
                          setTestForm((p) => ({
                            ...p,
                            durationMinutes: Number(e.target.value) || 60,
                          }))
                        }
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] disabled:opacity-60 text-sm font-semibold shadow-sm xl:w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Create
                    </button>
                  </div>
                </form>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">Tests</h2>
                    <span className="text-xs text-slate-500">
                      {loading ? "Loading…" : `${tests.length} total`}
                    </span>
                  </div>

                  {loading ? (
                    <ListRowSkeleton count={4} />
                  ) : tests.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-slate-600 font-medium">No mock tests yet</p>
                      <p className="text-sm text-slate-500 mt-1">Create your first test using the form.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {tests.map((test, index) => {
                        const summary = summarizeMockTestQuestions(
                          test.questions,
                          test.sectionOrder
                        );
                        const isEditingMeta = editingTestId === test.id;
                        const testLocked = isMockTestLocked(test, group);
                        const lockedAccounts = lockedAccountsByTest[test.id] || [];

                        if (isEditingMeta) {
                          return (
                            <div key={test.id} className="p-5 bg-slate-50/80">
                              <p className="text-xs font-semibold text-[#00448a] uppercase mb-3">Edit test details</p>
                              <div className="space-y-3 max-w-lg">
                                <input
                                  value={editMeta.title}
                                  onChange={(e) =>
                                    setEditMeta((p) => ({ ...p, title: e.target.value }))
                                  }
                                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                                  placeholder="Title"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                  <input
                                    type="number"
                                    value={editMeta.order}
                                    onChange={(e) =>
                                      setEditMeta((p) => ({
                                        ...p,
                                        order: Number(e.target.value) || 1,
                                      }))
                                    }
                                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                                    placeholder="Order"
                                  />
                                  <input
                                    type="number"
                                    value={editMeta.durationMinutes}
                                    onChange={(e) =>
                                      setEditMeta((p) => ({
                                        ...p,
                                        durationMinutes: Number(e.target.value) || 60,
                                      }))
                                    }
                                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                                    placeholder="Duration"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={saveMeta}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTestId(null)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={test.id}
                            className="px-4 md:px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-[#00448a]/10 text-[#00448a] flex items-center justify-center font-bold text-sm shrink-0">
                                {index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-slate-900 truncate">
                                  {test.title || `Mock Test ${index + 1}`}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span
                                    className={`inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                                      testLocked
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {testLocked ? "Locked" : "Open"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                                    <FileQuestion className="h-3 w-3" />
                                    {summary.mcq}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                                    <Code2 className="h-3 w-3" />
                                    {summary.coding}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                    <Clock className="h-3 w-3" />
                                    {test.durationMinutes || 60}m
                                  </span>
                                  {summary.sections.slice(0, 2).map((sec) => (
                                    <span
                                      key={sec}
                                      className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-[#26ebe5]/15 text-[#00448a] font-medium"
                                    >
                                      {sec}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <TestLockToggle
                                  locked={testLocked}
                                  busy={lockingTestId === test.id}
                                  onToggle={() => handleToggleTestLock(test)}
                                />
                                <button
                                  type="button"
                                  onClick={() => setLockedAccountsModalTestId(test.id)}
                                  title="Locked accounts"
                                  className="inline-flex items-center justify-center gap-1 h-9 px-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-800 text-sm font-medium hover:bg-orange-100"
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                  <span className="hidden lg:inline">Locked</span>
                                  <span className="text-[11px] font-semibold">
                                    {lockedAccounts.length}
                                  </span>
                                </button>
                                <Link
                                  href={`/Admin/mock-test/${companySlug}/results?test=${test.id}`}
                                  title="Results"
                                  className="inline-flex items-center justify-center gap-1 h-9 px-2.5 rounded-xl border border-slate-200 text-sm hover:bg-white"
                                >
                                  <Users className="h-4 w-4" />
                                  <span className="hidden lg:inline">Results</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => openQuestionEditor(test.id)}
                                  className="inline-flex items-center justify-center gap-1 h-9 px-2.5 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] shadow-sm"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="hidden sm:inline">Questions</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditMeta(test)}
                                  title="Edit"
                                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 text-sm hover:bg-white"
                                >
                                  <Settings2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTest(test)}
                                  title="Delete"
                                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <button
                      type="button"
                      onClick={closeQuestionEditor}
                      className="inline-flex items-center gap-2 text-sm text-[#00448a] hover:underline mb-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to tests
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {editingTest?.title || "Edit questions"}
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {mcqDrafts.length} MCQ · {codingDrafts.length} Coding ·{" "}
                      {editingTest?.durationMinutes || 60} min
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer hover:border-[#00448a]/30">
                      <Upload className="h-4 w-4" />
                      CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                    </label>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer hover:border-[#00448a]/30">
                      <Upload className="h-4 w-4" />
                      Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleExcelUpload}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={saveQuestions}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00448a] text-white text-sm font-semibold hover:bg-[#003a76] disabled:opacity-60 shadow-sm"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={closeQuestionEditor}
                      className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-sm hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      Close
                    </button>
                  </div>
                </div>
                {uploadInfo ? (
                  <p className="max-w-6xl mx-auto mt-2 text-sm text-emerald-700">{uploadInfo}</p>
                ) : null}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                          <div className="mb-4">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              Sections
                            </p>
                            <SectionTabs
                              scope={activeSectionScope}
                              setScope={setActiveSectionScope}
                              sectionNames={allSectionNames}
                              allLabel="All sections"
                              showUnassigned={hasUnassignedSection}
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mb-4">
                            <select
                              value={questionType}
                              onChange={(e) => setQuestionType(e.target.value)}
                              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                              title="Question type to add"
                            >
                              <option value="mcq">Add as MCQ</option>
                              <option value="coding">Add as Coding</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => addQuestion(questionType)}
                              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00448a] text-white hover:bg-[#003a76] shadow-sm transition-colors"
                            >
                              Add question
                            </button>
                          </div>

                          <div className="mb-4 space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                Create section
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={newSectionName}
                                  onChange={(e) => setNewSectionName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addSection();
                                    }
                                  }}
                                  placeholder="New section name"
                                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={addSection}
                                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                                >
                                  Add section
                                </button>
                              </div>
                            </div>
                            {allSectionNames.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                  Sub-sections
                                  {activeSectionScope !== SCOPE_ALL &&
                                  activeSectionScope !== SCOPE_UNASSIGNED
                                    ? ` for ${activeSectionScope}`
                                    : ""}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {(activeSectionScope === SCOPE_ALL ||
                                    activeSectionScope === SCOPE_UNASSIGNED) && (
                                    <select
                                      value={newSubSectionParent}
                                      onChange={(e) => setNewSubSectionParent(e.target.value)}
                                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[140px]"
                                    >
                                      <option value="">Select section</option>
                                      {allSectionNames.map((name) => (
                                        <option key={name} value={name}>
                                          {name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <input
                                    type="text"
                                    value={newSubSectionName}
                                    onChange={(e) => setNewSubSectionName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addSubSection();
                                      }
                                    }}
                                    placeholder="New sub-section name (e.g. Easy, Hard)"
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addSubSection()}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] transition-colors"
                                  >
                                    Add sub-section
                                  </button>
                                </div>
                              </div>
                            )}

                            {(mcqSectionNames.length > 0 || codingSectionNames.length > 0) && (
                              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      Section / sub-section timings
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Leave blank for free navigation with the overall test time.
                                      When sub-sections have times, section minutes auto-equal their total.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSectionTimings({});
                                      setSubSectionTimings({});
                                    }}
                                    className="text-xs font-medium text-slate-600 hover:text-[#00448a]"
                                  >
                                    Clear all timings
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  {allSectionNames.map((sec, secIdx) => {
                                    const subs = collectSubSectionsForSection(
                                      sec,
                                      sectionMap,
                                      questionDrafts
                                    );
                                    const subTotal = sumMockSubSectionTimingsForSection(
                                      sec,
                                      subSectionTimings,
                                      subs
                                    );
                                    const sectionLockedToSubs = subs.length > 0 && subTotal > 0;
                                    const sectionMinutes = sectionLockedToSubs
                                      ? subTotal
                                      : sectionTimings[sec] ?? "";
                                    return (
                                      <div
                                        key={sec}
                                        className="rounded-lg border border-slate-200 bg-white p-3"
                                      >
                                        <div className="flex flex-wrap items-center gap-3">
                                          <div className="flex items-center gap-1.5 min-w-[140px]">
                                            <div className="flex flex-col shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => moveSection(sec, -1)}
                                                disabled={secIdx === 0}
                                                className="p-0.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move section up"
                                              >
                                                <ChevronUp className="h-4 w-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => moveSection(sec, 1)}
                                                disabled={secIdx === allSectionNames.length - 1}
                                                className="p-0.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move section down"
                                              >
                                                <ChevronDown className="h-4 w-4" />
                                              </button>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800">
                                              {sec}
                                            </p>
                                          </div>
                                          <label className="flex items-center gap-2 text-xs text-slate-600">
                                            <span>Minutes</span>
                                            <input
                                              type="number"
                                              min={0}
                                              value={sectionMinutes}
                                              readOnly={sectionLockedToSubs}
                                              onChange={(e) => {
                                                if (sectionLockedToSubs) return;
                                                const v = e.target.value;
                                                setSectionTimings((prev) => {
                                                  const next = { ...prev };
                                                  if (v === "" || Number(v) <= 0) delete next[sec];
                                                  else next[sec] = Number(v);
                                                  return next;
                                                });
                                              }}
                                              placeholder="—"
                                              className={`w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm ${
                                                sectionLockedToSubs
                                                  ? "bg-slate-100 text-slate-700 cursor-default"
                                                  : "bg-white"
                                              }`}
                                              title={
                                                sectionLockedToSubs
                                                  ? "Equals total of sub-section times"
                                                  : "Section time in minutes"
                                              }
                                            />
                                          </label>
                                          {!subs.length ? (
                                            <span className="text-[11px] text-slate-400">
                                              Section time for this whole section
                                            </span>
                                          ) : null}
                                        </div>
                                        {subs.length > 0 ? (
                                          <div className="mt-2 grid sm:grid-cols-2 gap-2 pl-0 sm:pl-2">
                                            {subs.map((sub, subIdx) => {
                                              const key = mockSubSectionTimingKey(sec, sub);
                                              return (
                                                <div
                                                  key={key}
                                                  className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs"
                                                >
                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="flex flex-col shrink-0">
                                                      <button
                                                        type="button"
                                                        onClick={() => moveSubSection(sec, sub, -1)}
                                                        disabled={subIdx === 0}
                                                        className="p-0.5 rounded text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Move sub-section up"
                                                      >
                                                        <ChevronUp className="h-3.5 w-3.5" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => moveSubSection(sec, sub, 1)}
                                                        disabled={subIdx === subs.length - 1}
                                                        className="p-0.5 rounded text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Move sub-section down"
                                                      >
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                      </button>
                                                    </div>
                                                    <span className="text-slate-700 truncate">
                                                      {sub}
                                                    </span>
                                                  </div>
                                                  <label className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-slate-500">min</span>
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      value={subSectionTimings[key] ?? ""}
                                                      onChange={(e) => {
                                                        const v = e.target.value;
                                                        setSubSectionTimings((prev) => {
                                                          const next = { ...prev };
                                                          if (v === "" || Number(v) <= 0) {
                                                            delete next[key];
                                                          } else {
                                                            next[key] = Number(v);
                                                          }
                                                          const sum =
                                                            sumMockSubSectionTimingsForSection(
                                                              sec,
                                                              next,
                                                              subs
                                                            );
                                                          setSectionTimings((prevSec) => {
                                                            const secNext = { ...prevSec };
                                                            if (sum > 0) secNext[sec] = sum;
                                                            else delete secNext[sec];
                                                            return secNext;
                                                          });
                                                          return next;
                                                        });
                                                      }}
                                                      placeholder="—"
                                                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"
                                                    />
                                                  </label>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {(sectionSubSectionNames.length > 0 ||
                            hasUnassignedSubSection ||
                            (activeSectionScope !== SCOPE_ALL &&
                              activeSectionScope !== SCOPE_UNASSIGNED)) && (
                            <div className="mb-4">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                Sub-sections (MCQ &amp; Coding)
                              </p>
                              <SubSectionTabs
                                scope={activeMcqSubScope}
                                setScope={setActiveMcqSubScope}
                                subSectionNames={sectionSubSectionNames}
                                showUnassigned={hasUnassignedSubSection}
                              />
                            </div>
                          )}

                          <div className="mb-8">
                              <div className="flex items-center justify-between mb-3 mt-2">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {scopeTitle("MCQ Questions", activeSectionScope, activeMcqSubScope)}
                                </h3>
                                <span className="text-xs text-gray-600">{visibleMcqs.length} item(s)</span>
                              </div>
                              <div className="space-y-4">
                                {visibleMcqs.map((q, idx) => (
                                  <div
                                    key={q.draftId}
                                    className="rounded-2xl border border-gray-200 bg-gray-50/30 p-4 sm:p-5 shadow-sm hover:border-[#00448a]/20 transition-colors"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-sm font-medium text-gray-700">
                                        {idx + 1}. MCQ
                                      </span>
                                      <div className="flex items-center gap-2 flex-wrap justify-end">
                                        <select
                                          value={String(q.section || "").trim()}
                                          onChange={(e) =>
                                            updateQuestionDraftById(q.draftId, {
                                              section: e.target.value,
                                              subSection: "",
                                            })
                                          }
                                          className="text-xs border rounded px-2 py-1 bg-white"
                                          title="Section"
                                        >
                                          <option value="">Unassigned</option>
                                          {allSectionNames.map((name) => (
                                            <option key={name} value={name}>
                                              {name}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={getMockQuestionSubSection(q)}
                                          onChange={(e) =>
                                            updateQuestionDraftById(q.draftId, {
                                              subSection: e.target.value,
                                            })
                                          }
                                          className="text-xs border rounded px-2 py-1 bg-white"
                                          title="Sub-section"
                                          disabled={!String(q.section || "").trim()}
                                        >
                                          <option value="">Unassigned</option>
                                          {collectSubSectionsForSection(
                                            q.section,
                                            sectionMap,
                                            questionDrafts
                                          ).map((name) => (
                                            <option key={name} value={name}>
                                              {name}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => removeQuestionDraft(q.draftId)}
                                          className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <QuestionCompanyNamesField
                                      draftId={q.draftId}
                                      companyNames={q.companyNames}
                                      onUpdate={updateQuestionDraftById}
                                    />
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setPassageModalDraftId(q.draftId)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                          String(q.description || "").trim()
                                            ? "bg-sky-50 border-sky-200 text-[#00448a] hover:bg-sky-100"
                                            : "bg-white border-gray-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                      >
                                        Passage / paragraph (optional)
                                        {String(q.description || "").trim() ? " · Added" : ""}
                                      </button>
                                      {String(q.passageGroup || "").trim() ? (
                                        <span className="text-[11px] text-[#00448a]">
                                          Shared with{" "}
                                          {
                                            questionDrafts.filter(
                                              (item) =>
                                                String(item.passageGroup || "").trim() ===
                                                String(q.passageGroup || "").trim()
                                            ).length
                                          }{" "}
                                          questions
                                        </span>
                                      ) : null}
                                    </div>
                                    <textarea
                                      value={q.question || ""}
                                      onChange={(e) =>
                                        updateQuestionDraftById(q.draftId, {
                                          question: e.target.value,
                                        })
                                      }
                                      rows={4}
                                      placeholder="Question — type or paste text"
                                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                                    />
                                    <div className="mb-3 rounded-lg border border-gray-200 bg-white/80 px-3 py-2">
                                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                        Question image (optional)
                                      </label>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          disabled={imageUploadKey === `${q.draftId}:q`}
                                          onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = "";
                                            if (f) runQuestionImageUpload(f, q.draftId);
                                          }}
                                          className="text-xs w-full sm:w-auto max-w-[220px] border rounded-lg px-2 py-1.5 bg-white"
                                        />
                                        {imageUploadKey === `${q.draftId}:q` ? (
                                          <span className="text-xs text-gray-500">Uploading…</span>
                                        ) : null}
                                        {q.questionImage ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateQuestionDraftById(q.draftId, { questionImage: "" })
                                            }
                                            className="text-xs font-medium text-red-600 hover:text-red-700"
                                          >
                                            Remove image
                                          </button>
                                        ) : null}
                                      </div>
                                      {q.questionImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={q.questionImage}
                                          alt=""
                                          className="mt-2 max-h-44 w-full max-w-md rounded-lg border border-gray-200 object-contain bg-white"
                                        />
                                      ) : null}
                                    </div>
                                    <div className="space-y-2">
                                      {(q.options || ["", "", "", ""]).map((opt, optIdx) => (
                                        <div key={optIdx} className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={(q.correctAnswers || []).includes(optIdx)}
                                            onChange={() => toggleCorrectAnswer(q.draftId, optIdx)}
                                            title="Mark as correct answer"
                                          />
                                          <input
                                            value={opt}
                                            onChange={(e) =>
                                              updateQuestionOption(q.draftId, optIdx, e.target.value)
                                            }
                                            placeholder={`Option ${optIdx + 1}`}
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          <div className="mb-8">
                              <div className="flex items-center justify-between mb-3 mt-2">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {scopeTitle("Coding Questions", activeSectionScope, activeMcqSubScope)}
                                </h3>
                                <span className="text-xs text-gray-600">{visibleCoding.length} item(s)</span>
                              </div>
                              <div className="space-y-4">
                                {visibleCoding.map((q, idx) => (
                                  <div
                                    key={q.draftId}
                                    className="rounded-2xl border border-gray-200 bg-gray-50/30 p-4 sm:p-5 shadow-sm hover:border-[#00448a]/20 transition-colors"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-sm font-medium text-gray-700">
                                        {idx + 1}. Coding
                                        {getMockQuestionSubSection(q)
                                          ? ` · ${getMockQuestionSubSection(q)}`
                                          : ""}
                                      </span>
                                      <div className="flex items-center gap-2 flex-wrap justify-end">
                                        <select
                                          value={String(q.section || "").trim()}
                                          onChange={(e) =>
                                            updateQuestionDraftById(q.draftId, {
                                              section: e.target.value,
                                              subSection: "",
                                            })
                                          }
                                          className="text-xs border rounded px-2 py-1 bg-white"
                                          title="Section"
                                        >
                                          <option value="">Unassigned</option>
                                          {allSectionNames.map((name) => (
                                            <option key={name} value={name}>
                                              {name}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={getMockQuestionSubSection(q)}
                                          onChange={(e) =>
                                            updateQuestionDraftById(q.draftId, {
                                              subSection: e.target.value,
                                            })
                                          }
                                          className="text-xs border rounded px-2 py-1 bg-white"
                                          title="Sub-section (e.g. Easy, Hard)"
                                          disabled={!String(q.section || "").trim()}
                                        >
                                          <option value="">Unassigned</option>
                                          {collectSubSectionsForSection(
                                            q.section,
                                            sectionMap,
                                            questionDrafts
                                          ).map((name) => (
                                            <option key={name} value={name}>
                                              {name}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => removeQuestionDraft(q.draftId)}
                                          className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <QuestionCompanyNamesField
                                      draftId={q.draftId}
                                      companyNames={q.companyNames}
                                      onUpdate={updateQuestionDraftById}
                                    />
                                    <textarea
                                      value={q.question || q.title || ""}
                                      onChange={(e) =>
                                        updateQuestionDraftById(q.draftId, {
                                          question: e.target.value,
                                          title: e.target.value,
                                        })
                                      }
                                      rows={4}
                                      placeholder="Coding problem statement"
                                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                                    />
                                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Language</label>
                                        <select
                                          value={q.language || "javascript"}
                                          onChange={(e) =>
                                            updateQuestionDraftById(q.draftId, { language: e.target.value })
                                          }
                                          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                        >
                                          <option value="javascript">JavaScript</option>
                                          <option value="python">Python</option>
                                          <option value="java">Java</option>
                                          <option value="c">C</option>
                                          <option value="cpp">C++</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Max score</label>
                                        <input
                                          type="number"
                                          value={q.maxScore ?? 10}
                                          onChange={(e) =>
                                            updateQuestionDraftById(q.draftId, {
                                              maxScore: Number(e.target.value) || 10,
                                            })
                                          }
                                          className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <textarea
                                      value={q.starterCode || ""}
                                      onChange={(e) =>
                                        updateQuestionDraftById(q.draftId, { starterCode: e.target.value })
                                      }
                                      rows={4}
                                      placeholder="Starter code (optional)"
                                      className="w-full border rounded-lg px-3 py-2 font-mono text-sm mb-3"
                                    />
                                    <div className="space-y-2">
                                      <p className="text-sm font-medium text-gray-700">Test cases</p>
                                      {(q.testCases || []).map((tc, tcIdx) => (
                                        <div
                                          key={tcIdx}
                                          className="grid sm:grid-cols-2 gap-2 p-3 border rounded-lg bg-white"
                                        >
                                          <textarea
                                            value={tc.input || ""}
                                            onChange={(e) =>
                                              updateTestCase(q.draftId, tcIdx, "input", e.target.value)
                                            }
                                            rows={2}
                                            placeholder="Input"
                                            className="border rounded-lg px-2 py-1 text-xs font-mono"
                                          />
                                          <textarea
                                            value={tc.output || ""}
                                            onChange={(e) =>
                                              updateTestCase(q.draftId, tcIdx, "output", e.target.value)
                                            }
                                            rows={2}
                                            placeholder="Expected output"
                                            className="border rounded-lg px-2 py-1 text-xs font-mono"
                                          />
                                          <p className="sm:col-span-2 text-[11px] text-slate-500">
                                            {tcIdx < 2
                                              ? "Public sample (shown on exam with input & expected output)"
                                              : "Hidden automatically (used for scoring; not shown on exam)"}
                                          </p>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => addTestCase(q.draftId)}
                                        className="text-sm text-[#00448a] hover:underline"
                                      >
                                        + Add test case
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          {visibleMcqs.length === 0 && visibleCoding.length === 0 && (
                            <p className="text-sm text-gray-500 py-6 text-center">
                              No questions in this section yet. Choose a type and click Add question.
                            </p>
                          )}
              </div>
            </div>
          )}
        </div>
      </div>

      {passageModalDraftId
        ? (() => {
            const modalQ = questionDrafts.find((item) => item.draftId === passageModalDraftId);
            if (!modalQ) return null;
            const group = String(modalQ.passageGroup || "").trim();
            const sharedCount = group
              ? questionDrafts.filter(
                  (item) => String(item.passageGroup || "").trim() === group
                ).length
              : 0;
            return (
              <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="passage-modal-title"
                  className="w-full max-w-2xl rounded-2xl border border-sky-100 bg-white shadow-2xl overflow-hidden"
                >
                  <div className="bg-sky-50 border-b border-sky-100 px-5 py-4 flex items-start justify-between gap-3">
                    <div>
                      <h3
                        id="passage-modal-title"
                        className="text-base font-semibold text-[#00448a]"
                      >
                        Passage / paragraph (optional)
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        For verbal or English questions. Write the passage once, then share it with
                        the next questions. Each of those questions shows the same passage.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPassageModalDraftId("")}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-sm text-slate-600 hover:bg-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <textarea
                      value={modalQ.description || ""}
                      onChange={(e) => updatePassageText(modalQ.draftId, e.target.value)}
                      rows={8}
                      placeholder="Paste the reading passage or paragraph here"
                      className="w-full border border-sky-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                      autoFocus
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700">
                        Share with next
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={passageShareSize}
                          onChange={(e) =>
                            setPassageShareSize(
                              Math.max(2, Math.min(10, Number(e.target.value) || 2))
                            )
                          }
                          className="w-14 border border-sky-200 rounded-lg px-2 py-1 text-xs bg-white"
                        />
                        questions
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          sharePassageWithNext(modalQ.draftId);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#00448a] text-white text-xs font-medium hover:bg-[#003a76]"
                      >
                        Apply passage
                      </button>
                      {sharedCount > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestionDraftById(modalQ.draftId, { passageGroup: "" })
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Unlink this question
                        </button>
                      ) : null}
                    </div>
                    {sharedCount > 1 ? (
                      <p className="text-[11px] font-medium text-[#00448a]">
                        Shared with {sharedCount} questions. Editing this passage updates all of
                        them.
                      </p>
                    ) : null}
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPassageModalDraftId("")}
                        className="px-4 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        : null}
    </CheckAdminAuth>
  );
}
