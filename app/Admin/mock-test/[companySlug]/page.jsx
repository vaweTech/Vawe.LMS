"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  fetchMockTestGroup,
  fetchMockTestsForCompany,
  getMockQuestionSubSection,
  getMockTestCompanyLabel,
  normalizeMockCompanyNames,
  sanitizeMockQuestions,
  summarizeMockTestQuestions,
  updateMockTest,
} from "@/lib/mockTests";
import { parseDayMcqRows } from "@/lib/dayMcqUpload";
import {
  ArrowLeft,
  Clock,
  Code2,
  FileQuestion,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const SCOPE_ALL = "__ALL__";
const SCOPE_UNASSIGNED = "__UNASSIGNED__";

const emptyTestForm = {
  title: "",
  order: 1,
  durationMinutes: 60,
};

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
  const set = new Set(Array.isArray(sectionMap[sec]) ? sectionMap[sec] : []);
  drafts.forEach((q) => {
    if (String(q.section || "").trim() !== sec) return;
    const sub = getMockQuestionSubSection(q);
    if (sub) set.add(sub);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
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
  const [testForm, setTestForm] = useState(emptyTestForm);
  const [editingTestId, setEditingTestId] = useState(null);
  const [editMeta, setEditMeta] = useState(emptyTestForm);
  const [questionEditId, setQuestionEditId] = useState(null);
  const [questionDrafts, setQuestionDrafts] = useState([]);
  const [uploadInfo, setUploadInfo] = useState("");
  const [questionType, setQuestionType] = useState("mcq");
  const [sectionMap, setSectionMap] = useState({});
  const [newSectionName, setNewSectionName] = useState("");
  const [newSubSectionName, setNewSubSectionName] = useState("");
  const [activeMcqScope, setActiveMcqScope] = useState(SCOPE_ALL);
  const [activeMcqSubScope, setActiveMcqSubScope] = useState(SCOPE_ALL);
  const [activeCodingScope, setActiveCodingScope] = useState(SCOPE_ALL);
  const [activeCodingSubScope, setActiveCodingSubScope] = useState(SCOPE_ALL);
  const [imageUploadKey, setImageUploadKey] = useState("");
  const [uploadPreview, setUploadPreview] = useState(null);

  const mcqDrafts = useMemo(
    () => questionDrafts.filter((q) => (q?.type || "mcq") === "mcq"),
    [questionDrafts]
  );
  const codingDrafts = useMemo(
    () => questionDrafts.filter((q) => q?.type === "coding"),
    [questionDrafts]
  );

  const mcqSectionNames = useMemo(() => {
    const names = new Set(Object.keys(sectionMap || {}));
    mcqDrafts.forEach((q) => {
      const s = String(q.section || "").trim();
      if (s) names.add(s);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [sectionMap, mcqDrafts]);

  const codingSectionNames = useMemo(() => {
    const names = new Set(Object.keys(sectionMap || {}));
    codingDrafts.forEach((q) => {
      const s = String(q.section || "").trim();
      if (s) names.add(s);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [sectionMap, codingDrafts]);

  const mcqSubSectionNames = useMemo(() => {
    if (activeMcqScope === SCOPE_ALL || activeMcqScope === SCOPE_UNASSIGNED) return [];
    return collectSubSectionsForSection(activeMcqScope, sectionMap, mcqDrafts);
  }, [activeMcqScope, sectionMap, mcqDrafts]);

  const codingSubSectionNames = useMemo(() => {
    if (activeCodingScope === SCOPE_ALL || activeCodingScope === SCOPE_UNASSIGNED) return [];
    return collectSubSectionsForSection(activeCodingScope, sectionMap, codingDrafts);
  }, [activeCodingScope, sectionMap, codingDrafts]);

  const hasMcqUnassignedSection = useMemo(
    () => hasUnassignedSections(mcqDrafts),
    [mcqDrafts]
  );
  const hasCodingUnassignedSection = useMemo(
    () => hasUnassignedSections(codingDrafts),
    [codingDrafts]
  );
  const hasMcqUnassignedSubSection = useMemo(
    () => hasUnassignedSubSections(mcqDrafts, activeMcqScope),
    [mcqDrafts, activeMcqScope]
  );
  const hasCodingUnassignedSubSection = useMemo(
    () => hasUnassignedSubSections(codingDrafts, activeCodingScope),
    [codingDrafts, activeCodingScope]
  );

  const visibleMcqs = useMemo(
    () => filterDraftsByScope(mcqDrafts, activeMcqScope, activeMcqSubScope),
    [mcqDrafts, activeMcqScope, activeMcqSubScope]
  );

  const visibleCoding = useMemo(
    () => filterDraftsByScope(codingDrafts, activeCodingScope, activeCodingSubScope),
    [codingDrafts, activeCodingScope, activeCodingSubScope]
  );

  useEffect(() => {
    setActiveMcqSubScope(SCOPE_ALL);
  }, [activeMcqScope]);

  useEffect(() => {
    setActiveCodingSubScope(SCOPE_ALL);
  }, [activeCodingScope]);

  useEffect(() => {
    if (!hasMcqUnassignedSection && activeMcqScope === SCOPE_UNASSIGNED) {
      setActiveMcqScope(SCOPE_ALL);
    }
  }, [hasMcqUnassignedSection, activeMcqScope]);

  useEffect(() => {
    if (!hasCodingUnassignedSection && activeCodingScope === SCOPE_UNASSIGNED) {
      setActiveCodingScope(SCOPE_ALL);
    }
  }, [hasCodingUnassignedSection, activeCodingScope]);

  useEffect(() => {
    if (!hasMcqUnassignedSubSection && activeMcqSubScope === SCOPE_UNASSIGNED) {
      setActiveMcqSubScope(SCOPE_ALL);
    }
  }, [hasMcqUnassignedSubSection, activeMcqSubScope]);

  useEffect(() => {
    if (!hasCodingUnassignedSubSection && activeCodingSubScope === SCOPE_UNASSIGNED) {
      setActiveCodingSubScope(SCOPE_ALL);
    }
  }, [hasCodingUnassignedSubSection, activeCodingSubScope]);

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
    setUploadInfo("");
  }

  const companyLabel = getMockTestCompanyLabel(companySlug, group ? [group] : undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, testList] = await Promise.all([
        fetchMockTestGroup(companySlug),
        fetchMockTestsForCompany(companySlug),
      ]);
      setGroup(groupData);
      setTests(testList);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to load mock tests.");
    } finally {
      setLoading(false);
    }
  }, [companySlug]);

  useEffect(() => {
    if (companySlug) loadData();
  }, [companySlug, loadData]);

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
      setActiveCodingSubScope(SCOPE_ALL);
      setNewSectionName("");
      setNewSubSectionName("");
      const loaded = Array.isArray(test?.questions) && test.questions.length
        ? test.questions.map((q, idx) => {
            if (q?.type === "coding") {
              return ensureDraftId(
                {
                  ...createEmptyMockCodingQuestion(),
                  ...q,
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
      setSectionMap(buildMockSectionMap(loaded));
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
    const activeScope = type === "coding" ? activeCodingScope : activeMcqScope;
    const activeSubScope = type === "coding" ? activeCodingSubScope : activeMcqSubScope;
    const section = scopeSection(activeScope);
    const subSection = scopeSubSection(activeSubScope);
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
    setNewSectionName("");
    if (questionType === "coding") setActiveCodingScope(n);
    else setActiveMcqScope(n);
  }

  function addSubSection(type) {
    const sectionScope = type === "coding" ? activeCodingScope : activeMcqScope;
    const n = String(newSubSectionName || "").trim();
    if (!n || sectionScope === SCOPE_ALL || sectionScope === SCOPE_UNASSIGNED) {
      alert("Select a section first, then add a sub-section.");
      return;
    }
    setSectionMap((prev) => ({
      ...prev,
      [sectionScope]: Array.from(new Set([...(prev[sectionScope] || []), n])),
    }));
    setNewSubSectionName("");
    if (type === "coding") setActiveCodingSubScope(n);
    else setActiveMcqSubScope(n);
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
      await updateMockTest(companySlug, questionEditId, { questions: cleaned });
      setQuestionEditId(null);
      setQuestionDrafts([]);
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
        return ensureDraftId({ ...createEmptyMockCodingQuestion(q.section), ...q }, idx);
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

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#00448a] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#00448a]/20">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#00448a]/70">
                      Mock test group
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{companyLabel}</h1>
                    <p className="text-sm text-slate-600 mt-1">
                      Manage tests, sections, and questions for this company.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
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

              <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                <form
                  onSubmit={handleCreateTest}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-fit lg:sticky lg:top-6"
                >
                  <h2 className="font-semibold text-slate-900 mb-1">New mock test</h2>
                  <p className="text-xs text-slate-500 mb-4">Add a test, then open it to add questions.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                      <input
                        value={testForm.title}
                        onChange={(e) => setTestForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Mock Test 1"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Order</label>
                        <input
                          type="number"
                          value={testForm.order}
                          onChange={(e) =>
                            setTestForm((p) => ({ ...p, order: Number(e.target.value) || 1 }))
                          }
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
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
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] disabled:opacity-60 text-sm font-semibold shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Create test
                  </button>
                </form>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">Tests</h2>
                    <span className="text-xs text-slate-500">
                      {loading ? "Loading…" : `${tests.length} total`}
                    </span>
                  </div>

                  {loading ? (
                    <div className="p-10 text-center text-slate-500">Loading tests…</div>
                  ) : tests.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-slate-600 font-medium">No mock tests yet</p>
                      <p className="text-sm text-slate-500 mt-1">Create your first test using the form.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {tests.map((test, index) => {
                        const summary = summarizeMockTestQuestions(test.questions);
                        const isEditingMeta = editingTestId === test.id;

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
                            className="p-5 hover:bg-slate-50/50 transition-colors group"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-xl bg-[#00448a]/10 text-[#00448a] flex items-center justify-center font-bold text-sm shrink-0">
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-slate-900 truncate">
                                    {test.title || `Mock Test ${index + 1}`}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                                      <FileQuestion className="h-3 w-3" />
                                      {summary.mcq} MCQ
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                                      <Code2 className="h-3 w-3" />
                                      {summary.coding} Coding
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                      <Clock className="h-3 w-3" />
                                      {test.durationMinutes || 60} min
                                    </span>
                                  </div>
                                  {summary.sections.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {summary.sections.slice(0, 4).map((sec) => (
                                        <span
                                          key={sec}
                                          className="text-[10px] px-2 py-0.5 rounded-full bg-[#26ebe5]/15 text-[#00448a] font-medium"
                                        >
                                          {sec}
                                        </span>
                                      ))}
                                      {summary.sections.length > 4 && (
                                        <span className="text-[10px] text-slate-400">
                                          +{summary.sections.length - 4} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openQuestionEditor(test.id)}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] shadow-sm"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Questions
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditMeta(test)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm hover:bg-white"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTest(test)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50"
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
                          <div className="flex flex-wrap items-center gap-3 mb-4">
                            <select
                              value={questionType}
                              onChange={(e) => setQuestionType(e.target.value)}
                              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                            >
                              <option value="mcq">MCQ</option>
                              <option value="coding">Coding</option>
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
                                Sections
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
                            {(questionType === "mcq"
                              ? activeMcqScope !== SCOPE_ALL && activeMcqScope !== SCOPE_UNASSIGNED
                              : activeCodingScope !== SCOPE_ALL && activeCodingScope !== SCOPE_UNASSIGNED) && (
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                  Sub-sections for{" "}
                                  {questionType === "mcq" ? activeMcqScope : activeCodingScope}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={newSubSectionName}
                                    onChange={(e) => setNewSubSectionName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addSubSection(questionType);
                                      }
                                    }}
                                    placeholder="New sub-section name (e.g. Section A)"
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addSubSection(questionType)}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] transition-colors"
                                  >
                                    Add sub-section
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {mcqDrafts.length > 0 && (
                            <div className="mb-8">
                              <SectionTabs
                                scope={activeMcqScope}
                                setScope={setActiveMcqScope}
                                sectionNames={mcqSectionNames}
                                allLabel="All MCQs"
                                showUnassigned={hasMcqUnassignedSection}
                              />
                              {(mcqSubSectionNames.length > 0 ||
                                hasMcqUnassignedSubSection ||
                                (activeMcqScope !== SCOPE_ALL &&
                                  activeMcqScope !== SCOPE_UNASSIGNED)) && (
                                <SubSectionTabs
                                  scope={activeMcqSubScope}
                                  setScope={setActiveMcqSubScope}
                                  subSectionNames={mcqSubSectionNames}
                                  showUnassigned={hasMcqUnassignedSubSection}
                                />
                              )}
                              <div className="flex items-center justify-between mb-3 mt-4">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {scopeTitle("MCQ Questions", activeMcqScope, activeMcqSubScope)}
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
                                          {mcqSectionNames.map((name) => (
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
                                            mcqDrafts
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
                          )}

                          {codingDrafts.length > 0 && (
                            <div className="mb-8">
                              <SectionTabs
                                scope={activeCodingScope}
                                setScope={setActiveCodingScope}
                                sectionNames={codingSectionNames}
                                allLabel="All Coding"
                                showUnassigned={hasCodingUnassignedSection}
                              />
                              {(codingSubSectionNames.length > 0 ||
                                hasCodingUnassignedSubSection ||
                                (activeCodingScope !== SCOPE_ALL &&
                                  activeCodingScope !== SCOPE_UNASSIGNED)) && (
                                <SubSectionTabs
                                  scope={activeCodingSubScope}
                                  setScope={setActiveCodingSubScope}
                                  subSectionNames={codingSubSectionNames}
                                  showUnassigned={hasCodingUnassignedSubSection}
                                />
                              )}
                              <div className="flex items-center justify-between mb-3 mt-4">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {scopeTitle(
                                    "Coding Questions",
                                    activeCodingScope,
                                    activeCodingSubScope
                                  )}
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
                                          {codingSectionNames.map((name) => (
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
                                            codingDrafts
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
                          )}

                          {mcqDrafts.length === 0 && codingDrafts.length === 0 && (
                            <p className="text-sm text-gray-500 py-6 text-center">
                              No questions yet. Choose MCQ or Coding and click Add question.
                            </p>
                          )}
              </div>
            </div>
          )}
        </div>
      </div>
    </CheckAdminAuth>
  );
}
