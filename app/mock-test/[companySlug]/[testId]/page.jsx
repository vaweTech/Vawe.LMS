"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CheckAuth from "@/lib/CheckAuth";
import { isAppleMobileDevice } from "@/lib/deviceDetect";
import {
  fetchMockTest,
  fetchMockTestGroup,
  getMockQuestionSubSection,
  getMockSubSectionsForSection,
  isMockAnswerCorrect,
  MOCK_JUDGE_LANGUAGES,
  normalizeMockQuestionOptions,
  summarizeMockTestQuestions,
  transformMockCompilerInput,
} from "@/lib/mockTests";
import { useSecureExamSession } from "@/lib/useSecureExamSession";

function SecureExamOverlays({
  started,
  isBlocked,
  inFullscreen,
  tabSwitchCount,
  showTabWarning,
  dismissTabWarning,
  requestFullscreen,
}) {
  return (
    <>
      {started && !isAppleMobileDevice() && !inFullscreen && !isBlocked && (
        <div className="fixed inset-0 z-[102] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Fullscreen Required</h2>
            <p className="text-sm text-gray-600 mb-4">
              This mock test must be taken in fullscreen mode.
            </p>
            <button
              type="button"
              onClick={() => {
                requestFullscreen().then((ok) => {
                  if (!ok) alert("Please allow fullscreen to continue the test.");
                });
              }}
              className="px-6 py-2.5 bg-[#00448a] hover:bg-[#003a76] text-white rounded-lg font-medium"
            >
              Enter Fullscreen
            </button>
          </div>
        </div>
      )}

      {showTabWarning && started && (
        <div
          className={`fixed inset-0 z-[101] flex items-center justify-center p-4 ${
            tabSwitchCount >= 2 ? "bg-red-700" : "bg-amber-600"
          }`}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-amber-700">
              Warning {Math.min(tabSwitchCount, 3)} of 3
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {tabSwitchCount <= 1 ? "Stay on this tab" : "Final warning"}
            </h2>
            <button
              type="button"
              onClick={dismissTabWarning}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
            >
              Continue test
            </button>
          </div>
        </div>
      )}
    </>
  );
}

async function runCodingTestCases(code, language, testCases) {
  const results = [];
  for (const tc of testCases) {
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: MOCK_JUDGE_LANGUAGES[language] || "javascript",
          source: code,
          stdin: transformMockCompilerInput(tc?.input || ""),
        }),
      });
      const data = await res.json();
      const actual = (data.stdout || "").trim();
      const expected = String(tc?.output || "").trim();
      results.push({
        pass: actual.toLowerCase() === expected.toLowerCase(),
        actual,
        expected,
      });
    } catch {
      results.push({ pass: false, actual: "Error", expected: String(tc?.output || "") });
    }
  }
  return results;
}

function paletteButtonClass(status, isCurrent) {
  if (isCurrent) return "bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300";
  if (status === "answered") return "bg-green-500 text-white border-green-600";
  if (status === "review") return "bg-purple-500 text-white border-purple-600";
  if (status === "not-answered") return "bg-red-500 text-white border-red-600";
  return "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";
}

export default function TakeMockTestPage() {
  const { companySlug, testId } = useParams();
  const router = useRouter();
  const [test, setTest] = useState(null);
  const [groupLabel, setGroupLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [part, setPart] = useState("mcq");
  const [activeSection, setActiveSection] = useState("General");
  const [activeSubSection, setActiveSubSection] = useState("General");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState({});
  const [reviewMap, setReviewMap] = useState({});
  const [codeLanguages, setCodeLanguages] = useState({});
  const [runResults, setRunResults] = useState({});
  const [runLoading, setRunLoading] = useState({});
  const [scoreDetail, setScoreDetail] = useState(null);

  const companyLabel = groupLabel || String(companySlug || "").replace(/_/g, " ");
  const durationMinutes = Number(test?.durationMinutes) || 0;

  const secure = useSecureExamSession({
    durationMinutes,
    onBlocked: ({ reason }) => alert(`Test blocked. ${reason}`),
  });
  const { markSubmitted, setOnTimeUp } = secure;

  const questions = useMemo(
    () => (Array.isArray(test?.questions) ? test.questions : []),
    [test]
  );

  const summary = useMemo(() => summarizeMockTestQuestions(questions), [questions]);

  const partQuestions = useMemo(() => {
    return questions
      .map((q, index) => ({ q, index }))
      .filter(({ q }) =>
        part === "mcq" ? (q?.type || "mcq") === "mcq" : q?.type === "coding"
      );
  }, [questions, part]);

  const sectionsInPart = useMemo(() => {
    const set = new Set();
    partQuestions.forEach(({ q }) => {
      set.add(String(q?.section || "").trim() || "General");
    });
    return Array.from(set);
  }, [partQuestions]);

  const subSectionsInSection = useMemo(() => {
    return getMockSubSectionsForSection(
      questions,
      part === "coding" ? "coding" : "mcq",
      activeSection
    );
  }, [questions, part, activeSection]);

  const sectionQuestions = useMemo(() => {
    return partQuestions.filter(({ q }) => {
      const sec = String(q?.section || "").trim() || "General";
      if (sec !== activeSection) return false;
      if (!subSectionsInSection.length) return true;
      const sub = getMockQuestionSubSection(q) || "General";
      return sub === activeSubSection;
    });
  }, [partQuestions, activeSection, activeSubSection, subSectionsInSection.length]);

  const currentPos = sectionQuestions.findIndex(({ index }) => index === activeIndex);
  const currentEntry = sectionQuestions[currentPos >= 0 ? currentPos : 0];
  const currentQ = currentEntry?.q;
  const currentIdx = currentEntry?.index ?? activeIndex;

  useEffect(() => {
    if (summary.mcq > 0) setPart("mcq");
    else if (summary.coding > 0) setPart("coding");
  }, [summary.mcq, summary.coding]);

  useEffect(() => {
    if (sectionsInPart.length && !sectionsInPart.includes(activeSection)) {
      setActiveSection(sectionsInPart[0]);
    }
  }, [sectionsInPart, activeSection]);

  useEffect(() => {
    if (subSectionsInSection.length && !subSectionsInSection.includes(activeSubSection)) {
      setActiveSubSection(subSectionsInSection[0]);
    } else if (!subSectionsInSection.length) {
      setActiveSubSection("General");
    }
  }, [subSectionsInSection, activeSubSection]);

  useEffect(() => {
    if (sectionQuestions.length) {
      setActiveIndex(sectionQuestions[0].index);
      setVisited((v) => ({ ...v, [sectionQuestions[0].index]: true }));
    }
    // Reset to first question when part / section / sub-section changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on navigation scope change
  }, [part, activeSection, activeSubSection]);

  const isAnswered = useCallback(
    (idx, q) => {
      const a = answers[idx];
      if (q?.type === "coding") {
        const starter = q?.starterCode || "";
        const val = a ?? starter;
        return String(val).trim() !== "" && String(val).trim() !== String(starter).trim();
      }
      return a !== undefined && a !== null;
    },
    [answers]
  );

  const getStatus = useCallback(
    (idx) => {
      const q = questions[idx];
      if (reviewMap[idx]) return "review";
      if (isAnswered(idx, q)) return "answered";
      if (visited[idx]) return "not-answered";
      return "not-visited";
    },
    [reviewMap, visited, isAnswered, questions]
  );

  const allAnswered = useMemo(() => {
    return questions.length > 0 && questions.every((q, idx) => isAnswered(idx, q));
  }, [questions, isAnswered]);

  const finalizeSubmit = useCallback(async () => {
    let mcqCorrect = 0;
    let mcqTotal = 0;
    let codingScore = 0;
    let codingMax = 0;

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      if ((q?.type || "mcq") === "mcq") {
        mcqTotal += 1;
        if (isMockAnswerCorrect(q, answers[idx])) mcqCorrect += 1;
      } else if (q?.type === "coding") {
        const maxScore = Number(q.maxScore) || 10;
        codingMax += maxScore;
        const code = answers[idx] || q.starterCode || "";
        const lang = codeLanguages[idx] || q.language || "javascript";
        const cases = Array.isArray(q.testCases) ? q.testCases : [];
        if (cases.length && String(code).trim()) {
          const results = await runCodingTestCases(code, lang, cases);
          const passed = results.filter((r) => r.pass).length;
          codingScore += maxScore * (passed / cases.length);
        }
      }
    }

    setScoreDetail({ mcqCorrect, mcqTotal, codingScore, codingMax });
    setSubmitted(true);
    markSubmitted();
  }, [questions, answers, codeLanguages, markSubmitted]);

  useEffect(() => {
    setOnTimeUp(() => {
      finalizeSubmit();
      alert("Time is up. Your test has been submitted automatically.");
    });
  }, [setOnTimeUp, finalizeSubmit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [group, data] = await Promise.all([
          fetchMockTestGroup(companySlug),
          fetchMockTest(companySlug, testId),
        ]);
        if (!cancelled) {
          setGroupLabel(group?.label || String(companySlug || "").replace(/_/g, " "));
          setTest(data);
          const langs = {};
          const initialAnswers = {};
          (data?.questions || []).forEach((q, idx) => {
            if (q?.type === "coding") {
              langs[idx] = q.language || "javascript";
              if (q.starterCode) initialAnswers[idx] = q.starterCode;
            }
          });
          setCodeLanguages(langs);
          setAnswers(initialAnswers);
        }
      } catch (e) {
        console.error("Failed to load mock test:", e);
        if (!cancelled) setTest(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug, testId]);

  function goToQuestion(globalIdx) {
    setActiveIndex(globalIdx);
    setVisited((v) => ({ ...v, [globalIdx]: true }));
  }

  function goNext(markReview = false) {
    if (markReview) {
      setReviewMap((m) => ({ ...m, [currentIdx]: true }));
    } else {
      setReviewMap((m) => ({ ...m, [currentIdx]: false }));
    }
    const pos = sectionQuestions.findIndex(({ index }) => index === currentIdx);
    if (pos >= 0 && pos < sectionQuestions.length - 1) {
      goToQuestion(sectionQuestions[pos + 1].index);
    }
  }

  function clearCurrentResponse() {
    const q = questions[currentIdx];
    if (q?.type === "coding") {
      setAnswers((p) => ({ ...p, [currentIdx]: q.starterCode || "" }));
    } else {
      setAnswers((p) => {
        const next = { ...p };
        delete next[currentIdx];
        return next;
      });
    }
    setReviewMap((m) => ({ ...m, [currentIdx]: false }));
  }

  async function handleRunCode() {
    const q = questions[currentIdx];
    const code = answers[currentIdx] || "";
    if (!String(code).trim()) {
      alert("Write your solution before running.");
      return;
    }
    const testCases = Array.isArray(q?.testCases) ? q.testCases : [];
    setRunLoading((p) => ({ ...p, [currentIdx]: true }));
    const results = await runCodingTestCases(
      code,
      codeLanguages[currentIdx] || q?.language || "javascript",
      testCases
    );
    setRunResults((p) => ({ ...p, [currentIdx]: results }));
    setRunLoading((p) => ({ ...p, [currentIdx]: false }));
  }

  function handleSubmit() {
    if (!confirm("Submit the test? You cannot change answers after submitting.")) return;
    finalizeSubmit();
  }

  function switchPart(nextPart) {
    setPart(nextPart);
    const nextQs = questions
      .map((q, index) => ({ q, index }))
      .filter(({ q }) =>
        nextPart === "mcq" ? (q?.type || "mcq") === "mcq" : q?.type === "coding"
      );
    if (nextQs.length) {
      const sec = String(nextQs[0].q?.section || "").trim() || "General";
      setActiveSection(sec);
      const subs = getMockSubSectionsForSection(
        questions,
        nextPart === "coding" ? "coding" : "mcq",
        sec
      );
      setActiveSubSection(subs[0] || "General");
    }
  }

  if (loading) {
    return (
      <CheckAuth>
        <div className="min-h-dvh flex items-center justify-center bg-gray-100">Loading...</div>
      </CheckAuth>
    );
  }

  if (!test) {
    return (
      <CheckAuth>
        <div className="min-h-dvh pt-24 px-4 text-center">
          <p className="text-gray-700 mb-4">Mock test not found.</p>
          <Link href={`/mock-test/${companySlug}`} className="text-[#00448a] hover:underline">
            Back to {companyLabel}
          </Link>
        </div>
      </CheckAuth>
    );
  }

  if (secure.isBlocked) {
    return (
      <CheckAuth>
        <div className="min-h-dvh flex items-center justify-center bg-red-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-8 text-center">
            <h1 className="text-xl font-bold text-red-900 mb-2">Test Blocked</h1>
            <p className="text-sm text-red-700 mb-6">{secure.blockReason}</p>
            <Link href={`/mock-test/${companySlug}`} className="inline-block px-5 py-2.5 rounded-lg bg-[#00448a] text-white">
              Back to {companyLabel}
            </Link>
          </div>
        </div>
      </CheckAuth>
    );
  }

  if (!secure.started) {
    return (
      <CheckAuth>
        <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-cyan-50 pt-24 px-4 sm:px-6 pb-10">
          <div className="max-w-2xl mx-auto">
            <button type="button" onClick={() => router.push(`/mock-test/${companySlug}`)} className="text-sm text-[#00448a] hover:underline mb-4">
              ← Back to {companyLabel}
            </button>
            <div className="bg-white rounded-2xl shadow border p-6 sm:p-8">
              <p className="text-sm text-[#00448a] font-medium">{companyLabel}</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">{test.title || "Mock Test"}</h1>
              <div className="flex flex-wrap gap-2 mt-3 text-sm">
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-800">{summary.mcq} MCQ</span>
                <span className="px-2 py-1 rounded bg-violet-50 text-violet-800">{summary.coding} Coding</span>
                {durationMinutes ? <span>{durationMinutes} min</span> : null}
              </div>
              <ul className="mt-6 list-disc pl-5 text-sm text-gray-700 space-y-1">
                <li>One question at a time with side question palette.</li>
                <li>Fullscreen mode (except iPhone/iPad).</li>
                <li>3 tab switches block the test.</li>
              </ul>
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={secure.acceptedRules} onChange={(e) => secure.setAcceptedRules(e.target.checked)} />
                I agree to the rules.
              </label>
              <button type="button" onClick={() => secure.startExam()} disabled={!secure.acceptedRules} className="mt-5 px-6 py-3 rounded-lg bg-[#00448a] text-white font-medium disabled:opacity-50">
                Start Test
              </button>
            </div>
          </div>
        </div>
      </CheckAuth>
    );
  }

  if (submitted && scoreDetail) {
    return (
      <CheckAuth>
        <div className="min-h-dvh flex items-center justify-center bg-gray-100 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Submitted</h1>
            <div className="space-y-2 text-left bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="font-semibold text-green-900">Results</p>
              <p className="text-green-800">MCQ: {scoreDetail.mcqCorrect} / {scoreDetail.mcqTotal}</p>
              {scoreDetail.codingMax > 0 && (
                <p className="text-green-800">
                  Coding: {Math.round(scoreDetail.codingScore)} / {scoreDetail.codingMax}
                </p>
              )}
            </div>
            <Link href={`/mock-test/${companySlug}`} className="inline-block px-6 py-3 rounded-lg bg-[#00448a] text-white font-medium">
              Back to {companyLabel}
            </Link>
          </div>
        </div>
      </CheckAuth>
    );
  }

  const isMcq = (currentQ?.type || "mcq") === "mcq";
  const options = isMcq ? normalizeMockQuestionOptions(currentQ?.options) : [];
  const codingResults = runResults[currentIdx] || [];

  return (
    <CheckAuth>
      <SecureExamOverlays
        started={secure.started}
        isBlocked={secure.isBlocked}
        inFullscreen={secure.inFullscreen}
        tabSwitchCount={secure.tabSwitchCount}
        showTabWarning={secure.showTabWarning}
        dismissTabWarning={secure.dismissTabWarning}
        requestFullscreen={secure.requestFullscreen}
      />

      <div className="fixed inset-0 z-[90] flex flex-col bg-[#eef2f7] min-h-dvh">
        {/* Top bar */}
        <div className="bg-[#00448a] text-white shrink-0">
          <div className="px-4 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-white/80 truncate">{companyLabel}</p>
              <h1 className="text-sm sm:text-base font-bold truncate">{test.title || "Mock Test"}</h1>
            </div>
            {secure.timeLeftMs != null && (
              <div className="text-right shrink-0">
                <p className="text-[10px] text-white/70 uppercase">Time Left</p>
                <p className="text-lg font-mono font-bold tabular-nums">
                  {secure.formatTime(secure.timeLeftMs)}
                </p>
              </div>
            )}
          </div>

          {/* Part tabs */}
          <div className="flex border-t border-white/20">
            {summary.mcq > 0 && (
              <button
                type="button"
                onClick={() => switchPart("mcq")}
                className={`flex-1 py-2.5 text-sm font-medium transition ${
                  part === "mcq" ? "bg-white text-[#00448a]" : "text-white/90 hover:bg-white/10"
                }`}
              >
                MCQ ({summary.mcq})
              </button>
            )}
            {summary.coding > 0 && (
              <button
                type="button"
                onClick={() => switchPart("coding")}
                className={`flex-1 py-2.5 text-sm font-medium transition ${
                  part === "coding" ? "bg-white text-[#00448a]" : "text-white/90 hover:bg-white/10"
                }`}
              >
                Coding ({summary.coding})
              </button>
            )}
          </div>
        </div>

        {/* Section tabs */}
        {sectionsInPart.length > 0 && (
          <div className="bg-white border-b shrink-0 px-4 py-2">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Sections</p>
            <div className="flex flex-wrap gap-2">
              {sectionsInPart.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setActiveSection(sec);
                    const subs = getMockSubSectionsForSection(
                      questions,
                      part === "coding" ? "coding" : "mcq",
                      sec
                    );
                    setActiveSubSection(subs[0] || "General");
                  }}
                  className={`px-4 py-1.5 rounded text-sm font-medium border transition ${
                    activeSection === sec
                      ? "bg-[#00448a] text-white border-[#00448a]"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#00448a]/40"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
            {subSectionsInSection.length > 0 && (
              <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Sub-sections</p>
                <div className="flex flex-wrap gap-2">
                  {subSectionsInSection.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setActiveSubSection(sub)}
                      className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                        activeSubSection === sub
                          ? "bg-[#26ebe5] text-[#00448a] border-[#26ebe5]"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#00448a]/40"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main question panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {currentQ ? (
                <div className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-500">
                        Question Type:{" "}
                        <span className="font-semibold text-gray-800">
                          {isMcq ? "Multiple Choice" : "Coding"}
                        </span>
                      </p>
                      <p className="text-sm font-bold text-[#00448a]">
                        Question No. {(currentPos >= 0 ? currentPos : 0) + 1}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-[#26ebe5]/20 text-[#00448a] font-medium">
                      {activeSection}
                      {subSectionsInSection.length > 0 ? ` › ${activeSubSection}` : ""}
                    </span>
                  </div>

                  <div className="p-4 sm:p-6">
                    <p className="text-base sm:text-lg font-semibold text-gray-900 leading-relaxed">
                      {currentQ.question || currentQ.title || "Question"}
                    </p>
                    {currentQ.description ? (
                      <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{currentQ.description}</p>
                    ) : null}

                    {isMcq ? (
                      <div className="mt-5 space-y-2">
                        {options.map((option, optIdx) => {
                          const selected = answers[currentIdx] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                selected
                                  ? "border-[#00448a] bg-blue-50"
                                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${currentIdx}`}
                                checked={selected}
                                onChange={() => setAnswers((p) => ({ ...p, [currentIdx]: optIdx }))}
                                className="mt-1 shrink-0"
                              />
                              <span className="text-sm text-gray-800">
                                <span className="font-semibold mr-2">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {option || `Option ${optIdx + 1}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-5 space-y-4">
                        {(currentQ.testCases || []).length > 0 && (
                          <div className="rounded border bg-gray-50 p-3 text-xs">
                            <p className="font-semibold mb-2">Test cases</p>
                            {(currentQ.testCases || []).slice(0, 2).map((tc, i) => (
                              <div key={i} className="grid sm:grid-cols-2 gap-2 mb-2">
                                <pre className="bg-white border rounded p-2 whitespace-pre-wrap">{tc.input || "—"}</pre>
                                <pre className="bg-white border rounded p-2 whitespace-pre-wrap">{tc.output || "—"}</pre>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={codeLanguages[currentIdx] || currentQ.language || "javascript"}
                            onChange={(e) =>
                              setCodeLanguages((p) => ({ ...p, [currentIdx]: e.target.value }))
                            }
                            className="border rounded px-3 py-1.5 text-sm"
                          >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="c">C</option>
                            <option value="cpp">C++</option>
                          </select>
                          <button
                            type="button"
                            onClick={handleRunCode}
                            disabled={runLoading[currentIdx]}
                            className="px-4 py-1.5 rounded bg-[#00448a] text-white text-sm disabled:opacity-60"
                          >
                            {runLoading[currentIdx] ? "Running..." : "Run Code"}
                          </button>
                        </div>
                        <textarea
                          value={answers[currentIdx] ?? currentQ.starterCode ?? ""}
                          onChange={(e) => setAnswers((p) => ({ ...p, [currentIdx]: e.target.value }))}
                          rows={14}
                          className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                          spellCheck={false}
                        />
                        {codingResults.length > 0 && (
                          <div className="text-sm space-y-1">
                            {codingResults.map((r, i) => (
                              <p key={i} className={r.pass ? "text-green-700" : "text-red-700"}>
                                Case {i + 1}: {r.pass ? "Passed" : "Failed"}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => goNext(true)}
                        className="px-4 py-2 rounded border border-purple-300 bg-purple-50 text-purple-800 text-sm font-medium hover:bg-purple-100"
                      >
                        Mark for Review &amp; Next
                      </button>
                      <button
                        type="button"
                        onClick={clearCurrentResponse}
                        className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                      >
                        Clear Response
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => goNext(false)}
                      disabled={currentPos >= sectionQuestions.length - 1}
                      className="px-5 py-2 rounded bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-medium disabled:opacity-40"
                    >
                      Save &amp; Next
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">No questions in this section.</p>
              )}
            </div>
          </div>

          {/* Right sidebar — question palette */}
          <aside className="w-full sm:w-72 lg:w-80 shrink-0 border-l border-gray-300 bg-white flex flex-col overflow-hidden hidden sm:flex">
            <div className="p-4 border-b bg-gradient-to-b from-gray-50 to-white">
              <p className="text-xs text-gray-500 uppercase font-semibold">Question Palette</p>
              <p className="text-sm font-medium text-[#00448a] mt-1">
                {activeSection}
                {subSectionsInSection.length > 0 ? ` › ${activeSubSection}` : ""} ·{" "}
                {part === "mcq" ? "MCQ" : "Coding"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 gap-2">
                {sectionQuestions.map(({ index }, localIdx) => {
                  const status = getStatus(index);
                  const isCurrent = index === currentIdx;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      className={`h-10 w-full rounded border text-sm font-semibold transition ${paletteButtonClass(status, isCurrent)}`}
                      title={`Question ${localIdx + 1}`}
                    >
                      {localIdx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 space-y-2 text-xs">
                <p className="font-semibold text-gray-700 mb-2">Legend</p>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-green-500 shrink-0" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-red-500 shrink-0" />
                  <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-purple-500 shrink-0" />
                  <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-white border border-gray-300 shrink-0" />
                  <span>Not Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-orange-500 shrink-0" />
                  <span>Current Question</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm"
              >
                Submit Test
              </button>
              {!allAnswered && (
                <p className="text-[10px] text-center text-gray-500">
                  Some questions are unanswered
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Mobile palette strip */}
        <div className="sm:hidden border-t bg-white p-3 shrink-0 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-1">
            {sectionQuestions.map(({ index }, localIdx) => {
              const status = getStatus(index);
              const isCurrent = index === currentIdx;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToQuestion(index)}
                  className={`h-9 w-9 shrink-0 rounded border text-xs font-semibold ${paletteButtonClass(status, isCurrent)}`}
                >
                  {localIdx + 1}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleSubmit}
              className="h-9 px-4 shrink-0 rounded bg-green-600 text-white text-xs font-semibold"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </CheckAuth>
  );
}
