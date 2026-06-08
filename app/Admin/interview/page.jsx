"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileQuestion,
  FolderOpen,
  ShieldAlert,
} from "lucide-react";
import CheckAuth from "../../../lib/CheckAuth";
import { auth, db, firestoreHelpers } from "../../../lib/firebase";
import readXlsxFile from "read-excel-file";
import ExcelJS from "exceljs";
import MathQuestionField from "@/components/MathQuestionField";
import { formatMathNotation } from "@/lib/formatMathNotation";

/** Normalize topic tags from Firestore/Excel/UI (comma-separated string or array). */
function normalizeTopicsFromUnknown(raw) {
  if (raw == null) return [];
  const out = [];
  const seen = new Set();
  const push = (t) => {
    const x = String(t || "").trim();
    if (!x) return;
    const k = x.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(x);
  };
  if (Array.isArray(raw)) {
    raw.forEach(push);
    return out;
  }
  String(raw)
    .split(/[,;|\n/]+/)
    .forEach(push);
  return out;
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

async function uploadInterviewMcqImage(file) {
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

function McqTopicTagsField({ questionId, topics, updateQuestion }) {
  const [draft, setDraft] = useState("");
  const list = normalizeTopicsFromUnknown(topics);

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    const exists = list.some((x) => x.toLowerCase() === t.toLowerCase());
    if (!exists) updateQuestion(questionId, { topics: [...list, t] });
    setDraft("");
  };

  const remove = (tag) => {
    updateQuestion(questionId, { topics: list.filter((x) => x !== tag) });
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        Topic tags
      </label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
        {list.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No tags yet</span>
        ) : (
          list.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-[#00448a]/10 text-[#00448a] border border-[#00448a]/20 px-2.5 py-1 text-xs font-medium"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="rounded-full p-0.5 hover:bg-[#00448a]/20 text-[#00448a] leading-none"
                aria-label={`Remove tag ${t}`}
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
          placeholder="Type a topic, then Enter or Add"
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
      <p className="text-[11px] text-gray-500 mt-1">Use several tags to group or filter questions by theme (optional).</p>
    </div>
  );
}

function QuestionCompanyNamesField({ questionId, companyNames, updateQuestion }) {
  const [draft, setDraft] = useState("");
  const list = normalizeTopicsFromUnknown(companyNames);

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    const exists = list.some((x) => x.toLowerCase() === t.toLowerCase());
    if (!exists) updateQuestion(questionId, { companyNames: [...list, t] });
    setDraft("");
  };

  const remove = (tag) => {
    updateQuestion(questionId, { companyNames: list.filter((x) => x !== tag) });
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
      <p className="text-[11px] text-gray-500 mt-1">Add one or more company tags for this question (optional).</p>
    </div>
  );
}

export default function AdminInterviewExamsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionType, setQuestionType] = useState("mcq");
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState("");
  const [mcqImageUploadKey, setMcqImageUploadKey] = useState("");
  const [editingId, setEditingId] = useState(null);

  const mcqList = useMemo(() => questions.filter((q) => q.type === "mcq"), [questions]);
  const descList = useMemo(() => questions.filter((q) => q.type === "descriptive"), [questions]);
  const codingList = useMemo(() => questions.filter((q) => q.type === "coding"), [questions]);
  const SCOPE_ALL = "__ALL__";
  const SCOPE_UNASSIGNED = "__UNASSIGNED__";
  const [sections, setSections] = useState([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [activeMcqScope, setActiveMcqScope] = useState(SCOPE_ALL);
  const sectionNames = useMemo(() => {
    const names = new Set(
      (Array.isArray(sections) ? sections : [])
        .map((s) => String(s || "").trim())
        .filter(Boolean)
    );
    for (const q of mcqList) {
      const s = String(q.section || "").trim();
      if (s) names.add(s);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [sections, mcqList]);
  const visibleMcqs = useMemo(() => {
    if (activeMcqScope === SCOPE_ALL) return mcqList;
    if (activeMcqScope === SCOPE_UNASSIGNED)
      return mcqList.filter((q) => !String(q.section || "").trim());
    return mcqList.filter((q) => String(q.section || "").trim() === activeMcqScope);
  }, [mcqList, activeMcqScope]);

  // Results search state
  const [resultPhone, setResultPhone] = useState("");
  const [resultName, setResultName] = useState("");
  const [resultExamId, setResultExamId] = useState("all");
  const [appliedPhone, setAppliedPhone] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [resultsLoading, setResultsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [resultsInfo, setResultsInfo] = useState("");
  const [blockedExams, setBlockedExams] = useState([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(20);
  const [blocksPage, setBlocksPage] = useState(1);
  const [blocksPerPage, setBlocksPerPage] = useState(20);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [activePanel, setActivePanel] = useState("compose");

  const computeMcqScore = (exam, submission) => {
    let correct = 0;
    let total = 0;
    const qs = Array.isArray(exam?.questions) ? exam.questions : [];
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!q || q.type !== "mcq") continue;
      total += 1;
      const ans = submission?.answers?.[i];
      const corrArr = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
      if (corrArr.length > 1) {
        // Multi-select: compare as sets
        const aSet = new Set(Array.isArray(ans) ? ans : []);
        const cSet = new Set(corrArr);
        if (aSet.size === cSet.size && [...aSet].every((x) => cSet.has(x))) {
          correct += 1;
        }
      } else if (corrArr.length === 1) {
        if (ans === corrArr[0]) correct += 1;
      } else if (typeof q.correctAnswer === "number") {
        if (ans === q.correctAnswer) correct += 1;
      }
    }
    const percent = total > 0 ? Math.round((correct / total) * 100) : null;
    return { correct, total, percent, score: correct };
  };

  // Match coding input handling used in admin coding page
  const transformForCompiler = (input) => {
    return String(input || "")
      .split("\n")
      .map((line) =>
        line
          .replace(/\[/g, "")
          .replace(/\]/g, "")
          .replace(/,/g, " ")
          .replace(/#/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .join("\n");
  };

  const fetchResults = useCallback(async () => {
    setResultsLoading(true);
    setResultsInfo("");
    try {
      const examsToSearch =
        resultExamId === "all"
          ? exams
          : exams.filter((e) => e.id === resultExamId);

      const aggregated = [];
      for (const ex of examsToSearch) {
        const subCol = firestoreHelpers.collection(db, "interviewExams", ex.id, "submissions");
        const snap = await firestoreHelpers.getDocs(subCol);
        snap.docs.forEach((d) => {
          const data = d.data();
          const mcqStored = data?.mcqScore;
          const mcq = mcqStored && typeof mcqStored.correct === "number"
            ? {
                correct: mcqStored.correct,
                total: typeof mcqStored.total === "number" ? mcqStored.total : 0,
                percent: (mcqStored.total || 0) > 0 ? Math.round((mcqStored.correct / mcqStored.total) * 100) : null,
                score: typeof mcqStored.score === "number" ? mcqStored.score : mcqStored.correct,
              }
            : computeMcqScore(ex, data);
          aggregated.push({
            id: d.id,
            examId: ex.id,
            examTitle: ex.title,
            name: data?.name || "",
            phone: data?.phone || "",
            submittedAt: data?.submittedAt,
            mcq,
            codingScore: typeof data?.codingScore === "number" ? data.codingScore : null,
          });
        });
      }
      // Sort by total score (mcq + coding), then newest
      aggregated.sort((a, b) => {
        const aTotal = (a.mcq?.score ?? 0) + (a.codingScore ?? 0);
        const bTotal = (b.mcq?.score ?? 0) + (b.codingScore ?? 0);
        if (bTotal !== aTotal) return bTotal - aTotal;
        return (b.submittedAt || 0) - (a.submittedAt || 0);
      });
      setResults(aggregated);
      setResultsInfo(`${aggregated.length} result(s) loaded.`);
    } catch (e) {
      setResultsInfo("Failed to fetch results. Try again.");
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
  }, [exams, resultExamId]);

  useEffect(() => {
    // Check if running on localhost
    if (typeof window !== "undefined") {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      setIsLocalhost(isLocal);
    }
  }, []);

  useEffect(() => {
    async function loadExams() {
      try {
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.query(
            firestoreHelpers.collection(db, "interviewExams")
          )
        );
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setExams(data);
      } catch (e) {
        // ignore
      }
    }
    loadExams();
  }, []);

  const fetchBlockedExams = useCallback(async () => {
    setBlocksLoading(true);
    try {
      const allBlocks = [];
      for (const ex of exams) {
        try {
          const blocksCol = firestoreHelpers.collection(db, "interviewExams", ex.id, "blocks");
          const blocksSnap = await firestoreHelpers.getDocs(
            firestoreHelpers.query(blocksCol, firestoreHelpers.where("blocked", "==", true))
          );
          blocksSnap.docs.forEach((d) => {
            const data = d.data();
            allBlocks.push({
              id: d.id,
              examId: ex.id,
              examTitle: ex.title,
              phone: data?.phone || "",
              reason: data?.reason || "Exam blocked due to multiple tab switches",
              blockedAt: data?.blockedAt,
              tabSwitchCount: data?.tabSwitchCount || 0,
            });
          });
        } catch (e) {
          console.error(`Error fetching blocks for exam ${ex.id}:`, e);
        }
      }
      // Sort by blockedAt (newest first)
      allBlocks.sort((a, b) => (b.blockedAt || 0) - (a.blockedAt || 0));
      setBlockedExams(allBlocks);
    } catch (e) {
      console.error("Failed to fetch blocked exams:", e);
      setBlockedExams([]);
    } finally {
      setBlocksLoading(false);
    }
  }, [exams]);

  const unblockExam = async (examId, blockId, phone) => {
    if (!confirm(`Unblock exam for phone ${phone}?`)) return;
    try {
      const blockRef = firestoreHelpers.doc(db, "interviewExams", examId, "blocks", blockId);
      await firestoreHelpers.updateDoc(blockRef, {
        blocked: false,
        unblockedAt: Date.now(),
        unblockedBy: auth.currentUser?.uid || null,
      });
      // Refresh blocked exams list
      await fetchBlockedExams();
      alert("Exam unblocked successfully.");
    } catch (e) {
      alert("Failed to unblock exam. Please try again.");
    }
  };

  const deleteResult = async (examId, submissionId, name, phone) => {
    if (!confirm(`Delete exam result for ${name || phone}? This action cannot be undone.`)) return;
    try {
      const submissionRef = firestoreHelpers.doc(db, "interviewExams", examId, "submissions", submissionId);
      await firestoreHelpers.deleteDoc(submissionRef);
      // Refresh results
      await fetchResults();
      alert("Result deleted successfully.");
    } catch (e) {
      alert("Failed to delete result. Please try again.");
    }
  };

  const deleteAllResults = async () => {
    const examTitle = resultExamId === "all" 
      ? "all exams" 
      : exams.find((e) => e.id === resultExamId)?.title || "selected exam";
    
    // First, count how many results will be deleted
    const examsToDelete = resultExamId === "all" 
      ? exams 
      : exams.filter((e) => e.id === resultExamId);
    
    let totalCount = 0;
    for (const ex of examsToDelete) {
      try {
        const subCol = firestoreHelpers.collection(db, "interviewExams", ex.id, "submissions");
        const snap = await firestoreHelpers.getDocs(subCol);
        totalCount += snap.docs.length;
      } catch (e) {
        console.error(`Error counting results for exam ${ex.id}:`, e);
      }
    }
    
    if (totalCount === 0) {
      alert("No results to delete for the selected exam(s).");
      return;
    }
    
    if (!confirm(`Delete ALL results for ${examTitle}? This will delete ${totalCount} result(s). This action cannot be undone!`)) return;
    
    try {
      let deletedCount = 0;
      for (const ex of examsToDelete) {
        try {
          const subCol = firestoreHelpers.collection(db, "interviewExams", ex.id, "submissions");
          const snap = await firestoreHelpers.getDocs(subCol);
          const deletePromises = snap.docs.map((d) =>
            firestoreHelpers.deleteDoc(firestoreHelpers.doc(db, "interviewExams", ex.id, "submissions", d.id))
          );
          await Promise.all(deletePromises);
          deletedCount += snap.docs.length;
        } catch (e) {
          console.error(`Error deleting results for exam ${ex.id}:`, e);
        }
      }
      
      // Refresh results
      await fetchResults();
      alert(`Successfully deleted ${deletedCount} result(s).`);
    } catch (e) {
      alert("Failed to delete results. Please try again.");
      console.error("Error deleting all results:", e);
    }
  };

  useEffect(() => {
    if (exams.length === 0) return;
    fetchResults();
    fetchBlockedExams();
  }, [exams, resultExamId, fetchResults, fetchBlockedExams]);

  // Reset pagination when exam selection changes
  useEffect(() => {
    setResultsPage(1);
  }, [resultExamId]);

  const displayedResults = useMemo(() => {
    const phoneDigits = String(appliedPhone || "").replace(/\D/g, "");
    const nameQuery = String(appliedName || "").trim().toLowerCase();
    return results.filter((r) => {
      if (phoneDigits && String(r.phone || "").replace(/\D/g, "") !== phoneDigits) return false;
      if (nameQuery && !String(r.name || "").toLowerCase().includes(nameQuery)) return false;
      return true;
    });
  }, [results, appliedPhone, appliedName]);

  // Pagination for results
  const paginatedResults = useMemo(() => {
    const start = (resultsPage - 1) * resultsPerPage;
    const end = start + resultsPerPage;
    return displayedResults.slice(start, end);
  }, [displayedResults, resultsPage, resultsPerPage]);

  const totalResultsPages = Math.ceil(displayedResults.length / resultsPerPage);

  // Pagination for blocked exams
  const paginatedBlocks = useMemo(() => {
    const start = (blocksPage - 1) * blocksPerPage;
    const end = start + blocksPerPage;
    return blockedExams.slice(start, end);
  }, [blockedExams, blocksPage, blocksPerPage]);

  const totalBlocksPages = Math.ceil(blockedExams.length / blocksPerPage);

  const applyFilters = () => {
    setAppliedPhone(resultPhone);
    setAppliedName(resultName);
    setResultsPage(1); // Reset to first page when filters change
    const phoneDigits = String(resultPhone || "").replace(/\D/g, "");
    const nameQuery = String(resultName || "").trim();
    if (!phoneDigits && !nameQuery) {
      setResultsInfo(`Showing all ${results.length} result(s).`);
      return;
    }
    setResultsInfo(`Filtered results: ${displayedResults.length}.`);
  };

  const downloadResultsExcel = async () => {
    if (displayedResults.length === 0) {
      alert("No results to download. Apply filters or wait for data to load.");
      return;
    }
    const headers = ["Date", "Exam", "Name", "Phone", "MCQ Score", "Coding Score", "Total Score"];
    const rows = displayedResults.map((r) => {
      const date =
        typeof r.submittedAt === "number"
          ? new Date(r.submittedAt).toLocaleString()
          : r.submittedAt?.toDate?.()?.toLocaleString?.() || "—";
      const mcqScore =
        r.mcq?.total != null
          ? `${r.mcq?.score ?? r.mcq?.correct ?? 0}/${r.mcq.total}`
          : "—";
      const codingVal = r.codingScore != null ? Number(r.codingScore) : 0;
      const mcqVal = r.mcq?.score ?? r.mcq?.correct ?? 0;
      const total = mcqVal + codingVal;
      const codingStr = r.codingScore != null ? Number(r.codingScore).toFixed(1) : "—";
      return [date, r.examTitle || "", r.name || "", r.phone || "", mcqScore, codingStr, total];
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Results");
    ws.addRow(headers);
    rows.forEach((row) => ws.addRow(row));
    const examLabel = resultExamId === "all" ? "all-exams" : (exams.find((e) => e.id === resultExamId)?.title || resultExamId).replace(/[^\w\-]/g, "-");
    const filename = `interview-results-${examLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addMcqQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "mcq",
        question: "",
        companyNames: [],
        questionImage: "",
        showDescription: false,
        questionDescription: "",
        questionDescriptionImage: "",
        options: ["", "", "", ""],
        optionImages: ["", "", "", ""],
        correctAnswers: [],
        section: "",
        topics: [],
      },
    ]);
  };
  const addMcqToCurrentScope = () => {
    const sectionForNew =
      activeMcqScope === SCOPE_ALL || activeMcqScope === SCOPE_UNASSIGNED
        ? ""
        : activeMcqScope;
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "mcq",
        question: "",
        companyNames: [],
        questionImage: "",
        showDescription: false,
        questionDescription: "",
        questionDescriptionImage: "",
        options: ["", "", "", ""],
        optionImages: ["", "", "", ""],
        correctAnswers: [],
        section: sectionForNew,
        topics: [],
      },
    ]);
  };

  const addDescriptiveQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "descriptive",
        question: "",
        companyNames: [],
        maxScore: 10,
      },
    ]);
  };
  const addCodingQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "coding",
        question: "",
        companyNames: [],
        section: "easy",
        testCases: [{ input: "", output: "" }],
        maxScore: 10,
      },
    ]);
  };

  const updateQuestion = (qid, updater) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, ...updater } : q))
    );
  };

  const runMcqImageUpload = async (file, qid, mode, optIndex) => {
    const key =
      mode === "question"
        ? `${qid}:q`
        : mode === "description"
        ? `${qid}:desc`
        : `${qid}:o${optIndex}`;
    setMcqImageUploadKey(key);
    const url = await uploadInterviewMcqImage(file);
    setMcqImageUploadKey("");
    if (!url) return;
    if (mode === "question") {
      updateQuestion(qid, { questionImage: url });
      return;
    }
    if (mode === "description") {
      updateQuestion(qid, { questionDescriptionImage: url });
      return;
    }
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const opts = Array.isArray(q.options) ? q.options : ["", "", "", ""];
        const imgs = Array.isArray(q.optionImages) ? [...q.optionImages] : [];
        while (imgs.length < opts.length) imgs.push("");
        imgs[optIndex] = url;
        return { ...q, optionImages: imgs };
      })
    );
  };

  const removeQuestion = (qid) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const cleanQuestions = questions.map((q) => {
        if (q.type === "mcq") {
          const optionTexts = Array.isArray(q.options)
            ? q.options.map((o) =>
                formatMathNotation(
                  typeof o === "string" ? String(o || "") : String(o?.text || "")
                )
              )
            : ["", "", "", ""];
          const fromParallel = Array.isArray(q.optionImages)
            ? q.optionImages.map((u) => String(u || "").trim())
            : [];
          const fromObjects = Array.isArray(q.options)
            ? q.options.map((o) =>
                typeof o === "object" && o != null && o.image
                  ? String(o.image || "").trim()
                  : ""
              )
            : [];
          const optionImages = optionTexts.map((_, i) =>
            String(fromParallel[i] || fromObjects[i] || "").trim()
          );
          const showDesc = Boolean(q.showDescription);
          return {
            type: "mcq",
            question: formatMathNotation(String(q.question || "").trim()),
            companyNames: normalizeTopicsFromUnknown(q.companyNames ?? q.companyName),
            questionImage: String(q.questionImage || "").trim(),
            showDescription: showDesc,
            questionDescription: showDesc
              ? formatMathNotation(String(q.questionDescription || "").trim())
              : "",
            questionDescriptionImage: showDesc
              ? String(q.questionDescriptionImage || "").trim()
              : "",
            options: optionTexts,
            optionImages,
            correctAnswers: Array.isArray(q.correctAnswers)
              ? q.correctAnswers
              : [],
            section: String(q.section || "").trim(),
            topics: normalizeTopicsFromUnknown(q.topics ?? q.topic),
          };
        }
        if (q.type === "coding") {
          return {
            type: "coding",
            question: formatMathNotation(String(q.question || "").trim()),
            companyNames: normalizeTopicsFromUnknown(q.companyNames ?? q.companyName),
            section: String(q.section || "easy").trim(),
            testCases: Array.isArray(q.testCases)
              ? q.testCases
                  .map((t) => ({
                    input: String(t?.input || ""),
                    output: String(t?.output || ""),
                  }))
                  .filter((t) => t.input || t.output)
              : [],
            maxScore: Number.isFinite(Number(q.maxScore)) ? Number(q.maxScore) : 10,
          };
        }
        return {
          type: "descriptive",
          question: formatMathNotation(String(q.question || "").trim()),
          companyNames: normalizeTopicsFromUnknown(q.companyNames ?? q.companyName),
          maxScore: Number.isFinite(Number(q.maxScore)) ? Number(q.maxScore) : 10,
        };
      });
      const base = {
        title: String(title || "").trim(),
        description: String(description || "").trim(),
        durationMinutes: Number.isFinite(Number(durationMinutes))
          ? Number(durationMinutes)
          : 60,
        questions: cleanQuestions,
        sections: sectionNames,
      };

      if (editingId) {
        // Update existing
        await firestoreHelpers.updateDoc(
          firestoreHelpers.doc(db, "interviewExams", editingId),
          { ...base, updatedAt: Date.now() }
        );
        setExams((prev) =>
          prev.map((ex) => (ex.id === editingId ? { ...ex, ...base, updatedAt: Date.now() } : ex))
        );
        alert("Interview exam updated.");
      } else {
        // Create new
        const payload = {
          ...base,
          createdAt: Date.now(),
          createdBy: auth.currentUser?.uid || null,
        };
        const ref = await firestoreHelpers.addDoc(
          firestoreHelpers.collection(db, "interviewExams"),
          payload
        );
        setExams((prev) => [{ id: ref.id, ...payload }, ...prev]);
        alert("Interview exam created.");
      }

      // Reset form
      setTitle("");
      setDescription("");
      setDurationMinutes(60);
      setQuestions([]);
      setEditingId(null);
      setSections([]);
      setNewSectionName("");
      setActiveMcqScope(SCOPE_ALL);
    } catch (e) {
      setError("Failed to save exam. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (exam) => {
    setEditingId(exam.id);
    setTitle(exam.title || "");
    setDescription(exam.description || "");
    setDurationMinutes(Number.isFinite(Number(exam.durationMinutes)) ? Number(exam.durationMinutes) : 60);
    const safe = Array.isArray(exam.questions)
      ? exam.questions.map((q) => {
          const base = {
            id: crypto.randomUUID(),
            type:
              q?.type === "descriptive"
                ? "descriptive"
                : q?.type === "coding"
                ? "coding"
                : "mcq",
            question: String(q?.question || ""),
            companyNames: normalizeTopicsFromUnknown(q?.companyNames ?? q?.companyName),
          };
          
          if (q?.type === "mcq") {
            const rawOpts = Array.isArray(q?.options) ? q.options : ["", "", "", ""];
            const optionTexts = rawOpts.map((o) =>
              typeof o === "string" ? String(o || "") : String(o?.text || "")
            );
            const fromParallel = Array.isArray(q?.optionImages)
              ? q.optionImages.map((u) => String(u || ""))
              : [];
            const fromObjects = rawOpts.map((o) =>
              typeof o === "object" && o != null && o.image ? String(o.image || "") : ""
            );
            const optionImages = optionTexts.map((_, i) => fromParallel[i] || fromObjects[i] || "");
            const descText = String(q?.questionDescription || "").trim();
            const descImg = String(q?.questionDescriptionImage || "").trim();
            const showDesc =
              Boolean(q?.showDescription) || Boolean(descText) || Boolean(descImg);
            return {
              ...base,
              questionImage: String(q?.questionImage || "").trim(),
              showDescription: showDesc,
              questionDescription: descText,
              questionDescriptionImage: descImg,
              options: optionTexts,
              optionImages,
              correctAnswers: Array.isArray(q?.correctAnswers) ? q.correctAnswers : [],
              section: String(q?.section || "").trim(),
              topics: normalizeTopicsFromUnknown(q?.topics ?? q?.topic),
            };
          }
          
          if (q?.type === "coding") {
            return {
              ...base,
              section: String(q?.section || "easy").trim(),
              testCases: (Array.isArray(q?.testCases) ? q.testCases : []).map((t) => ({
                input: String(t?.input || ""),
                output: String(t?.output || ""),
              })),
              maxScore: Number.isFinite(Number(q?.maxScore)) ? Number(q.maxScore) : 10,
            };
          }
          
          // Descriptive
          return {
            ...base,
            maxScore: Number.isFinite(Number(q?.maxScore)) ? Number(q.maxScore) : 10,
          };
        })
      : [];
    setQuestions(safe);
    
    // Load sections from exam.sections first, then extract from questions if not available
    const incomingSections =
      Array.isArray(exam.sections) && exam.sections.length > 0
        ? exam.sections.map((s) => String(s || "").trim()).filter(Boolean)
        : Array.from(
            new Set(
              safe
                .filter((q) => q.type === "mcq")
                .map((q) => String(q.section || "").trim())
                .filter(Boolean)
            )
          );
    setSections(incomingSections);
    setActiveMcqScope(SCOPE_ALL);
    setActivePanel("compose");
    window?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDurationMinutes(60);
    setQuestions([]);
    setSections([]);
    setNewSectionName("");
    setActiveMcqScope(SCOPE_ALL);
  };

  const handleDelete = async (examId) => {
    if (!confirm("Delete this exam? This will also remove its submissions and attempts.")) return;
    try {
      // Delete submissions
      const subsSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, "interviewExams", examId, "submissions")
      );
      await Promise.all(
        subsSnap.docs.map((d) =>
          firestoreHelpers.deleteDoc(
            firestoreHelpers.doc(db, "interviewExams", examId, "submissions", d.id)
          )
        )
      );
      
      // Delete attempts
      const attemptsSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(db, "interviewExams", examId, "attempts")
      );
      await Promise.all(
        attemptsSnap.docs.map((d) =>
          firestoreHelpers.deleteDoc(
            firestoreHelpers.doc(db, "interviewExams", examId, "attempts", d.id)
          )
        )
      );
      
      // Delete exam
      await firestoreHelpers.deleteDoc(firestoreHelpers.doc(db, "interviewExams", examId));
      setExams((prev) => prev.filter((e) => e.id !== examId));
      if (editingId === examId) cancelEdit();
      alert("Exam deleted.");
    } catch (e) {
      alert("Failed to delete exam. Please try again.");
    }
  };

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/40 p-4 sm:p-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8 rounded-2xl border border-gray-200/90 bg-white p-5 sm:p-6 shadow-sm overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#00448a] to-[#f56c53]" aria-hidden />
            <div className="pl-4 sm:pl-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4 min-w-0">
                <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-[#00448a] items-center justify-center shadow-lg shadow-cyan-900/10">
                  <FileQuestion className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">JSET exams</h1>
                  <p className="mt-1 text-sm text-gray-600 max-w-xl leading-relaxed">
                    Build interview exams with MCQs, coding, and descriptive questions. Review submissions and blocked attempts from the tabs below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/Admin")}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:border-[#00448a]/30 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Admin home
              </button>
            </div>
          </header>

          <nav
            className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-gray-200/90 bg-white/90 p-2 shadow-sm"
            aria-label="Interview admin sections"
          >
            {[
              { id: "compose", label: "Compose", icon: ClipboardList },
              { id: "library", label: "Your exams", icon: FolderOpen },
              { id: "results", label: "Results", icon: BarChart3 },
              { id: "security", label: "Blocked", icon: ShieldAlert },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActivePanel(id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  activePanel === id
                    ? "bg-[#00448a] text-white shadow-md shadow-[#00448a]/25"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                {label}
              </button>
            ))}
          </nav>

          {activePanel === "compose" && (
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Create or edit an exam</h2>
              <span className="text-xs font-medium text-gray-500">MCQ · Coding · Descriptive</span>
            </div>
            {editingId && (
              <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/80 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium text-amber-900">You are editing an existing exam — save to apply changes.</span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-amber-300 text-amber-900 bg-white/80 hover:bg-white transition-colors"
                >
                  Cancel edit
                </button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
                <input
                  type="text"
                  placeholder="Exam title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Duration</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Minutes"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none transition-shadow"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                placeholder="Optional — shown to candidates if you use it in the exam UI"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[88px] bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none transition-shadow"
              />
            </div>

            {/* Excel Upload for MCQs */}
            <div className="mt-8 rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50/80 to-cyan-50/30 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  <p className="font-semibold text-gray-900">Bulk import MCQs</p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-3xl">
                    Accepted headers (case-insensitive): <strong>Question No. (optional), Question, Option A–D, Correct Answer, Section (optional), Topics / Tags (optional)</strong>.
                    Also supported: <strong>option1..4</strong> and <strong>correct</strong>. The <strong>Correct Answer</strong> can be numbers (1-4) or letters (A-D), comma-separated for multiple answers. Use <strong>Section</strong> to group MCQs. Use <strong>Topics</strong>, <strong>Tags</strong>, or <strong>Topic tags</strong> for multiple topic labels separated by commas, semicolons, or new lines.
                  </p>
                </div>
                {uploadInfo && (
                  <span className="shrink-0 inline-flex items-center rounded-lg bg-white/90 border border-[#00448a]/20 px-3 py-1.5 text-xs font-medium text-[#00448a]">
                    {uploadInfo}
                  </span>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadInfo("");
                  try {
                    const rows = await readXlsxFile(file);
                    // Expect header row
                    if (!rows || rows.length === 0) {
                      setUploadInfo("No rows found in file.");
                      setUploading(false);
                      return;
                    }
                    const header = rows[0].map((h) => String(h || "").toLowerCase().trim());
                    const colIndex = (nameVariants) => {
                      for (const v of nameVariants) {
                        const idx = header.indexOf(v);
                        if (idx !== -1) return idx;
                      }
                      return -1;
                    };
                    const idxQ = colIndex(["question", "questions", "title"]);
                    const idx1 = colIndex(["option1", "opt1", "a", "option a"]);
                    const idx2 = colIndex(["option2", "opt2", "b", "option b"]);
                    const idx3 = colIndex(["option3", "opt3", "c", "option c"]);
                    const idx4 = colIndex(["option4", "opt4", "d", "option d"]);
                    const idxC = colIndex(["correct answer", "correct", "answer", "answers", "right answer"]);
                    const idxS = colIndex(["section", "category", "paper", "group"]);
                    const idxTopics = colIndex([
                      "topics",
                      "tags",
                      "topic tags",
                      "topic tag",
                      "keywords",
                      "labels",
                    ]);

                    const mapCorrect = (cell) => { 
                      if (cell == null) return [];
                      const raw = String(cell).trim();
                      if (!raw) return [];
                      return raw
                        .split(/[,\s]+/)
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((t) => {
                          const upper = t.toUpperCase();
                          if (upper === "A") return 0;
                          if (upper === "B") return 1;
                          if (upper === "C") return 2;
                          if (upper === "D") return 3;
                          const n = Number(t);
                          if (Number.isFinite(n)) return Math.max(0, Math.min(3, n - 1));
                          return null;
                        })
                        .filter((v) => v != null);
                    };

                    const imported = [];
                    for (let r = 1; r < rows.length; r++) {
                      const row = rows[r] || [];
                      const q = idxQ >= 0 ? row[idxQ] : null;
                      const o1 = idx1 >= 0 ? row[idx1] : "";
                      const o2 = idx2 >= 0 ? row[idx2] : "";
                      const o3 = idx3 >= 0 ? row[idx3] : "";
                      const o4 = idx4 >= 0 ? row[idx4] : "";
                      const corr = idxC >= 0 ? row[idxC] : "";
                      let sec = idxS >= 0 ? row[idxS] : "";
                      const topicCell = idxTopics >= 0 ? row[idxTopics] : "";
                      if (!(idxS >= 0)) {
                        // Default to active scope when no Section column provided
                        sec =
                          activeMcqScope === SCOPE_ALL || activeMcqScope === SCOPE_UNASSIGNED
                            ? ""
                            : activeMcqScope;
                      }
                      const questionText = String(q || "").trim();
                      if (!questionText) continue;
                      imported.push({
                        id: crypto.randomUUID(),
                        type: "mcq",
                        question: questionText,
                        companyNames: [],
                        questionImage: "",
                        showDescription: false,
                        questionDescription: "",
                        questionDescriptionImage: "",
                        options: [o1, o2, o3, o4].map((x) => String(x ?? "")),
                        optionImages: ["", "", "", ""],
                        correctAnswers: Array.from(new Set(mapCorrect(corr))),
                        section: String(sec || "").trim(),
                        topics: normalizeTopicsFromUnknown(topicCell),
                      });
                    }

                    if (imported.length === 0) {
                      setUploadInfo("No valid MCQs detected in the file.");
                    } else {
                      setQuestions((prev) => [...prev, ...imported]);
                      setUploadInfo(`Imported ${imported.length} MCQs.`);
                    }
                  } catch (err) {
                    setUploadInfo("Failed to read the Excel file.");
                  } finally {
                    setUploading(false);
                    // Reset input so user can re-upload same file if needed
                    e.target.value = "";
                  }
                }}
                className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#00448a] file:px-4 file:py-2.5 file:text-white file:font-semibold hover:file:bg-[#003a76] file:cursor-pointer cursor-pointer"
                disabled={uploading}
              />
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Questions</p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                >
                  <option value="mcq">MCQ</option>
                  <option value="descriptive">Descriptive</option>
                  <option value="coding">Coding</option>
                </select>
                <button
                  type="button"
                  onClick={() => (
                    questionType === "mcq"
                      ? addMcqToCurrentScope()
                      : questionType === "coding"
                      ? addCodingQuestion()
                      : addDescriptiveQuestion()
                  )}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00448a] text-white hover:bg-[#003a76] shadow-sm transition-colors"
                >
                  Add question
                </button>
              </div>
              {/* Section manager and scope tabs for MCQs */}
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMcqScope(SCOPE_ALL)}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${activeMcqScope === SCOPE_ALL ? "bg-[#00448a] text-white border-[#00448a] shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"}`}
                  >
                    All MCQs
                  </button>
                  {sectionNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveMcqScope(name)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${activeMcqScope === name ? "bg-[#00448a] text-white border-[#00448a] shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"}`}
                      title={`View MCQs in ${name}`}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveMcqScope(SCOPE_UNASSIGNED)}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${activeMcqScope === SCOPE_UNASSIGNED ? "bg-[#00448a] text-white border-[#00448a] shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-[#00448a]/30 hover:bg-gray-50"}`}
                    title="View MCQs with no section"
                  >
                    Unassigned
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="New section name"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = String(newSectionName || "").trim();
                      if (!n) return;
                      setSections((prev) => Array.from(new Set([...(prev || []), n])));
                      setNewSectionName("");
                      setActiveMcqScope(n);
                    }}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                  >
                    Add section
                  </button>
                </div>
              </div>

              {/* MCQ Section */}
              {mcqList.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      {activeMcqScope === SCOPE_ALL
                        ? "MCQ Questions (All)"
                        : activeMcqScope === SCOPE_UNASSIGNED
                        ? "MCQ Questions (Unassigned)"
                        : `MCQ Questions (${activeMcqScope})`}
                    </h3>
                    <span className="text-xs text-gray-600">{visibleMcqs.length} item(s)</span>
                  </div>
                  <div className="space-y-4">
                    {visibleMcqs.map((q, idx) => (
                      <div key={q.id} className="rounded-2xl border border-gray-200 bg-gray-50/30 p-4 sm:p-5 shadow-sm hover:border-[#00448a]/20 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            {idx + 1}. MCQ
                          </span>
                          <div className="flex items-center gap-3">
                            <select
                              value={String(q.section || "").trim()}
                              onChange={(e) => updateQuestion(q.id, { section: e.target.value })}
                              className="text-xs border rounded px-2 py-1"
                              title="Change section"
                            >
                              <option value="">Unassigned</option>
                              {sectionNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeQuestion(q.id)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <QuestionCompanyNamesField
                          questionId={q.id}
                          companyNames={q.companyNames}
                          updateQuestion={updateQuestion}
                        />
                        <MathQuestionField
                          className="mb-2"
                          placeholder="Question — type or paste text (math symbols supported)"
                          value={q.question || ""}
                          onChange={(text) => updateQuestion(q.id, { question: text })}
                          minRows={4}
                        />
                        <div className="mb-3 rounded-lg border border-gray-200 bg-white/80 px-3 py-2">
                          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Question image (optional)
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={Boolean(mcqImageUploadKey && mcqImageUploadKey.startsWith(q.id))}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) runMcqImageUpload(f, q.id, "question");
                              }}
                              className="text-xs w-full sm:w-auto max-w-[220px] border rounded-lg px-2 py-1.5 bg-white"
                            />
                            {mcqImageUploadKey === `${q.id}:q` ? (
                              <span className="text-xs text-gray-500">Uploading…</span>
                            ) : null}
                            {q.questionImage ? (
                              <button
                                type="button"
                                onClick={() => updateQuestion(q.id, { questionImage: "" })}
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
                        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(q.showDescription)}
                            onChange={(e) => {
                              const on = e.target.checked;
                              updateQuestion(q.id, {
                                showDescription: on,
                                ...(!on
                                  ? {
                                      questionDescription: "",
                                      questionDescriptionImage: "",
                                    }
                                  : {}),
                              });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#00448a] focus:ring-[#00448a]/30"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Add question description
                          </span>
                        </label>
                        {q.showDescription ? (
                          <div className="mb-3 rounded-lg border border-dashed border-[#00448a]/30 bg-[#00448a]/5 px-3 py-3">
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                              Description
                            </label>
                            <MathQuestionField
                              className="mb-3"
                              placeholder="Description — extra context for the question (math symbols supported)"
                              value={q.questionDescription || ""}
                              onChange={(text) =>
                                updateQuestion(q.id, { questionDescription: text })
                              }
                              minRows={3}
                            />
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                              Description image (optional)
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                disabled={Boolean(
                                  mcqImageUploadKey && mcqImageUploadKey.startsWith(q.id)
                                )}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = "";
                                  if (f) runMcqImageUpload(f, q.id, "description");
                                }}
                                className="text-xs w-full sm:w-auto max-w-[220px] border rounded-lg px-2 py-1.5 bg-white"
                              />
                              {mcqImageUploadKey === `${q.id}:desc` ? (
                                <span className="text-xs text-gray-500">Uploading…</span>
                              ) : null}
                              {q.questionDescriptionImage ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(q.id, { questionDescriptionImage: "" })
                                  }
                                  className="text-xs font-medium text-red-600 hover:text-red-700"
                                >
                                  Remove image
                                </button>
                              ) : null}
                            </div>
                            {q.questionDescriptionImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={q.questionDescriptionImage}
                                alt=""
                                className="mt-2 max-h-44 w-full max-w-md rounded-lg border border-gray-200 object-contain bg-white"
                              />
                            ) : null}
                          </div>
                        ) : null}
                        <McqTopicTagsField questionId={q.id} topics={q.topics} updateQuestion={updateQuestion} />
                        <div className="grid sm:grid-cols-2 gap-3">
                          {(q.options || []).map((opt, i) => {
                            const optStr = typeof opt === "string" ? opt : String(opt?.text ?? "");
                            const optImgs = Array.isArray(q.optionImages) ? q.optionImages : [];
                            const optImg = String(optImgs[i] || "").trim();
                            return (
                            <div key={i} className="rounded-lg border border-gray-200 bg-white/60 p-2 space-y-2">
                              <div className="flex items-start gap-2">
                              <MathQuestionField
                                className="flex-1 min-w-0"
                                minRows={2}
                                value={optStr}
                                onChange={(text) => {
                                  const newOptions = [...(q.options || ["", "", "", ""])].map((o, j) =>
                                    j === i
                                      ? text
                                      : typeof o === "string"
                                        ? o
                                        : String(o?.text ?? "")
                                  );
                                  updateQuestion(q.id, { options: newOptions });
                                }}
                                placeholder={`Option ${i + 1}`}
                              />
                              <div className="flex flex-col items-center gap-1 pt-2">
                                <input
                                  type="checkbox"
                                  checked={Array.isArray(q.correctAnswers) && q.correctAnswers.includes(i)}
                                  onChange={(e) => {
                                    const prev = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
                                    const next = e.target.checked
                                      ? Array.from(new Set([...prev, i]))
                                      : prev.filter((x) => x !== i);
                                    updateQuestion(q.id, { correctAnswers: next });
                                  }}
                                  className="w-4 h-4"
                                  title="Mark as correct"
                                />
                                <label className="text-xs text-gray-500">Correct</label>
                              </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pl-0.5">
                                <span className="text-[11px] font-medium text-gray-500">Option image</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={Boolean(mcqImageUploadKey && mcqImageUploadKey.startsWith(q.id))}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) runMcqImageUpload(f, q.id, "option", i);
                                  }}
                                  className="text-[11px] max-w-[200px] border rounded px-1.5 py-1 bg-white"
                                />
                                {mcqImageUploadKey === `${q.id}:o${i}` ? (
                                  <span className="text-[11px] text-gray-500">Uploading…</span>
                                ) : null}
                                {optImg ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const imgs = [...(Array.isArray(q.optionImages) ? q.optionImages : ["", "", "", ""])];
                                      while (imgs.length <= i) imgs.push("");
                                      imgs[i] = "";
                                      updateQuestion(q.id, { optionImages: imgs });
                                    }}
                                    className="text-[11px] font-medium text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              {optImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={optImg}
                                  alt=""
                                  className="max-h-32 w-full rounded border border-gray-200 object-contain bg-white"
                                />
                              ) : null}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Descriptive Section */}
              {descList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Descriptive Questions</h3>
                    <span className="text-xs text-gray-600">{descList.length} item(s)</span>
                  </div>
                  <div className="space-y-4">
                    {descList.map((q, idx) => (
                      <div key={q.id} className="rounded-2xl border border-gray-200 bg-gray-50/30 p-4 sm:p-5 shadow-sm hover:border-[#00448a]/20 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            {idx + 1}. Descriptive
                          </span>
                          <button
                            onClick={() => removeQuestion(q.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <QuestionCompanyNamesField
                          questionId={q.id}
                          companyNames={q.companyNames}
                          updateQuestion={updateQuestion}
                        />
                        <MathQuestionField
                          className="mb-3"
                          placeholder="Descriptive question — math symbols supported"
                          value={q.question || ""}
                          onChange={(text) => updateQuestion(q.id, { question: text })}
                          minRows={4}
                        />
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-gray-700">Max Score</label>
                          <input
                            type="number"
                            min={1}
                            value={q.maxScore || 10}
                            onChange={(e) => updateQuestion(q.id, { maxScore: e.target.value })}
                            className="w-24 border rounded-lg px-3 py-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coding Section */}
              {codingList.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Coding Questions</h3>
                    <span className="text-xs text-gray-600">{codingList.length} item(s)</span>
                  </div>
                  <div className="space-y-4">
                    {codingList.map((q, idx) => (
                      <div key={q.id} className="rounded-2xl border border-gray-200 bg-gray-50/30 p-4 sm:p-5 shadow-sm hover:border-[#00448a]/20 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            {idx + 1}. Coding
                          </span>
                          <button
                            onClick={() => removeQuestion(q.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mb-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Level</label>
                            <select
                              value={String(q.section || "easy").toLowerCase()}
                              onChange={(e) => updateQuestion(q.id, { section: e.target.value })}
                              className="border rounded-lg px-3 py-2 text-sm bg-white"
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="head">Heard</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-700">Max Score</label>
                            <input
                              type="number"
                              min={1}
                              value={q.maxScore ?? 10}
                              onChange={(e) => updateQuestion(q.id, { maxScore: e.target.value })}
                              className="w-24 border rounded-lg px-3 py-2"
                            />
                          </div>
                        </div>
                        <QuestionCompanyNamesField
                          questionId={q.id}
                          companyNames={q.companyNames}
                          updateQuestion={updateQuestion}
                        />
                        <MathQuestionField
                          className="mb-3"
                          placeholder="Coding problem statement — math symbols supported"
                          value={q.question || ""}
                          onChange={(text) => updateQuestion(q.id, { question: text })}
                          minRows={4}
                        />
                        <div className="space-y-3">
                          {(q.testCases || []).map((tc, tIdx) => (
                            <div key={tIdx} className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <textarea
                                  placeholder={`Input ${tIdx + 1} (multi-line supported)
Examples:
- [2,3,4] → compiler receives: 2 3 4
- [[2,3,4],[5,6,7]] → compiler receives: 2 3 4 5 6 7
- 5
  [1,2,3,4,5] → compiler receives:
  5
  1 2 3 4 5
- #{ → compiler receives: {
- # → compiler receives: (space)`}
                                  value={tc.input || ""}
                                  onChange={(e) => {
                                    const next = [...(q.testCases || [])];
                                    next[tIdx] = { ...next[tIdx], input: e.target.value };
                                    updateQuestion(q.id, { testCases: next });
                                  }}
                                  className="w-full border rounded-lg px-3 py-2 min-h-[90px]"
                                />
                                {tc.input && (
                                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                    <span className="font-medium text-blue-800">Compiler will receive:</span>
                                    <div className="font-mono text-blue-700 mt-1 whitespace-pre-wrap">
                                      {transformForCompiler(tc.input) || "(empty)"}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div>
                                <textarea
                                  placeholder={`Output ${tIdx + 1} (multi-line supported)`}
                                  value={tc.output || ""}
                                  onChange={(e) => {
                                    const next = [...(q.testCases || [])];
                                    next[tIdx] = { ...next[tIdx], output: e.target.value };
                                    updateQuestion(q.id, { testCases: next });
                                  }}
                                  className="w-full border rounded-lg px-3 py-2 min-h-[90px]"
                                />
                                {tc.output && (
                                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                                    <span className="font-medium text-green-800">Compiler will receive:</span>
                                    <div className="font-mono text-green-700 mt-1 whitespace-pre-wrap">
                                      {transformForCompiler(tc.output) || "(empty)"}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...(q.testCases || []), { input: "", output: "" }];
                                updateQuestion(q.id, { testCases: next });
                              }}
                              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                            >
                              Add Test Case
                            </button>
                            {Array.isArray(q.testCases) && q.testCases.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...q.testCases];
                                  next.pop();
                                  updateQuestion(q.id, { testCases: next });
                                }}
                                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
                              >
                                Remove Last
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback when no questions */}
              {questions.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-10 px-4 text-center">
                  <p className="text-sm text-gray-600">No questions yet. Pick a type above and click <strong className="text-gray-800">Add question</strong>.</p>
                </div>
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 text-sm font-semibold bg-[#00448a] hover:bg-[#003a76] text-white rounded-xl disabled:opacity-60 shadow-sm transition-colors"
              >
                {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Exam" : "Save Exam"}
              </button>
            </div>
          </div>
          )}

          {activePanel === "library" && (
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Your exams</h2>
              <span className="text-xs font-medium text-gray-500">{exams.length} total</span>
            </div>
            {exams.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-12 px-4 text-center">
                <p className="text-gray-600 text-sm">No interview exams yet. Use <strong className="text-gray-800">Compose</strong> to create your first one.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {exams.map((ex) => (
                  <li
                    key={ex.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-[#00448a]/15 hover:shadow-sm px-4 py-3 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ex.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ex.questions?.length || 0} questions · {ex.durationMinutes} min
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(ex)}
                        className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 hover:border-[#00448a]/40 hover:text-[#00448a] transition-colors"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/interview/${ex.id}`)}
                        className="px-3 py-2 text-sm font-semibold rounded-lg bg-[#00448a] text-white hover:bg-[#003a76] transition-colors"
                        title="Open as test"
                      >
                        Open test
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ex.id)}
                        className="px-3 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}

          {activePanel === "results" && (
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Submission results</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {resultsLoading ? "Loading results…" : `${displayedResults.length} of ${results.length} shown after filters`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadResultsExcel}
                    disabled={displayedResults.length === 0 || resultsLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Download Excel
                  </button>
                  <button
                    type="button"
                    onClick={deleteAllResults}
                    disabled={displayedResults.length === 0 || resultsLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-red-600 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Delete All Results
                  </button>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-[#00448a]/10 text-[#00448a] border border-[#00448a]/20">
                      Sorted by total (MCQ + Coding)
                    </span>
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                      Newest as tie-breaker
                    </span>
                  </div>
                </div>
            </div>

              <div className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gradient-to-b from-gray-50 to-white">
                <div className="grid sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-gray-600 mb-1">Exam</label>
                    <select
                      value={resultExamId}
                      onChange={(e) => setResultExamId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="all">All Exams</option>
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>{ex.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-gray-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={resultPhone}
                      onChange={(e) => setResultPhone(e.target.value)}
                      placeholder="Phone Number"
                      className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-gray-600 mb-1">Name</label>
                    <input
                      type="text"
                      value={resultName}
                      onChange={(e) => setResultName(e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="sm:col-span-3 flex gap-2">
                    <button
                      onClick={applyFilters}
                      className="flex-1 px-4 py-2.5 bg-[#00448a] hover:bg-[#003a76] text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00448a]"
                    >
                      Apply Filters
                    </button>
                    <button
                      onClick={() => {
                        setResultPhone("");
                        setResultName("");
                        setAppliedPhone("");
                        setAppliedName("");
                        setResultsInfo(`Showing all ${results.length} result(s).`);
                      }}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="sm:col-span-12 text-xs text-gray-600">
                    {resultsInfo || "Use filters to narrow results; table updates below."}
                  </div>
                </div>
              </div>

            {/* Pagination Controls */}
            {displayedResults.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Results per page:</label>
                  <select
                    value={resultsPerPage}
                    onChange={(e) => {
                      setResultsPerPage(Number(e.target.value));
                      setResultsPage(1);
                    }}
                    className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  Showing {((resultsPage - 1) * resultsPerPage) + 1} to {Math.min(resultsPage * resultsPerPage, displayedResults.length)} of {displayedResults.length} results
                </div>
              </div>
            )}

            {displayedResults.length > 0 ? (
              <div className="overflow-x-auto mt-5 border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gradient-to-r from-cyan-50 to-blue-50">
                    <tr>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Date</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Exam</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Name</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Phone</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">MCQ Score</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Coding Score</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Total</th>
                      {isLocalhost && (
                        <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedResults.map((r) => {
                      const date =
                        typeof r.submittedAt === "number"
                          ? new Date(r.submittedAt).toLocaleString()
                          : r.submittedAt?.toDate?.()?.toLocaleString?.() || "—";
                      const mcqScore =
                        r.mcq?.total != null
                          ? `${r.mcq?.score ?? r.mcq?.correct ?? 0}/${r.mcq.total}`
                          : "—";
                      const codingScore =
                        r.codingScore != null
                          ? Number(r.codingScore).toFixed(1)
                          : "—";
                      const totalScore = (r.mcq?.score ?? r.mcq?.correct ?? 0) + (r.codingScore ?? 0);
                      return (
                        <tr key={`${r.examId}-${r.id}`} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-gray-700">{date}</td>
                          <td className="py-3 px-4 text-gray-900 font-medium">{r.examTitle}</td>
                          <td className="py-3 px-4 text-gray-700">{r.name || "—"}</td>
                          <td className="py-3 px-4 text-gray-700">{r.phone}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {mcqScore}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {codingScore}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 font-semibold">
                              {totalScore.toFixed(1)}
                            </span>
                          </td>
                          {isLocalhost && (
                            <td className="py-3 px-4">
                              <button
                                onClick={() => deleteResult(r.examId, r.id, r.name, r.phone)}
                                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                title="Delete result (localhost only)"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-5 p-8 text-center border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">No results to display.</p>
              </div>
            )}

            {/* Pagination Navigation */}
            {displayedResults.length > 0 && totalResultsPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setResultsPage(prev => Math.max(1, prev - 1))}
                  disabled={resultsPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalResultsPages) }, (_, i) => {
                    let pageNum;
                    if (totalResultsPages <= 5) {
                      pageNum = i + 1;
                    } else if (resultsPage <= 3) {
                      pageNum = i + 1;
                    } else if (resultsPage >= totalResultsPages - 2) {
                      pageNum = totalResultsPages - 4 + i;
                    } else {
                      pageNum = resultsPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setResultsPage(pageNum)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          resultsPage === pageNum
                            ? "bg-cyan-600 text-white"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setResultsPage(prev => Math.min(totalResultsPages, prev + 1))}
                  disabled={resultsPage === totalResultsPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          )}

          {activePanel === "security" && (
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Blocked exams</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {blocksLoading ? "Loading…" : `${blockedExams.length} blocked attempt(s)`}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchBlockedExams}
                disabled={blocksLoading}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-800 hover:border-[#00448a]/30 hover:text-[#00448a] disabled:opacity-50 transition-colors shrink-0"
              >
                Refresh
              </button>
            </div>

            {/* Pagination Controls */}
            {blockedExams.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Results per page:</label>
                  <select
                    value={blocksPerPage}
                    onChange={(e) => {
                      setBlocksPerPage(Number(e.target.value));
                      setBlocksPage(1);
                    }}
                    className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  Showing {((blocksPage - 1) * blocksPerPage) + 1} to {Math.min(blocksPage * blocksPerPage, blockedExams.length)} of {blockedExams.length} blocked exams
                </div>
              </div>
            )}

            {blockedExams.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gradient-to-r from-red-50 to-orange-50">
                    <tr>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Exam</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Phone</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Reason</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Tab Switches</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Blocked At</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedBlocks.map((block) => {
                      const date =
                        typeof block.blockedAt === "number"
                          ? new Date(block.blockedAt).toLocaleString()
                          : block.blockedAt?.toDate?.()?.toLocaleString?.() || "—";
                      return (
                        <tr key={`${block.examId}-${block.id}`} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-gray-900 font-medium">{block.examTitle}</td>
                          <td className="py-3 px-4 text-gray-700">{block.phone}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 max-w-xs truncate" title={block.reason}>
                              {block.reason}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {block.tabSwitchCount}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-gray-700">{date}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => unblockExam(block.examId, block.id, block.phone)}
                              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                            >
                              Unblock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-5 p-8 text-center border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">No blocked exams.</p>
              </div>
            )}

            {/* Pagination Navigation */}
            {blockedExams.length > 0 && totalBlocksPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setBlocksPage(prev => Math.max(1, prev - 1))}
                  disabled={blocksPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalBlocksPages) }, (_, i) => {
                    let pageNum;
                    if (totalBlocksPages <= 5) {
                      pageNum = i + 1;
                    } else if (blocksPage <= 3) {
                      pageNum = i + 1;
                    } else if (blocksPage >= totalBlocksPages - 2) {
                      pageNum = totalBlocksPages - 4 + i;
                    } else {
                      pageNum = blocksPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setBlocksPage(pageNum)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          blocksPage === pageNum
                            ? "bg-cyan-600 text-white"
                            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setBlocksPage(prev => Math.min(totalBlocksPages, prev + 1))}
                  disabled={blocksPage === totalBlocksPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </CheckAuth>
  );
}


