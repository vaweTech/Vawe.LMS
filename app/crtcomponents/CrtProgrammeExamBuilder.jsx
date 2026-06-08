"use client";

import { useState } from "react";
import { db, firestoreHelpers } from "../../lib/firebase";

const PROGRAM_TEST_LANGS = ["javascript", "python", "java", "cpp", "c"];

function emptyMcqQuestion() {
  return {
    type: "mcq",
    text: "",
    options: ["", "", "", ""],
    correctAnswers: [],
    isMultiple: false,
  };
}

function emptyCodingQuestion() {
  return {
    type: "coding",
    title: "",
    description: "",
    language: "javascript",
    starterCode: "",
    testCases: [{ input: "", output: "", hidden: false }],
  };
}

/**
 * Card + modal to build a CRT programme exam and write copies to
 * `crt/{programmeId}/tests` for each selected programme.
 */
export default function CrtProgrammeExamBuilder({ crts = [], user }) {
  const [programTestSelectedCrtIds, setProgramTestSelectedCrtIds] = useState([]);
  const [newProgramTest, setNewProgramTest] = useState({
    name: "",
    durationMinutes: "",
  });
  const [creatingProgramTest, setCreatingProgramTest] = useState(false);
  const [showProgramTestModal, setShowProgramTestModal] = useState(false);
  const [programTestSections, setProgramTestSections] = useState([]);
  const [activeProgramTestSectionIndex, setActiveProgramTestSectionIndex] = useState(0);

  function toggleCrtIdForProgramTest(crtId) {
    setProgramTestSelectedCrtIds((prev) =>
      prev.includes(crtId) ? prev.filter((id) => id !== crtId) : [...prev, crtId]
    );
  }

  async function createProgramTestForSelectedCrts(e) {
    e.preventDefault();
    if (!newProgramTest.name.trim()) {
      alert("Please enter a test name.");
      return;
    }
    if (programTestSelectedCrtIds.length === 0) {
      alert("Select at least one CRT programme.");
      return;
    }
    if (!Array.isArray(programTestSections) || programTestSections.length === 0) {
      alert("Add at least one section.");
      return;
    }
    try {
      setCreatingProgramTest(true);
      const duration = Number(newProgramTest.durationMinutes) || 0;
      const assignmentGroupId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `grp_${Date.now()}`;
      const base = {
        name: newProgramTest.name.trim(),
        durationMinutes: duration,
        sections: programTestSections,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || null,
        assignmentGroupId,
        createdVia: "crtManager",
      };
      const results = await Promise.allSettled(
        programTestSelectedCrtIds.map((crtId) =>
          firestoreHelpers.addDoc(firestoreHelpers.collection(db, "crt", crtId, "tests"), base)
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) {
        console.error("Some CRT exam creates failed:", failed);
      }
      alert(
        failed.length === 0
          ? `CRT exam created on ${programTestSelectedCrtIds.length} programme(s). Open each programme’s Manage page to edit if needed.`
          : `Created on ${programTestSelectedCrtIds.length - failed.length} programme(s). ${failed.length} failed — check the console and Firestore rules.`
      );
      setNewProgramTest({ name: "", durationMinutes: "" });
      setProgramTestSelectedCrtIds([]);
      setProgramTestSections([]);
      setActiveProgramTestSectionIndex(0);
      setShowProgramTestModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create CRT exam.");
    } finally {
      setCreatingProgramTest(false);
    }
  }

  function openProgramTestModal() {
    setShowProgramTestModal(true);
    if (programTestSections.length === 0) {
      setProgramTestSections([
        {
          title: "Section 1",
          type: "mcq",
          questions: [emptyMcqQuestion()],
        },
      ]);
      setActiveProgramTestSectionIndex(0);
    }
  }

  function closeProgramTestModal() {
    setShowProgramTestModal(false);
  }

  function updateProgramTestSection(idx, patch) {
    setProgramTestSections((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function updateProgramTestQuestion(sectionIdx, qIdx, patch) {
    setProgramTestSections((prev) => {
      const next = [...prev];
      const sec = next[sectionIdx] || { questions: [] };
      const qs = Array.isArray(sec.questions) ? [...sec.questions] : [];
      qs[qIdx] = { ...(qs[qIdx] || {}), ...patch };
      next[sectionIdx] = { ...sec, questions: qs };
      return next;
    });
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold">CRT programme exam</h2>
          <button
            type="button"
            onClick={openProgramTestModal}
            className="px-3 py-1.5 rounded-md bg-violet-600 text-white text-sm hover:bg-violet-700"
          >
            + Create & assign
          </button>
        </div>
      </div>

      {showProgramTestModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl my-auto overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Create CRT programme exam</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Build sections (MCQ/Coding) and assign to selected programmes.
                </p>
              </div>
              <button
                type="button"
                onClick={closeProgramTestModal}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createProgramTestForSelectedCrts} className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Assign programmes</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                      onClick={() => setProgramTestSelectedCrtIds(crts.map((c) => c.id))}
                      disabled={crts.length === 0}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                      onClick={() => setProgramTestSelectedCrtIds([])}
                    >
                      Clear
                    </button>
                    <span className="text-xs text-slate-500 self-center">
                      Selected: {programTestSelectedCrtIds.length}
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto border rounded-md p-2 space-y-2 bg-slate-50/70">
                    {crts.length === 0 ? (
                      <p className="text-sm text-slate-500">No programmes yet.</p>
                    ) : (
                      crts.map((c) => (
                        <label key={c.id} className="flex items-start gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={programTestSelectedCrtIds.includes(c.id)}
                            onChange={() => toggleCrtIdForProgramTest(c.id)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-slate-800">{c.name || c.id}</span>
                            {c.description && (
                              <span className="block text-xs text-slate-500 line-clamp-1">{c.description}</span>
                            )}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Test details</p>
                  <input
                    type="text"
                    placeholder="Exam name *"
                    value={newProgramTest.name}
                    onChange={(e) => setNewProgramTest((s) => ({ ...s, name: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={creatingProgramTest}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Duration (minutes)"
                    value={newProgramTest.durationMinutes}
                    onChange={(e) => setNewProgramTest((s) => ({ ...s, durationMinutes: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={creatingProgramTest}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setProgramTestSections((prev) => {
                        const next = [
                          ...prev,
                          { title: `Section ${prev.length + 1}`, type: "mcq", questions: [emptyMcqQuestion()] },
                        ];
                        setActiveProgramTestSectionIndex(next.length - 1);
                        return next;
                      })
                    }
                    className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm"
                  >
                    + Add section
                  </button>
                  <button
                    type="submit"
                    disabled={
                      creatingProgramTest ||
                      !newProgramTest.name.trim() ||
                      programTestSelectedCrtIds.length === 0 ||
                      programTestSections.length === 0
                    }
                    className="flex-1 px-3 py-2 rounded-md bg-violet-600 text-white text-sm disabled:opacity-50"
                  >
                    {creatingProgramTest ? "Creating…" : "Create & assign"}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                {programTestSections.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    Add a section to start building the test.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-slate-600 font-semibold">Active section:</label>
                        <select
                          className="border rounded-md px-2 py-1 text-xs bg-white"
                          value={String(activeProgramTestSectionIndex)}
                          onChange={(e) => {
                            const idx = Number(e.target.value);
                            setActiveProgramTestSectionIndex(Number.isNaN(idx) ? 0 : idx);
                          }}
                        >
                          {programTestSections.map((sec, idx) => (
                            <option key={idx} value={idx}>
                              {`Section ${idx + 1}${sec?.title ? ` - ${sec.title}` : ""}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setProgramTestSections((prev) => {
                            const next = [
                              ...prev,
                              { title: `Section ${prev.length + 1}`, type: "mcq", questions: [emptyMcqQuestion()] },
                            ];
                            setActiveProgramTestSectionIndex(next.length - 1);
                            return next;
                          })
                        }
                        className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs"
                      >
                        + Add section
                      </button>
                    </div>

                    {programTestSections.map((sec, sIdx) => {
                      if (sIdx !== activeProgramTestSectionIndex) return null;
                      const sectionQuestions = Array.isArray(sec.questions) ? sec.questions : [];
                      const sectionType = sec.type === "coding" ? "coding" : "mcq";
                      return (
                        <div key={sIdx} className="border rounded-md p-3 bg-white space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                Section {sIdx + 1}
                              </span>
                              <input
                                className="border rounded-md px-2 py-1 text-xs"
                                value={sec.title || ""}
                                onChange={(e) => updateProgramTestSection(sIdx, { title: e.target.value })}
                                placeholder="Section name"
                              />
                              <select
                                className="border rounded-md px-2 py-1 text-xs bg-white"
                                value={sectionType}
                                onChange={(e) => {
                                  const nextType = e.target.value === "coding" ? "coding" : "mcq";
                                  updateProgramTestSection(sIdx, {
                                    type: nextType,
                                    questions:
                                      nextType === "coding" ? [emptyCodingQuestion()] : [emptyMcqQuestion()],
                                  });
                                }}
                              >
                                <option value="mcq">MCQs</option>
                                <option value="coding">Coding</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setProgramTestSections((prev) => {
                                  const next = prev.filter((_, i) => i !== sIdx);
                                  setActiveProgramTestSectionIndex(Math.max(0, Math.min(sIdx, next.length - 1)));
                                  return next;
                                })
                              }
                              className="text-xs text-red-700 hover:underline"
                            >
                              Remove section
                            </button>
                          </div>

                          {sectionType === "mcq" ? (
                            <div className="space-y-3">
                              {sectionQuestions.map((q, qIdx) => {
                                const qq = q || emptyMcqQuestion();
                                const correctSet = Array.isArray(qq.correctAnswers) ? qq.correctAnswers : [];
                                return (
                                  <div key={qIdx} className="border rounded-md p-3 bg-slate-50 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-slate-700">Q{qIdx + 1}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setProgramTestSections((prev) => {
                                            const next = [...prev];
                                            const qs = Array.isArray(next[sIdx].questions)
                                              ? [...next[sIdx].questions]
                                              : [];
                                            qs.splice(qIdx, 1);
                                            next[sIdx] = { ...next[sIdx], questions: qs };
                                            return next;
                                          })
                                        }
                                        className="text-xs text-red-700 hover:underline"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <textarea
                                      className="w-full border rounded-md px-2 py-1 text-sm"
                                      rows={2}
                                      placeholder="MCQ question"
                                      value={qq.text || ""}
                                      onChange={(e) =>
                                        updateProgramTestQuestion(sIdx, qIdx, { text: e.target.value })
                                      }
                                    />
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                      <input
                                        type="checkbox"
                                        checked={!!qq.isMultiple}
                                        onChange={(e) => {
                                          const isMultiple = e.target.checked;
                                          let nextCorrect = correctSet;
                                          if (!isMultiple && nextCorrect.length > 1) nextCorrect = [nextCorrect[0]];
                                          updateProgramTestQuestion(sIdx, qIdx, {
                                            isMultiple,
                                            correctAnswers: nextCorrect,
                                          });
                                        }}
                                      />
                                      Allow multiple correct answers
                                    </label>
                                    <div className="space-y-2">
                                      {Array.from({ length: 4 }).map((_, optIdx) => {
                                        const optText =
                                          Array.isArray(qq.options) && qq.options[optIdx] != null
                                            ? qq.options[optIdx]
                                            : "";
                                        const checked = correctSet.includes(optIdx);
                                        return (
                                          <div key={optIdx} className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => {
                                                const isMultiple = !!qq.isMultiple;
                                                let nextCorrect = Array.isArray(correctSet) ? [...correctSet] : [];
                                                if (isMultiple) {
                                                  nextCorrect = checked
                                                    ? nextCorrect.filter((i) => i !== optIdx)
                                                    : [...nextCorrect, optIdx];
                                                } else {
                                                  nextCorrect = checked ? [] : [optIdx];
                                                }
                                                updateProgramTestQuestion(sIdx, qIdx, { correctAnswers: nextCorrect });
                                              }}
                                              className="h-4 w-4"
                                            />
                                            <input
                                              className="flex-1 border rounded-md px-2 py-1 text-sm"
                                              placeholder={`Option ${optIdx + 1}`}
                                              value={optText}
                                              onChange={(e) => {
                                                const opts = Array.isArray(qq.options)
                                                  ? [...qq.options]
                                                  : ["", "", "", ""];
                                                opts[optIdx] = e.target.value;
                                                updateProgramTestQuestion(sIdx, qIdx, { options: opts });
                                              }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() =>
                                  setProgramTestSections((prev) => {
                                    const next = [...prev];
                                    const qs = Array.isArray(next[sIdx].questions) ? [...next[sIdx].questions] : [];
                                    qs.push(emptyMcqQuestion());
                                    next[sIdx] = { ...next[sIdx], questions: qs };
                                    return next;
                                  })
                                }
                                className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm"
                              >
                                + Add MCQ
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {sectionQuestions.map((q, qIdx) => {
                                const qq = q || emptyCodingQuestion();
                                const tcs = Array.isArray(qq.testCases) ? qq.testCases : [];
                                return (
                                  <div key={qIdx} className="border rounded-md p-3 bg-slate-50 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-slate-700">Coding Q{qIdx + 1}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setProgramTestSections((prev) => {
                                            const next = [...prev];
                                            const qs = Array.isArray(next[sIdx].questions)
                                              ? [...next[sIdx].questions]
                                              : [];
                                            qs.splice(qIdx, 1);
                                            next[sIdx] = { ...next[sIdx], questions: qs };
                                            return next;
                                          })
                                        }
                                        className="text-xs text-red-700 hover:underline"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <input
                                      className="w-full border rounded-md px-2 py-1 text-sm"
                                      placeholder="Title"
                                      value={qq.title || ""}
                                      onChange={(e) =>
                                        updateProgramTestQuestion(sIdx, qIdx, { title: e.target.value })
                                      }
                                    />
                                    <textarea
                                      className="w-full border rounded-md px-2 py-1 text-sm"
                                      rows={3}
                                      placeholder="Description / problem statement"
                                      value={qq.description || ""}
                                      onChange={(e) =>
                                        updateProgramTestQuestion(sIdx, qIdx, { description: e.target.value })
                                      }
                                    />
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <label className="text-xs text-slate-600 font-semibold">Language</label>
                                      <select
                                        className="border rounded-md px-2 py-1 text-sm bg-white"
                                        value={qq.language || "javascript"}
                                        onChange={(e) =>
                                          updateProgramTestQuestion(sIdx, qIdx, { language: e.target.value })
                                        }
                                      >
                                        {PROGRAM_TEST_LANGS.map((l) => (
                                          <option key={l} value={l}>
                                            {l}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <textarea
                                      className="w-full border rounded-md px-2 py-1 text-sm font-mono"
                                      rows={6}
                                      placeholder="Starter code (optional)"
                                      value={qq.starterCode || ""}
                                      onChange={(e) =>
                                        updateProgramTestQuestion(sIdx, qIdx, { starterCode: e.target.value })
                                      }
                                    />
                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold text-slate-600 uppercase">Test cases</p>
                                      {tcs.map((tc, tcIdx) => (
                                        <div key={tcIdx} className="border rounded-md p-2 bg-white space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-600">TC {tcIdx + 1}</span>
                                            <button
                                              type="button"
                                              className="text-xs text-red-700 hover:underline"
                                              onClick={() => {
                                                const nextTcs = tcs.filter((_, i) => i !== tcIdx);
                                                updateProgramTestQuestion(sIdx, qIdx, { testCases: nextTcs });
                                              }}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                          <label className="flex items-center gap-2 text-xs text-slate-600">
                                            <input
                                              type="checkbox"
                                              checked={tc?.hidden === true}
                                              onChange={(e) => {
                                                const nextTcs = tcs.map((x, i) =>
                                                  i === tcIdx ? { ...(x || {}), hidden: e.target.checked } : x
                                                );
                                                updateProgramTestQuestion(sIdx, qIdx, { testCases: nextTcs });
                                              }}
                                            />
                                            Hidden (not shown to student)
                                          </label>
                                          <textarea
                                            className="w-full border rounded-md px-2 py-1 text-xs font-mono"
                                            rows={2}
                                            placeholder="Input"
                                            value={tc?.input || ""}
                                            onChange={(e) => {
                                              const nextTcs = tcs.map((x, i) =>
                                                i === tcIdx ? { ...(x || {}), input: e.target.value } : x
                                              );
                                              updateProgramTestQuestion(sIdx, qIdx, { testCases: nextTcs });
                                            }}
                                          />
                                          <textarea
                                            className="w-full border rounded-md px-2 py-1 text-xs font-mono"
                                            rows={2}
                                            placeholder="Expected output"
                                            value={tc?.output || ""}
                                            onChange={(e) => {
                                              const nextTcs = tcs.map((x, i) =>
                                                i === tcIdx ? { ...(x || {}), output: e.target.value } : x
                                              );
                                              updateProgramTestQuestion(sIdx, qIdx, { testCases: nextTcs });
                                            }}
                                          />
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextTcs = [...tcs, { input: "", output: "", hidden: false }];
                                          updateProgramTestQuestion(sIdx, qIdx, { testCases: nextTcs });
                                        }}
                                        className="px-3 py-2 rounded-md bg-slate-800 text-white text-sm"
                                      >
                                        + Add test case
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() =>
                                  setProgramTestSections((prev) => {
                                    const next = [...prev];
                                    const qs = Array.isArray(next[sIdx].questions) ? [...next[sIdx].questions] : [];
                                    qs.push(emptyCodingQuestion());
                                    next[sIdx] = { ...next[sIdx], questions: qs };
                                    return next;
                                  })
                                }
                                className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm"
                              >
                                + Add Coding question
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
