"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import CheckAuth from "@/lib/CheckAuth";
import { isAppleMobileDevice } from "@/lib/deviceDetect";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  blockMockTestAccount,
  buildMockQuestionShuffleRanks,
  fetchMockTest,
  fetchMockTestAccountBlock,
  fetchMockTestGroup,
  formatMockSubSectionLabel,
  getMockFullSectionMinutes,
  getMockQuestionSubSection,
  getMockRemainingSectionBasedMs,
  getMockScopeTiming,
  hasMockSectionBasedTiming,
  isMockAnswerCorrect,
  isMockTestAccountBlocked,
  isMockTestLocked,
  MOCK_JUDGE_LANGUAGES,
  mockSubSectionTimingKey,
  normalizeMockQuestionOptions,
  normalizeMockSectionTimings,
  normalizeMockSubSectionTimings,
  orderMockSectionsForExam,
  orderMockSubSectionsForExam,
  saveMockTestSubmission,
  summarizeMockTestQuestions,
  transformMockCompilerInput,
  buildMockSectionScores,
  buildMockSubSectionScores,
  mockTestAttemptPercent,
} from "@/lib/mockTests";
import { makeAuthenticatedRequest } from "@/lib/authUtils";
import {
  MOCK_RESULT_WA_TEMPLATE,
  buildMockExamReportScorecardPayload,
  buildMockResultWhatsAppParams,
  pickStudentPhone,
} from "@/lib/mockTestResultWhatsApp";
import {
  MOCK_PUBLIC_MODE_SEQUENTIAL,
  normalizeMockPublicPhone,
  readMockPublicSession,
  resolveMockPublicAssignment,
  writeMockPublicSession,
} from "@/lib/mockTestPublicLinks";
import { formatExamTime, useNoCopy, useSecureExamSession } from "@/lib/useSecureExamSession";
import { ExamPageSkeleton } from "@/components/PageSkeleton";
import { downloadMockTestScorecardPdf } from "@/lib/mockTestScorecardPdf";

const VAWE_INSTITUTE_HOME_URL = "https://www.vaweinstitute.com/";
const INSTITUTE_REDIRECT_SECONDS = 300; // 5 minutes on scorecard

function AuthGate({ publicMode, children }) {
  if (publicMode) return children;
  return <CheckAuth>{children}</CheckAuth>;
}

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
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tab-warning-title"
            className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center border-4 ${
              tabSwitchCount >= 3
                ? "border-red-600"
                : tabSwitchCount >= 2
                  ? "border-red-500"
                  : "border-orange-500"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-wide mb-2 ${
                tabSwitchCount >= 2 ? "text-red-700" : "text-orange-600"
              }`}
            >
              Warning {Math.min(Math.max(tabSwitchCount, 1), 3)} of 3
            </p>
            <h2 id="tab-warning-title" className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Don&apos;t exit the page
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              {tabSwitchCount >= 3
                ? "You left the tab 3 times. The test will be locked when you continue."
                : tabSwitchCount >= 2
                  ? "Final warning — one more leave will lock the test."
                  : "Tab switching is not allowed during the test."}
            </p>
            <p className="text-xs text-gray-500 mb-5">
              {tabSwitchCount >= 3
                ? "Click below to acknowledge. Your attempt will be blocked."
                : `You have ${3 - Math.min(Math.max(tabSwitchCount, 1), 3)} warning(s) left.`}
            </p>
            <button
              type="button"
              onClick={dismissTabWarning}
              className={`px-6 py-2.5 text-white rounded-lg font-semibold ${
                tabSwitchCount >= 3
                  ? "bg-red-700 hover:bg-red-800"
                  : tabSwitchCount >= 2
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {tabSwitchCount >= 3 ? "OK — lock test" : "Continue test"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function extractCompilerError(data, resOk) {
  const compileOutput = String(data?.compile_output || data?.raw?.compile_output || "").trim();
  const stderr = String(data?.stderr || "").trim();
  const apiError = String(data?.error || "").trim();
  const status = String(data?.status || data?.raw?.status?.description || "").trim();
  if (apiError) return apiError;
  if (compileOutput) return compileOutput;
  if (/compil/i.test(status) && (stderr || data?.stdout)) {
    return stderr || String(data.stdout || "").trim();
  }
  if (stderr) return stderr;
  if (!resOk) return status || "Could not run code.";
  if (/error|fail|time.?limit/i.test(status) && !String(data?.stdout || "").trim()) {
    return status;
  }
  return "";
}

function isCompileFailure(data, errorText) {
  const status = String(data?.status || data?.raw?.status?.description || "");
  const compileOutput = String(data?.compile_output || data?.raw?.compile_output || "").trim();
  return Boolean(compileOutput) || /compil/i.test(status) || /compil/i.test(errorText || "");
}

/** Visible sample cases only (max 2). Hidden cases stay for scoring, not for Run Code UI. */
function getMockSampleTestCases(testCases, limit = 2) {
  const cases = Array.isArray(testCases) ? testCases : [];
  const visible = cases.filter((tc) => !tc?.hidden);
  const pool = visible.length ? visible : cases;
  return pool.slice(0, Math.max(0, limit));
}

async function runCodingTestCases(code, language, testCases) {
  const results = [];
  const cases = Array.isArray(testCases) ? testCases : [];
  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const expected = String(tc?.output || "").trim();
    const input = String(tc?.input || "");
    const hidden = !!tc?.hidden;
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
      const data = await res.json().catch(() => ({}));
      const error = extractCompilerError(data, res.ok);
      const actual = String(data.stdout || "").trim();
      const pass = !error && actual.toLowerCase() === expected.toLowerCase();
      results.push({
        pass,
        actual,
        expected,
        input,
        hidden,
        error,
        status: String(data?.status || ""),
      });
      if (error && isCompileFailure(data, error)) {
        for (let j = i + 1; j < cases.length; j++) {
          results.push({
            pass: false,
            actual: "",
            expected: String(cases[j]?.output || "").trim(),
            input: String(cases[j]?.input || ""),
            hidden: !!cases[j]?.hidden,
            error: "Skipped — fix the compile error and run again.",
            skipped: true,
            status: "",
          });
        }
        break;
      }
    } catch (err) {
      results.push({
        pass: false,
        actual: "",
        expected,
        input,
        hidden,
        error: err?.message || "Could not reach the compiler.",
        status: "Network error",
      });
      break;
    }
  }
  return results;
}

function MockQuestionImage({ src }) {
  const [open, setOpen] = useState(false);
  const url = String(src || "").trim();
  if (!url) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Question"
          className="max-w-full max-h-80 xl:max-h-[28rem] rounded-lg border border-gray-200 object-contain bg-gray-50"
        />
        <span className="mt-1 block text-[11px] text-gray-500">Click image to enlarge</span>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Question image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Question"
            className="max-h-[90vh] max-w-full rounded-lg bg-white object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

function paletteButtonClass(status, isCurrent) {
  if (isCurrent) return "bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300";
  if (status === "answered") return "bg-green-500 text-white border-green-600";
  if (status === "review") return "bg-purple-500 text-white border-purple-600";
  if (status === "not-answered") return "bg-red-500 text-white border-red-600";
  return "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";
}

function TakeMockTestPage() {
  const { companySlug, testId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicLinkId = String(searchParams.get("link") || "").trim();
  const publicMode = searchParams.get("public") === "1" && Boolean(publicLinkId);
  const [publicSession, setPublicSession] = useState(null);
  const [publicGateError, setPublicGateError] = useState("");
  const [nextSequentialBusy, setNextSequentialBusy] = useState(false);
  const [test, setTest] = useState(null);
  const [group, setGroup] = useState(null);
  const [groupLabel, setGroupLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState("General");
  const [activeSubSection, setActiveSubSection] = useState("General");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState({});
  const [reviewMap, setReviewMap] = useState({});
  const [codeLanguages, setCodeLanguages] = useState({});
  const [runResults, setRunResults] = useState({});
  const [runLoading, setRunLoading] = useState({});
  const [scoreDetail, setScoreDetail] = useState(null);
  const [lockedAccount, setLockedAccount] = useState(null);
  const [scopeTimeLeftMs, setScopeTimeLeftMs] = useState(null);
  const [pageNotice, setPageNotice] = useState(null);
  const [startCountdown, setStartCountdown] = useState(null);
  const [examEnterVisible, setExamEnterVisible] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  /** 1 = general instructions, 2 = section / sub-section timing table */
  const [instructionsStep, setInstructionsStep] = useState(1);
  /** Rank of each question index for this attempt (lower = earlier). Keeps answers keyed by original index. */
  const [questionShuffleRank, setQuestionShuffleRank] = useState({});
  const [embedInstituteSite, setEmbedInstituteSite] = useState(false);
  const [instituteCountdown, setInstituteCountdown] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const didInitPart = useRef(false);
  const onScopeTimeUpRef = useRef(null);
  const advancingScopeRef = useRef(false);
  const countdownTimerRef = useRef(null);
  const instituteTimerRef = useRef(null);
  const instituteCountdownRef = useRef(null);

  useEffect(() => {
    if (!publicMode) {
      setPublicSession(null);
      setPublicGateError("");
      return;
    }
    const session = readMockPublicSession(publicLinkId);
    if (!session?.phoneVerified || !session?.phone || !session?.name) {
      setPublicGateError("Please complete registration and WhatsApp verification first.");
      setPublicSession(null);
      return;
    }
    if (String(session.testId) !== String(testId)) {
      setPublicGateError("This test does not match your assigned public link paper.");
      setPublicSession(session);
      return;
    }
    setPublicSession(session);
    setPublicGateError("");
  }, [publicMode, publicLinkId, testId]);

  const companyLabel = groupLabel || String(companySlug || "").replace(/_/g, " ");
  const timingEnabled = useMemo(() => hasMockSectionBasedTiming(test), [test]);
  const durationMinutes = timingEnabled ? 0 : Number(test?.durationMinutes) || 0;

  const loadStudentProfile = useCallback(async (user) => {
    let name = user?.displayName || "";
    let email = user?.email || "";
    if (user?.uid && db) {
      try {
        const [userSnap, studentSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "students", user.uid)),
        ]);
        if (studentSnap.exists()) {
          name = studentSnap.data()?.name || name;
          email = studentSnap.data()?.email || email;
        }
        if (userSnap.exists()) {
          name = userSnap.data()?.name || name;
          email = userSnap.data()?.email || email;
        }
      } catch {
        /* keep auth profile */
      }
    }
    return { name, email };
  }, []);

  const persistAccountLock = useCallback(
    async ({ reason, count }) => {
      if (!companySlug || !testId) return;
      try {
        if (publicMode && publicSession?.phone) {
          const userId = normalizeMockPublicPhone(publicSession.phone);
          await blockMockTestAccount(companySlug, testId, {
            userId,
            name: publicSession.name || "",
            email: "",
            reason,
            tabSwitchCount: count,
          });
          setLockedAccount({
            userId,
            name: publicSession.name || "",
            email: "",
            blocked: true,
            reason,
            tabSwitchCount: count,
          });
          return;
        }
        const user = auth?.currentUser;
        if (!user?.uid) return;
        const { name, email } = await loadStudentProfile(user);
        await blockMockTestAccount(companySlug, testId, {
          userId: user.uid,
          name,
          email,
          reason,
          tabSwitchCount: count,
        });
        setLockedAccount({
          userId: user.uid,
          name,
          email,
          blocked: true,
          reason,
          tabSwitchCount: count,
        });
      } catch (e) {
        console.error("Failed to lock mock test account:", e);
      }
    },
    [companySlug, testId, loadStudentProfile, publicMode, publicSession]
  );

  const secure = useSecureExamSession({
    durationMinutes,
    onBlocked: ({ reason, count }) => {
      persistAccountLock({ reason, count });
    },
  });
  useNoCopy({ enabled: secure.started && !submitted, allowEditable: true });
  const { markSubmitted, setOnTimeUp, suppressViolations } = secure;

  const showStayOnPageNotice = useCallback(
    (detail = "", { mode = "stay" } = {}) => {
      suppressViolations(8000);
      if (mode === "section") {
        setPageNotice({
          mode: "section",
          message:
            detail || "You cannot move to another section until the time is out.",
        });
        return;
      }
      setPageNotice({
        mode: "stay",
        message: detail
          ? `Don't exit the page. ${detail}`
          : "Don't exit the page. Stay on this screen until the timer ends.",
      });
    },
    [suppressViolations]
  );

  useEffect(() => {
    if (!pageNotice) return undefined;
    suppressViolations(8000);
    const id = setInterval(() => suppressViolations(8000), 3000);
    return () => clearInterval(id);
  }, [pageNotice, suppressViolations]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!secure.started) {
      setExamEnterVisible(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setExamEnterVisible(true));
    return () => cancelAnimationFrame(id);
  }, [secure.started]);

  async function beginStartCountdown() {
    if (startingExam || startCountdown != null) return;
    setStartingExam(true);
    try {
      const lockId = publicMode
        ? normalizeMockPublicPhone(publicSession?.phone)
        : auth?.currentUser?.uid;
      if (lockId) {
        const block = await fetchMockTestAccountBlock(companySlug, testId, lockId);
        if (isMockTestAccountBlocked(block)) {
          setLockedAccount(block);
          setStartingExam(false);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to check mock test account lock:", e);
    }

    const clearCountdownTimer = () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };

    const wait = (ms) =>
      new Promise((resolve) => {
        clearCountdownTimer();
        countdownTimerRef.current = setTimeout(resolve, ms);
      });

    try {
      suppressViolations(20000);
      setStartCountdown(3);
      await wait(900);
      suppressViolations(4000);
      setStartCountdown(2);
      await wait(900);
      suppressViolations(4000);
      setStartCountdown(1);
      await wait(900);
      suppressViolations(5000);
      setStartCountdown("Go");
      await wait(700);

      const ok = await secure.startExam();
      if (!ok) {
        setStartCountdown(null);
        setStartingExam(false);
        return;
      }

      await wait(350);
      setStartCountdown(null);
      setStartingExam(false);
    } catch (e) {
      console.error("Failed to start exam countdown:", e);
      setStartCountdown(null);
      setStartingExam(false);
    }
  }

  const questions = useMemo(
    () => (Array.isArray(test?.questions) ? test.questions : []),
    [test]
  );

  const summary = useMemo(
    () => summarizeMockTestQuestions(questions, test?.sectionOrder),
    [questions, test?.sectionOrder]
  );

  const allQuestionEntries = useMemo(
    () => questions.map((q, index) => ({ q, index })),
    [questions]
  );

  const allSections = useMemo(
    () => orderMockSectionsForExam(questions, test?.sectionOrder),
    [questions, test?.sectionOrder]
  );

  const subSectionsInSection = useMemo(
    () =>
      orderMockSubSectionsForExam(
        questions,
        activeSection,
        test?.subSectionOrder
      ),
    [questions, activeSection, test?.subSectionOrder]
  );

  const scopeTiming = useMemo(
    () =>
      getMockScopeTiming({
        section: activeSection,
        subSection: activeSubSection,
        subSectionsInSection,
        sectionTimings: test?.sectionTimings,
        subSectionTimings: test?.subSectionTimings,
      }),
    [
      activeSection,
      activeSubSection,
      subSectionsInSection,
      test?.sectionTimings,
      test?.subSectionTimings,
    ]
  );

  const sectionQuestions = useMemo(() => {
    const filtered = allQuestionEntries.filter(({ q }) => {
      const sec = String(q?.section || "").trim() || "General";
      if (sec !== activeSection) return false;
      if (!subSectionsInSection.length) return true;
      const sub = getMockQuestionSubSection(q) || "General";
      return sub === activeSubSection;
    });
    // Jumble within the current section / sub-section.
    return [...filtered].sort((a, b) => {
      const ra = Number(questionShuffleRank[a.index]);
      const rb = Number(questionShuffleRank[b.index]);
      const aRank = Number.isFinite(ra) ? ra : a.index;
      const bRank = Number.isFinite(rb) ? rb : b.index;
      return aRank - bRank;
    });
  }, [
    allQuestionEntries,
    activeSection,
    activeSubSection,
    subSectionsInSection,
    questionShuffleRank,
  ]);

  const currentPos = sectionQuestions.findIndex(({ index }) => index === activeIndex);
  const currentEntry = sectionQuestions[currentPos >= 0 ? currentPos : 0];
  const currentQ = currentEntry?.q;
  const currentIdx = currentEntry?.index ?? activeIndex;

  useEffect(() => {
    if (didInitPart.current) return;
    if (allSections.length) {
      setActiveSection(allSections[0]);
      didInitPart.current = true;
    }
  }, [allSections]);

  useEffect(() => {
    if (allSections.length && !allSections.includes(activeSection)) {
      setActiveSection(allSections[0]);
    }
  }, [allSections, activeSection]);

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
    // Reset to first question when section / sub-section changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on navigation scope change
  }, [activeSection, activeSubSection]);

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
    let mcqAnswered = 0;
    let codingAttempted = 0;
    const questionBreakdown = [];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const section = String(q?.section || "").trim() || "General";
      const subSection = getMockQuestionSubSection(q) || "";
      if ((q?.type || "mcq") === "mcq") {
        mcqTotal += 1;
        const unanswered = answers[idx] == null || answers[idx] === "";
        if (!unanswered) mcqAnswered += 1;
        const correct = isMockAnswerCorrect(q, answers[idx]);
        if (correct) mcqCorrect += 1;
        questionBreakdown.push({
          i: idx,
          type: "mcq",
          section,
          subSection,
          correct,
          unanswered,
        });
      } else if (q?.type === "coding") {
        const maxScore = Number(q.maxScore) || 10;
        codingMax += maxScore;
        const code = answers[idx] || q.starterCode || "";
        const lang = codeLanguages[idx] || q.language || "javascript";
        const cases = Array.isArray(q.testCases) ? q.testCases : [];
        const attempted =
          Boolean(String(code).trim()) &&
          String(code).trim() !== String(q.starterCode || "").trim();
        if (attempted) codingAttempted += 1;
        let passed = 0;
        if (cases.length && String(code).trim()) {
          const results = await runCodingTestCases(code, lang, cases);
          passed = results.filter((r) => r.pass).length;
          codingScore += maxScore * (passed / cases.length);
        }
        questionBreakdown.push({
          i: idx,
          type: "coding",
          section,
          subSection,
          passed,
          totalCases: cases.length,
          score: cases.length ? maxScore * (passed / cases.length) : 0,
          maxScore,
          attempted,
        });
      }
    }

    const percent = mockTestAttemptPercent({ mcqCorrect, mcqTotal, codingScore, codingMax });
    const score = { mcqCorrect, mcqTotal, codingScore, codingMax };
    const sectionScores = buildMockSectionScores(questionBreakdown);
    const subSectionScores = buildMockSubSectionScores(questionBreakdown);
    const submittedAt = new Date().toISOString();

    const baseScorecard = {
      ...score,
      percent,
      sectionScores,
      subSectionScores,
      questionBreakdown,
      testTitle: test?.title || "Mock Test",
      testId,
      submittedAt,
      companyLabel: groupLabel || companySlug || "Mock Test",
    };

    if (publicMode && publicSession) {
      setScoreDetail({
        ...baseScorecard,
        name: publicSession.name || "",
        email: "",
        phone: normalizeMockPublicPhone(publicSession.phone),
        college: publicSession.college || "",
        branch: publicSession.branch || "",
        source: "public_link",
      });
    } else {
      setScoreDetail(baseScorecard);
    }
    setSubmitted(true);
    markSubmitted();

    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* ignore */
    }

    try {
      if (publicMode && publicSession?.phone && companySlug && testId) {
        const phone = normalizeMockPublicPhone(publicSession.phone);
        await saveMockTestSubmission(companySlug, testId, {
          userId: phone,
          name: publicSession.name || "",
          email: "",
          phone,
          college: publicSession.college || "",
          branch: publicSession.branch || "",
          source: "public_link",
          publicLinkId,
          ...score,
          mcqAnswered,
          codingAttempted,
          questionBreakdown,
          sectionScores,
          subSectionScores,
        });
        return;
      }

      const user = auth?.currentUser;
      if (user?.uid && companySlug && testId) {
        let name = user.displayName || "";
        let email = user.email || "";
        let phone = "";
        let college = "";
        let branch = "";
        if (db) {
          const [userSnap, studentSnap] = await Promise.all([
            getDoc(doc(db, "users", user.uid)),
            getDoc(doc(db, "students", user.uid)),
          ]);
          if (studentSnap.exists()) {
            const studentData = studentSnap.data() || {};
            name = studentData.name || name;
            email = studentData.email || email;
            phone = pickStudentPhone(studentData);
            college = studentData.college || studentData.collegeName || "";
            branch = studentData.branch || "";
          }
          if (userSnap.exists()) {
            const userData = userSnap.data() || {};
            name = userData.name || name;
            email = userData.email || email;
            if (!phone) phone = pickStudentPhone(userData);
            if (!college) college = userData.college || userData.collegeName || "";
            if (!branch) branch = userData.branch || "";
          }
        }
        setScoreDetail((prev) => ({
          ...(prev || baseScorecard),
          name,
          email,
          phone,
          college,
          branch,
        }));
        await saveMockTestSubmission(companySlug, testId, {
          userId: user.uid,
          name,
          email,
          ...score,
          mcqAnswered,
          codingAttempted,
          questionBreakdown,
          sectionScores,
          subSectionScores,
        });
        if (phone) {
          const resultRow = {
            name,
            email,
            phone,
            college,
            branch,
            testTitle: test?.title || "Mock Test",
            testId,
            submittedAt,
            ...score,
            percent,
            sectionScores,
            subSectionScores,
            questionBreakdown,
          };
          const waRes = await makeAuthenticatedRequest("/api/send-whatsapp-template", {
            method: "POST",
            body: JSON.stringify({
              phone,
              template: MOCK_RESULT_WA_TEMPLATE,
              language: "en",
              bodyParams: buildMockResultWhatsAppParams(resultRow),
              scorecardRow: buildMockExamReportScorecardPayload(resultRow),
              companyLabel: groupLabel || companySlug || "Mock Test",
            }),
          });
          if (!waRes.ok) {
            const waErr = await waRes.json().catch(() => ({}));
            console.error("Failed to send mock test WhatsApp result:", waErr.error || waRes.status);
          }
        }
      }
    } catch (e) {
      console.error("Failed to save mock test result:", e);
    }
  }, [
    questions,
    answers,
    codeLanguages,
    markSubmitted,
    companySlug,
    testId,
    test?.title,
    groupLabel,
    publicMode,
    publicSession,
    publicLinkId,
  ]);

  useEffect(() => {
    setOnTimeUp(() => {
      finalizeSubmit();
      alert("Time is up. Your test has been submitted automatically.");
    });
  }, [setOnTimeUp, finalizeSubmit]);

  const isSequentialPublicPending =
    publicMode &&
    (publicSession?.mode === MOCK_PUBLIC_MODE_SEQUENTIAL ||
      Number(publicSession?.totalSteps || 0) > 1);

  useEffect(() => {
    if (!submitted || !scoreDetail || isSequentialPublicPending) {
      setInstituteCountdown(null);
      return undefined;
    }

    setEmbedInstituteSite(false);
    setInstituteCountdown(INSTITUTE_REDIRECT_SECONDS);

    if (instituteCountdownRef.current) clearInterval(instituteCountdownRef.current);
    if (instituteTimerRef.current) clearTimeout(instituteTimerRef.current);

    instituteCountdownRef.current = setInterval(() => {
      setInstituteCountdown((prev) => {
        if (prev == null || prev <= 1) {
          if (instituteCountdownRef.current) {
            clearInterval(instituteCountdownRef.current);
            instituteCountdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    instituteTimerRef.current = setTimeout(() => {
      if (instituteCountdownRef.current) {
        clearInterval(instituteCountdownRef.current);
        instituteCountdownRef.current = null;
      }
      setEmbedInstituteSite(true);
    }, INSTITUTE_REDIRECT_SECONDS * 1000);

    return () => {
      if (instituteCountdownRef.current) {
        clearInterval(instituteCountdownRef.current);
        instituteCountdownRef.current = null;
      }
      if (instituteTimerRef.current) {
        clearTimeout(instituteTimerRef.current);
        instituteTimerRef.current = null;
      }
    };
  }, [submitted, scoreDetail, isSequentialPublicPending]);

  function formatInstituteCountdown(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function openInstituteSiteNow() {
    if (instituteCountdownRef.current) {
      clearInterval(instituteCountdownRef.current);
      instituteCountdownRef.current = null;
    }
    if (instituteTimerRef.current) {
      clearTimeout(instituteTimerRef.current);
      instituteTimerRef.current = null;
    }
    setInstituteCountdown(0);
    setEmbedInstituteSite(true);
  }

  async function handleDownloadScorecard() {
    if (!scoreDetail || pdfDownloading) return;
    setPdfDownloading(true);
    try {
      await downloadMockTestScorecardPdf(scoreDetail, {
        companyLabel: scoreDetail.companyLabel || companyLabel,
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to download scorecard.");
    } finally {
      setPdfDownloading(false);
    }
  }

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
          setGroup(group);
          setGroupLabel(group?.label || String(companySlug || "").replace(/_/g, " "));
          setTest(data);
          const langs = {};
          const initialAnswers = {};
          const qList = Array.isArray(data?.questions) ? data.questions : [];
          qList.forEach((q, idx) => {
            if (q?.type === "coding") {
              langs[idx] = q.language || "javascript";
              if (q.starterCode) initialAnswers[idx] = q.starterCode;
            }
          });
          // Jumble questions for this attempt. A shared passage stays with its set.
          setQuestionShuffleRank(buildMockQuestionShuffleRanks(qList));
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

  useEffect(() => {
    if (!companySlug || !testId) return undefined;

    if (publicMode) {
      let cancelled = false;
      (async () => {
        const phone = normalizeMockPublicPhone(publicSession?.phone);
        if (!phone) {
          setLockedAccount(null);
          return;
        }
        try {
          const block = await fetchMockTestAccountBlock(companySlug, testId, phone);
          if (!cancelled) {
            setLockedAccount(isMockTestAccountBlocked(block) ? block : null);
          }
        } catch (e) {
          console.error("Failed to load public mock test account lock:", e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user?.uid) {
        setLockedAccount(null);
        return;
      }
      try {
        const block = await fetchMockTestAccountBlock(companySlug, testId, user.uid);
        setLockedAccount(isMockTestAccountBlocked(block) ? block : null);
      } catch (e) {
        console.error("Failed to load mock test account lock:", e);
      }
    });
    return () => unsub();
  }, [companySlug, testId, publicMode, publicSession?.phone]);

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
    goToNextScope();
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
    // Run only sample (non-hidden) cases — show at most 2. Hidden cases stay for final scoring.
    const sampleCases = getMockSampleTestCases(q?.testCases, 2);
    if (!sampleCases.length) {
      alert("No sample test cases available for this question.");
      return;
    }
    setRunLoading((p) => ({ ...p, [currentIdx]: true }));
    const results = await runCodingTestCases(
      code,
      codeLanguages[currentIdx] || q?.language || "javascript",
      sampleCases
    );
    setRunResults((p) => ({ ...p, [currentIdx]: results }));
    setRunLoading((p) => ({ ...p, [currentIdx]: false }));
  }

  function goToNextScope({ force = false } = {}) {
    // Normal "Save & Next": move within the current section/sub-section first.
    if (!force) {
      const pos = sectionQuestions.findIndex(({ index }) => index === currentIdx);
      if (pos >= 0 && pos < sectionQuestions.length - 1) {
        goToQuestion(sectionQuestions[pos + 1].index);
        return true;
      }
    }

    const timedLock =
      timingEnabled &&
      scopeTiming.mode !== "none" &&
      scopeTimeLeftMs != null &&
      scopeTimeLeftMs > 0 &&
      !force;

    // Section timer expiry jumps to the next section (skip leftover sub-sections).
    const skipRemainingSubs = force && scopeTiming.mode === "section";

    if (!skipRemainingSubs && subSectionsInSection.length) {
      const subIdx = subSectionsInSection.indexOf(activeSubSection);
      if (subIdx >= 0 && subIdx < subSectionsInSection.length - 1) {
        if (timedLock && scopeTiming.mode === "subsection") {
          showStayOnPageNotice(
            "You cannot move to another sub-section until the time is out.",
            { mode: "section" }
          );
          return false;
        }
        setActiveSubSection(subSectionsInSection[subIdx + 1]);
        return true;
      }
    }

    const secIdx = allSections.indexOf(activeSection);
    if (secIdx >= 0 && secIdx < allSections.length - 1) {
      if (timedLock) {
        showStayOnPageNotice("You cannot move to another section until the time is out.", {
          mode: "section",
        });
        return false;
      }
      const nextSec = allSections[secIdx + 1];
      setActiveSection(nextSec);
      const subs = orderMockSubSectionsForExam(
        questions,
        nextSec,
        test?.subSectionOrder
      );
      setActiveSubSection(subs[0] || "General");
      return true;
    }

    return false;
  }

  function forceAdvanceTimedScope() {
    if (advancingScopeRef.current) return;
    advancingScopeRef.current = true;
    try {
      const onLastScope =
        allSections.indexOf(activeSection) === allSections.length - 1 &&
        (!subSectionsInSection.length ||
          subSectionsInSection.indexOf(activeSubSection) ===
            subSectionsInSection.length - 1);
      if (onLastScope && !submitted) {
        finalizeSubmit();
        return;
      }
      const moved = goToNextScope({ force: true });
      if (!moved && !submitted) {
        finalizeSubmit();
      }
    } finally {
      setTimeout(() => {
        advancingScopeRef.current = false;
      }, 400);
    }
  }

  onScopeTimeUpRef.current = forceAdvanceTimedScope;

  useEffect(() => {
    if (!secure.started || !timingEnabled) {
      setScopeTimeLeftMs(null);
      return undefined;
    }
    const minutes = Number(scopeTiming.minutes) || 0;
    if (minutes <= 0 || scopeTiming.mode === "none") {
      setScopeTimeLeftMs(null);
      return undefined;
    }

    let left = minutes * 60 * 1000;
    setScopeTimeLeftMs(left);
    const timerId = setInterval(() => {
      left = Math.max(0, left - 1000);
      setScopeTimeLeftMs(left);
      if (left <= 0) {
        clearInterval(timerId);
        onScopeTimeUpRef.current?.();
      }
    }, 1000);

    return () => clearInterval(timerId);
  }, [
    secure.started,
    timingEnabled,
    scopeTiming.key,
    scopeTiming.minutes,
    scopeTiming.mode,
  ]);

  const canGoNext =
    currentPos < sectionQuestions.length - 1 ||
    (subSectionsInSection.length > 0 &&
      subSectionsInSection.indexOf(activeSubSection) <
        subSectionsInSection.length - 1) ||
    allSections.indexOf(activeSection) < allSections.length - 1;

  const SUBMIT_UNLOCK_MS = 5 * 60 * 1000;

  const remainingTestMs = useMemo(() => {
    if (timingEnabled) {
      return getMockRemainingSectionBasedMs({
        questions,
        sectionsOrdered: allSections,
        activeSection,
        activeSubSection,
        sectionTimings: test?.sectionTimings,
        subSectionTimings: test?.subSectionTimings,
        subSectionOrder: test?.subSectionOrder,
        scopeTimeLeftMs,
      });
    }
    if (secure.timeLeftMs != null) return Math.max(0, Number(secure.timeLeftMs) || 0);
    return null;
  }, [
    timingEnabled,
    questions,
    allSections,
    activeSection,
    activeSubSection,
    test?.sectionTimings,
    test?.subSectionTimings,
    test?.subSectionOrder,
    scopeTimeLeftMs,
    secure.timeLeftMs,
  ]);

  const canSubmitByTime =
    remainingTestMs == null || remainingTestMs <= SUBMIT_UNLOCK_MS;

  function handleSubmit() {
    if (!canSubmitByTime) {
      showStayOnPageNotice("Submit unlocks in the last 5 minutes of the test.", {
        mode: "section",
      });
      return;
    }
    if (!confirm("Submit the test? You cannot change answers after submitting.")) return;
    finalizeSubmit();
  }

  async function continueSequentialPublic() {
    if (!publicMode || !publicSession?.phone || !publicLinkId) return;
    setNextSequentialBusy(true);
    try {
      const assignment = await resolveMockPublicAssignment({
        linkId: publicLinkId,
        phone: publicSession.phone,
      });
      if (!assignment || assignment.allDone) {
        alert("You have completed all tests in this link. Thank you!");
        router.push(`/mock-test/public/${encodeURIComponent(publicLinkId)}`);
        return;
      }
      writeMockPublicSession(publicLinkId, {
        ...publicSession,
        testId: assignment.testId,
        testTitle: assignment.testTitle,
        mode: assignment.mode,
        step: assignment.step,
        totalSteps: assignment.totalSteps,
        linkLabel: assignment.linkLabel,
      });
      router.push(
        `/mock-test/${encodeURIComponent(assignment.companySlug)}/${encodeURIComponent(assignment.testId)}?public=1&link=${encodeURIComponent(publicLinkId)}`
      );
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not open the next test.");
    } finally {
      setNextSequentialBusy(false);
    }
  }

  if (loading) {
    return (
      <AuthGate publicMode={publicMode}>
        <ExamPageSkeleton />
      </AuthGate>
    );
  }

  if (publicMode && publicGateError) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Registration required</h1>
          <p className="text-sm text-slate-600 mb-6">{publicGateError}</p>
          <Link
            href={`/mock-test/public/${encodeURIComponent(publicLinkId)}`}
            className="inline-block px-5 py-2.5 rounded-lg bg-[#00448a] text-white"
          >
            Go to registration
          </Link>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <AuthGate publicMode={publicMode}>
        <div className="min-h-dvh pt-24 px-4 text-center">
          <p className="text-gray-700 mb-4">Mock test not found.</p>
          <Link
            href={publicMode ? `/mock-test/public/${encodeURIComponent(publicLinkId)}` : `/mock-test/${companySlug}`}
            className="text-[#00448a] hover:underline"
          >
            Back
          </Link>
        </div>
      </AuthGate>
    );
  }

  if (!publicMode && isMockTestLocked(test, group)) {
    return (
      <AuthGate publicMode={publicMode}>
        <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Test locked</h1>
            <p className="text-sm text-slate-600 mb-6">
              This mock test is locked. You can start it after the admin unlocks it.
            </p>
            <Link
              href={`/mock-test/${companySlug}`}
              className="inline-block px-5 py-2.5 rounded-lg bg-[#00448a] text-white"
            >
              Back to {companyLabel}
            </Link>
          </div>
        </div>
      </AuthGate>
    );
  }

  if (secure.isBlocked || lockedAccount) {
    return (
      <AuthGate publicMode={publicMode}>
        <div className="min-h-dvh flex items-center justify-center bg-red-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-8 text-center">
            <h1 className="text-xl font-bold text-red-900 mb-2">Account locked for this test</h1>
            <p className="text-sm text-red-700 mb-6">
              {lockedAccount?.reason || secure.blockReason || "This test is locked for your account after 3 tab switches. Ask an admin to unlock it."}
            </p>
            <Link
              href={publicMode ? `/mock-test/public/${encodeURIComponent(publicLinkId)}` : `/mock-test/${companySlug}`}
              className="inline-block px-5 py-2.5 rounded-lg bg-[#00448a] text-white"
            >
              Back
            </Link>
          </div>
        </div>
      </AuthGate>
    );
  }

  if (!secure.started) {
    const totalQuestions = summary.total || questions.length;
    const timingLabel = timingEnabled
      ? "section / sub-section timers"
      : durationMinutes
        ? `${durationMinutes} minutes`
        : "the allotted time";

    const sectionTimingMap = normalizeMockSectionTimings(test?.sectionTimings);
    const subTimingMap = normalizeMockSubSectionTimings(test?.subSectionTimings);
    const timingTableRows = [];
    let totalTimedMinutes = 0;
    allSections.forEach((sec) => {
      const subs = orderMockSubSectionsForExam(questions, sec, test?.subSectionOrder);
      const sectionMins = getMockFullSectionMinutes(
        sec,
        questions,
        test?.sectionTimings,
        test?.subSectionTimings
      );
      if (subs.length) {
        subs.forEach((sub) => {
          const key = mockSubSectionTimingKey(sec, sub);
          const mins = Number(subTimingMap[key]) || 0;
          totalTimedMinutes += mins;
          timingTableRows.push({
            key: `${sec}||${sub}`,
            section: sec,
            subSection: formatMockSubSectionLabel(questions, sec, sub),
            minutes: mins,
            kind: "subsection",
          });
        });
      } else {
        const mins = Number(sectionTimingMap[sec]) || sectionMins || 0;
        totalTimedMinutes += mins;
        timingTableRows.push({
          key: sec,
          section: sec,
          subSection: "—",
          minutes: mins,
          kind: "section",
        });
      }
    });
    if (!timingEnabled && durationMinutes > 0 && totalTimedMinutes <= 0) {
      totalTimedMinutes = durationMinutes;
    }

    return (
      <AuthGate publicMode={publicMode}>
        <div className="min-h-dvh bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-10">
            {!publicMode ? (
              <button
                type="button"
                onClick={() => router.push(`/mock-test/${companySlug}`)}
                className="text-sm text-[#00448a] hover:underline mb-4"
              >
                ← Back to {companyLabel}
              </button>
            ) : null}

            <div className="mb-4">
              <p className="text-sm text-[#00448a] font-medium">{companyLabel}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-black mt-1">
                {instructionsStep === 1
                  ? "Instructions for Online Test"
                  : "Section & Sub-section Timings"}
              </h1>
              <p className="mt-2 text-sm sm:text-base font-medium text-red-600">
                {instructionsStep === 1
                  ? "Please read the Instructions carefully before starting the test."
                  : "Review the time allotted for each section and sub-section, then start the test."}
              </p>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-semibold">{test.title || "Mock Test"}</span>
                {" · "}
                {summary.mcq} MCQ
                {summary.coding ? ` · ${summary.coding} Coding` : ""}
                {publicMode && publicSession?.name
                  ? ` · Candidate: ${publicSession.name}`
                  : ""}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span
                  className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 ${
                    instructionsStep === 1
                      ? "bg-[#00448a] text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  1
                </span>
                <span className={instructionsStep === 1 ? "text-[#00448a]" : ""}>Rules</span>
                <span className="text-slate-300">→</span>
                <span
                  className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 ${
                    instructionsStep === 2
                      ? "bg-[#00448a] text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  2
                </span>
                <span className={instructionsStep === 2 ? "text-[#00448a]" : ""}>Timings</span>
              </div>
            </div>

            {instructionsStep === 1 ? (
              <>
                <ol className="list-decimal pl-5 sm:pl-6 space-y-3 text-sm sm:text-[15px] text-black leading-relaxed">
                  <li>
                    Total number of questions : <strong>{totalQuestions || "—"}</strong>
                    {summary.mcq || summary.coding
                      ? ` (MCQ: ${summary.mcq}, Coding: ${summary.coding})`
                      : ""}
                    .
                  </li>
                  {allSections.length > 0 ? (
                    <li>
                      Sections (in order):{" "}
                      <strong>{allSections.join(" → ")}</strong>
                      .
                    </li>
                  ) : null}
                  <li>
                    The total duration of the test is <strong>{timingLabel}</strong>. A countdown
                    timer at the top right of the screen shows the time left
                    {timingEnabled ? " for the current section / sub-section" : ""}.
                  </li>
                  <li>
                    The Question Palette on the right shows all question numbers for the current
                    section. Use it to jump between questions.
                  </li>
                  <li>
                    The status of each question is shown with colours as explained below:
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full max-w-xl border border-gray-400 text-sm border-collapse">
                        <tbody>
                          {[
                            { color: "bg-red-500", label: "Not answered / Not Attempted Question." },
                            { color: "bg-green-500", label: "Answered / Attempted Question." },
                            {
                              color: "bg-yellow-400",
                              label: "Not Answered & Marked for review.",
                            },
                            {
                              color: "bg-violet-500",
                              label: "Answered & Marked for Review.",
                            },
                            { color: "bg-gray-400", label: "Dumped / Skipped." },
                            {
                              color: "bg-white border border-gray-400",
                              label: "Not Visited.",
                            },
                            {
                              color: "bg-orange-500",
                              label: "Current Question.",
                            },
                          ].map((row) => (
                            <tr key={row.label} className="border border-gray-400">
                              <td className="w-28 sm:w-36 p-2 border border-gray-400 align-middle">
                                <span
                                  className={`inline-block h-7 w-10 sm:w-12 rounded-sm ${row.color}`}
                                />
                              </td>
                              <td className="p-2 sm:p-2.5 border border-gray-400 text-black">
                                {row.label}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                  <li>
                    Questions within each section are <strong>jumbled</strong> for every attempt.
                    Questions that share a passage stay together. You can move between them using
                    the palette or <strong>Save &amp; Next</strong>.
                  </li>
                  <li>
                    Fullscreen is required (Chrome / desktop). Do not leave this tab — leaving the
                    page shows a warning. After <strong>3 tab switches</strong> the test is blocked.
                  </li>
                  <li>Copying question text is not allowed.</li>
                  {timingEnabled ? (
                    <li>
                      Section / sub-section timers are enabled. You cannot move to another section
                      until the time is out — then it moves automatically.
                    </li>
                  ) : (
                    <li>
                      You may move between sections freely until the overall test time ends.
                    </li>
                  )}
                  <li>
                    Coding questions appear in the last section(s) as sub-sections labeled{" "}
                    <strong>Coding Easy</strong> / <strong>Coding Hard</strong> (as configured).
                  </li>
                  <li>
                    <strong>Submit Test</strong> stays disabled until the last{" "}
                    <strong>5 minutes</strong> of the test. When the final section / sub-section
                    time ends, the test is submitted automatically.
                  </li>
                  <li>
                    After submission you cannot change answers. Make sure you have attempted all
                    required questions.
                  </li>
                  <li>
                    Do not refresh or close the browser during the test. Progress may be lost if you
                    leave without submitting.
                  </li>
                  <li>
                    For coding questions, select the language, write your solution, and use{" "}
                    <strong>Run Code</strong> to check sample cases before moving on.
                  </li>
                </ol>

                <div className="mt-8 pt-5 border-t border-gray-200 flex justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setInstructionsStep(2);
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className="min-w-[160px] px-8 py-3 rounded bg-[#003366] hover:bg-[#00264d] text-white text-base font-semibold"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden shadow-sm">
                  <div className="bg-[#00448a] px-4 py-3 sm:px-5 text-white">
                    <p className="text-sm font-semibold">Test time plan</p>
                    <p className="text-xs text-white/80 mt-0.5">
                      {timingEnabled
                        ? "Timers apply per section / sub-section. You move ahead only when time ends."
                        : durationMinutes
                          ? `Overall test duration: ${durationMinutes} minutes.`
                          : "No section timers configured — overall test time applies if set."}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="bg-white text-left text-slate-600 border-b border-slate-200">
                          <th className="px-4 py-3 font-semibold w-12">#</th>
                          <th className="px-4 py-3 font-semibold">Section</th>
                          <th className="px-4 py-3 font-semibold">Sub-section</th>
                          <th className="px-4 py-3 font-semibold text-right">Time (min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timingTableRows.length ? (
                          timingTableRows.map((row, idx) => (
                            <tr
                              key={row.key}
                              className="border-t border-slate-100 bg-white odd:bg-slate-50/60"
                            >
                              <td className="px-4 py-2.5 text-slate-500 tabular-nums">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-900">
                                {row.section}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700">{row.subSection}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="inline-flex min-w-[3rem] justify-end rounded-lg bg-[#00448a]/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-[#00448a]">
                                  {row.minutes > 0 ? row.minutes : "—"}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                              No sections found for this test.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {timingTableRows.length ? (
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-[#00448a]/5">
                            <td className="px-4 py-3" colSpan={3}>
                              <span className="text-sm font-semibold text-slate-900">
                                Total timed duration
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex rounded-lg bg-[#00448a] px-3 py-1 text-sm font-bold tabular-nums text-white">
                                {totalTimedMinutes > 0
                                  ? `${totalTimedMinutes} min`
                                  : durationMinutes
                                    ? `${durationMinutes} min`
                                    : "—"}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-gray-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <label className="text-sm font-medium text-black shrink-0">
                      Choose your default language
                    </label>
                    <select
                      defaultValue="English"
                      className="border border-gray-400 rounded px-3 py-2 text-sm bg-white max-w-xs"
                    >
                      <option>English</option>
                    </select>
                  </div>

                  <label className="flex items-start gap-2.5 text-sm text-black cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secure.acceptedRules}
                      onChange={(e) => secure.setAcceptedRules(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#00448a]"
                    />
                    <span>
                      The computer provided to me is in proper working condition. I have read and
                      understood the instructions and the timing table above.
                    </span>
                  </label>

                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setInstructionsStep(1)}
                      className="min-w-[120px] px-6 py-3 rounded border border-slate-300 bg-white text-slate-800 text-base font-semibold hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={beginStartCountdown}
                      disabled={
                        !secure.acceptedRules ||
                        startingExam ||
                        startCountdown != null ||
                        (publicMode && !publicSession?.phoneVerified)
                      }
                      className="min-w-[160px] px-8 py-3 rounded bg-[#003366] hover:bg-[#00264d] text-white text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      {startingExam || startCountdown != null ? "Starting…" : "Start Test"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {startCountdown != null ? (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-white">
              <div className="w-full max-w-md mx-4 rounded-xl border border-slate-200 bg-white shadow-lg px-8 py-10 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#00448a]">
                  {companyLabel}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900 truncate">
                  {test?.title || "Mock Test"}
                </h2>
                <p className="mt-6 text-sm text-slate-600">
                  {startCountdown === "Go"
                    ? "Loading your question paper…"
                    : "Your test will begin in"}
                </p>
                <p
                  key={String(startCountdown)}
                  className="mt-3 text-5xl font-semibold tabular-nums text-slate-900"
                >
                  {startCountdown === "Go" ? "Starting" : startCountdown}
                </p>
                <div className="mt-6 mx-auto h-1 w-40 overflow-hidden rounded-full bg-slate-100">
                  <div
                    key={`bar-${String(startCountdown)}`}
                    className="h-full bg-[#00448a]"
                    style={{
                      width: "100%",
                      animation:
                        startCountdown === "Go"
                          ? "mockStartBar 0.7s linear forwards"
                          : "mockStartBar 0.9s linear forwards",
                    }}
                  />
                </div>
                <p className="mt-5 text-xs text-slate-500">
                  Please stay on this page. Do not refresh or switch tabs.
                </p>
              </div>
              <style>{`
                @keyframes mockStartBar {
                  from { transform: translateX(-100%); }
                  to { transform: translateX(0%); }
                }
              `}</style>
            </div>
          ) : null}
        </div>
      </AuthGate>
    );
  }

  if (submitted && scoreDetail) {
    const percent = Math.round(Number(scoreDetail.percent) || 0);
    const performance =
      percent >= 80
        ? "Excellent"
        : percent >= 60
          ? "Good"
          : percent >= 40
            ? "Average"
            : "Needs Improvement";
    const performanceClass =
      percent >= 80
        ? "text-green-600"
        : percent >= 60
          ? "text-yellow-600"
          : percent >= 40
            ? "text-orange-600"
            : "text-red-600";
    const sectionList = Object.values(scoreDetail.sectionScores || {}).filter(
      (s) => Number(s?.max) > 0
    );
    const earnedTotal =
      (Number(scoreDetail.mcqCorrect) || 0) + (Number(scoreDetail.codingScore) || 0);
    const maxTotal =
      (Number(scoreDetail.mcqTotal) || 0) + (Number(scoreDetail.codingMax) || 0);

    return (
      <AuthGate publicMode={publicMode}>
        <div
          className={`fixed inset-0 z-50 bg-gradient-to-b from-sky-50 to-cyan-50 ${
            embedInstituteSite ? "flex flex-col overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {embedInstituteSite ? (
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-white shadow-sm">
                <span className="text-sm font-semibold text-gray-900">VAWE Institute</span>
                <button
                  type="button"
                  onClick={() => setEmbedInstituteSite(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                >
                  Back to scorecard
                </button>
              </div>
              <iframe
                title="VAWE Institute"
                src={VAWE_INSTITUTE_HOME_URL}
                className="w-full flex-1 min-h-0 border-0 bg-white"
                style={{ height: "calc(100dvh - 52px)" }}
              />
              <p className="shrink-0 text-[11px] text-gray-500 px-4 py-2 border-t border-gray-100 bg-gray-50">
                Same tab — the site loads here. If you only see a blank area, the site may block
                embedding; open{" "}
                <a
                  href={VAWE_INSTITUTE_HOME_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00448a] underline"
                >
                  vaweinstitute.com
                </a>{" "}
                instead.
              </p>
            </div>
          ) : (
            <div className="min-h-dvh flex items-center justify-center p-4 py-6">
              <div className="w-full max-w-2xl">
                <div className="text-center mb-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#0c4a6e] mb-1">
                    {scoreDetail.testTitle || test?.title || "Mock Test"}
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600">
                    {companyLabel} · Scorecard
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                  <p className="text-xs sm:text-sm text-gray-700 mb-0.5">
                    <strong>Name:</strong> {scoreDetail.name || "—"}
                  </p>
                  {scoreDetail.phone ? (
                    <p className="text-xs sm:text-sm text-gray-700 mb-0.5">
                      <strong>Phone:</strong> {scoreDetail.phone}
                    </p>
                  ) : null}
                  {scoreDetail.email ? (
                    <p className="text-xs sm:text-sm text-gray-700 mb-0.5">
                      <strong>Email:</strong> {scoreDetail.email}
                    </p>
                  ) : null}
                  {(scoreDetail.college || scoreDetail.branch) && (
                    <p className="text-xs sm:text-sm text-gray-700 mb-0.5">
                      <strong>College / Branch:</strong>{" "}
                      {[scoreDetail.college, scoreDetail.branch].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm text-gray-700">
                    <strong>Date:</strong>{" "}
                    {scoreDetail.submittedAt
                      ? new Date(scoreDetail.submittedAt).toLocaleString()
                      : new Date().toLocaleString()}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg p-5 sm:p-6 mb-4 text-white shadow-lg">
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-medium opacity-90 mb-2">Total Score</p>
                    <div className="flex items-baseline justify-center gap-2 mb-1">
                      <span className="text-4xl sm:text-5xl font-bold">
                        {Math.round(earnedTotal * 10) / 10}
                      </span>
                      <span className="text-xl sm:text-2xl font-semibold opacity-80">
                        / {Math.round(maxTotal)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full backdrop-blur-sm">
                        <span className="text-base sm:text-lg font-bold">{percent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`grid gap-3 mb-4 ${
                    Number(scoreDetail.codingMax) > 0 ? "sm:grid-cols-2" : "sm:grid-cols-1"
                  }`}
                >
                  <div className="bg-white rounded-lg shadow-md p-4 border-2 border-emerald-200">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3">MCQ Section</h3>
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                        {scoreDetail.mcqCorrect || 0}
                      </span>
                      <span className="text-base sm:text-lg text-gray-600">
                        / {scoreDetail.mcqTotal || 0}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1.5">
                      Correct answers out of total MCQs
                    </p>
                  </div>
                  {Number(scoreDetail.codingMax) > 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-4 border-2 border-blue-200">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3">
                        Coding Section
                      </h3>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                          {Math.round(Number(scoreDetail.codingScore) || 0)}
                        </span>
                        <span className="text-base sm:text-lg text-gray-600">
                          / {scoreDetail.codingMax || 0}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1.5">
                        Based on test case results
                      </p>
                    </div>
                  ) : null}
                </div>

                {sectionList.length > 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Section-wise scores</h3>
                    <div className="space-y-2">
                      {sectionList.map((sec) => (
                        <div
                          key={sec.section}
                          className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                        >
                          <span className="font-medium text-gray-800">{sec.section}</span>
                          <span className="text-gray-700 tabular-nums">
                            {Math.round(Number(sec.earned) || 0)}/{Math.round(Number(sec.max) || 0)}{" "}
                            <span className="text-gray-500">
                              ({Math.round(Number(sec.percent) || 0)}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="bg-white rounded-lg shadow-md p-4 mb-4 border-t-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Performance</span>
                    <span className={`text-sm sm:text-base font-bold ${performanceClass}`}>
                      {performance}
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                    <button
                      type="button"
                      onClick={handleDownloadScorecard}
                      disabled={pdfDownloading}
                      className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm disabled:opacity-60"
                    >
                      {pdfDownloading ? "Preparing PDF…" : "Download Scorecard (PDF)"}
                    </button>
                    {!isSequentialPublicPending ? (
                      <button
                        type="button"
                        onClick={openInstituteSiteNow}
                        className="px-5 py-2 bg-[#00448a] hover:bg-[#003a76] text-white rounded-lg font-medium transition-colors text-xs sm:text-sm"
                      >
                        View VAWE Institute
                      </button>
                    ) : null}
                    {isSequentialPublicPending ? (
                      <button
                        type="button"
                        onClick={continueSequentialPublic}
                        disabled={nextSequentialBusy}
                        className="px-5 py-2 bg-[#00448a] hover:bg-[#003a76] text-white rounded-lg font-medium disabled:opacity-60 text-xs sm:text-sm"
                      >
                        {nextSequentialBusy ? "Loading next…" : "Continue to next test"}
                      </button>
                    ) : null}
                  </div>
                  {!isSequentialPublicPending && instituteCountdown != null ? (
                    <p className="text-xs text-gray-600">
                      The institute site will open{" "}
                      <span className="font-medium text-gray-800">on this same page</span> in{" "}
                      <span className="font-semibold text-cyan-600 text-sm">
                        {formatInstituteCountdown(instituteCountdown)}
                      </span>
                    </p>
                  ) : null}
                  <Link
                    href={
                      publicMode
                        ? `/mock-test/public/${encodeURIComponent(publicLinkId)}`
                        : `/mock-test/${companySlug}`
                    }
                    className="inline-block text-sm text-slate-600 hover:text-[#00448a] underline"
                  >
                    {publicMode ? "Back to public link" : `Back to ${companyLabel}`}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </AuthGate>
    );
  }

  const isMcq = (currentQ?.type || "mcq") === "mcq";
  const options = isMcq ? normalizeMockQuestionOptions(currentQ?.options) : [];
  const passageText = String(currentQ?.description || "").trim();
  const passageGroupId = String(currentQ?.passageGroup || "").trim();
  const passagePositions = passageGroupId
    ? sectionQuestions.reduce((acc, entry, index) => {
        if (String(entry.q?.passageGroup || "").trim() === passageGroupId) acc.push(index + 1);
        return acc;
      }, [])
    : [];
  const passageNote =
    passagePositions.length > 1
      ? passagePositions.every((n, i) => i === 0 || n === passagePositions[i - 1] + 1)
        ? `Same passage for questions ${passagePositions[0]}–${passagePositions[passagePositions.length - 1]}`
        : `Same passage for questions ${passagePositions.join(", ")}`
      : "";
  const codingResults = runResults[currentIdx] || [];

  return (
    <AuthGate publicMode={publicMode}>
      <SecureExamOverlays
        started={secure.started}
        isBlocked={secure.isBlocked}
        inFullscreen={secure.inFullscreen}
        tabSwitchCount={secure.tabSwitchCount}
        showTabWarning={secure.showTabWarning}
        dismissTabWarning={secure.dismissTabWarning}
        requestFullscreen={secure.requestFullscreen}
      />

      {pageNotice ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/55">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-notice-title"
            className={`w-full max-w-md rounded-2xl border bg-white shadow-2xl p-6 text-center ${
              pageNotice.mode === "section"
                ? "border-slate-200"
                : "border-amber-200"
            }`}
          >
            {pageNotice.mode === "section" ? (
              <h2 id="page-notice-title" className="text-xl font-bold text-slate-900 mb-2">
                Section locked
              </h2>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
                  Stay on this page
                </p>
                <h2 id="page-notice-title" className="text-xl font-bold text-slate-900 mb-2">
                  Don&apos;t exit the page
                </h2>
              </>
            )}
            <p className="text-sm text-slate-600 mb-5">{pageNotice.message}</p>
            <button
              type="button"
              onClick={() => {
                suppressViolations(1500);
                setPageNotice(null);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#00448a] text-white text-sm font-semibold hover:bg-[#003a76]"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-[90] flex flex-col bg-[#eef2f7] min-h-dvh select-none transition-all duration-700 ease-out ${
          examEnterVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-[0.985]"
        }`}
      >
        {/* Top bar */}
        <div className="bg-[#00448a] text-white shrink-0">
          <div className="px-3 xl:px-4 py-1.5 xl:py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] xl:text-xs text-white/80 truncate">{companyLabel}</p>
              <h1 className="text-xs sm:text-sm xl:text-base font-bold truncate">{test.title || "Mock Test"}</h1>
            </div>
            {(timingEnabled && scopeTimeLeftMs != null) || secure.timeLeftMs != null ? (
              <div className="text-right shrink-0">
                <p className="text-[9px] xl:text-[10px] text-white/70 uppercase">
                  {timingEnabled && scopeTimeLeftMs != null
                    ? scopeTiming.mode === "subsection"
                      ? "Sub-section time"
                      : "Section time"
                    : "Time Left"}
                </p>
                <p className="text-base xl:text-lg font-mono font-bold tabular-nums">
                  {timingEnabled && scopeTimeLeftMs != null
                    ? formatExamTime(scopeTimeLeftMs)
                    : secure.formatTime(secure.timeLeftMs)}
                </p>
              </div>
            ) : null}
          </div>

          {/* Section tabs (top nav) */}
          {allSections.length > 0 && (
            <div className="flex border-t border-white/20 overflow-x-auto">
              {allSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    if (timingEnabled && sec !== activeSection) {
                      showStayOnPageNotice(
                        "You cannot move to another section until the time is out.",
                        { mode: "section" }
                      );
                      return;
                    }
                    setActiveSection(sec);
                    const subs = orderMockSubSectionsForExam(
                      questions,
                      sec,
                      test?.subSectionOrder
                    );
                    setActiveSubSection(subs[0] || "General");
                  }}
                  className={`flex-1 min-w-[7rem] py-2 xl:py-2.5 px-3 text-xs xl:text-sm font-medium transition whitespace-nowrap ${
                    activeSection === sec
                      ? "bg-white text-[#00448a]"
                      : timingEnabled
                        ? "text-white/50 cursor-not-allowed"
                        : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sub-section tabs */}
        {subSectionsInSection.length > 0 && (
          <div className="bg-white border-b shrink-0 px-3 xl:px-4 py-1.5 xl:py-2">
            <p className="text-[10px] xl:text-xs font-semibold text-gray-500 uppercase mb-1 xl:mb-1.5">
              Sub-sections
            </p>
            <div className="flex flex-wrap gap-1.5 xl:gap-2">
              {subSectionsInSection.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    if (
                      timingEnabled &&
                      scopeTiming.mode === "subsection" &&
                      sub !== activeSubSection
                    ) {
                      showStayOnPageNotice(
                        "You cannot move to another sub-section until the time is out.",
                        { mode: "section" }
                      );
                      return;
                    }
                    setActiveSubSection(sub);
                  }}
                  className={`px-2.5 xl:px-3 py-1 xl:py-1.5 rounded text-[11px] xl:text-xs font-medium border transition ${
                    activeSubSection === sub
                      ? "bg-[#26ebe5] text-[#00448a] border-[#26ebe5]"
                      : timingEnabled && scopeTiming.mode === "subsection"
                        ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#00448a]/40"
                  }`}
                >
                  {formatMockSubSectionLabel(questions, activeSection, sub)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main question panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div
              className={`flex-1 min-h-0 ${
                isMcq ? "overflow-y-auto p-2.5 xl:p-4" : "overflow-hidden p-2 sm:p-3"
              }`}
            >
              {currentQ ? (
                <div
                  className={`bg-white rounded-lg border border-gray-200 shadow-sm ${
                    isMcq ? "max-w-4xl mx-auto" : "h-full min-h-0 flex flex-col"
                  }`}
                >
                  <div className="px-3 xl:px-4 py-1.5 xl:py-2.5 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div>
                      <p className="text-[10px] xl:text-xs text-gray-500">
                        Question Type:{" "}
                        <span className="font-semibold text-gray-800">
                          {isMcq ? "Multiple Choice" : "Coding"}
                        </span>
                      </p>
                      <p className="text-xs xl:text-sm font-bold text-[#00448a]">
                        Question No. {(currentPos >= 0 ? currentPos : 0) + 1}
                      </p>
                    </div>
                    <span className="text-[10px] xl:text-xs px-2 py-0.5 xl:py-1 rounded bg-[#26ebe5]/20 text-[#00448a] font-medium">
                      {activeSection}
                      {subSectionsInSection.length > 0
                        ? ` › ${formatMockSubSectionLabel(questions, activeSection, activeSubSection)}`
                        : ""}
                    </span>
                  </div>

                  {isMcq ? (
                    <div className="p-3 xl:p-5">
                      {passageText ? (
                        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 xl:px-4 xl:py-4">
                          <p className="text-[10px] xl:text-xs font-semibold uppercase tracking-wide text-[#00448a]">
                            Passage
                          </p>
                          {passageNote ? (
                            <p className="mt-1 text-[11px] xl:text-xs text-[#00448a]/80">{passageNote}</p>
                          ) : null}
                          <p className="mt-2 text-sm xl:text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {passageText}
                          </p>
                        </div>
                      ) : null}
                      <p className="text-sm xl:text-base font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">
                        {currentQ.question || currentQ.title || "Question"}
                      </p>
                      <MockQuestionImage src={currentQ.questionImage} />
                      <div className="mt-3 xl:mt-4 space-y-1.5 xl:space-y-2">
                        {options.map((option, optIdx) => {
                          const selected = answers[currentIdx] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-start gap-2.5 xl:gap-3 p-2 xl:p-3 rounded-lg border cursor-pointer transition ${
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
                                className="mt-0.5 xl:mt-1 shrink-0"
                              />
                              <span className="text-xs xl:text-sm text-gray-800 leading-snug">
                                <span className="font-semibold mr-1.5 xl:mr-2">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {option || `Option ${optIdx + 1}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                      <div className="min-h-0 overflow-y-auto p-2.5 xl:p-4 border-b lg:border-b-0 lg:border-r space-y-2.5 xl:space-y-3">
                        <div className="rounded-xl border border-gray-200 bg-slate-50/70 px-2.5 xl:px-3 py-2 xl:py-3">
                          <p className="text-[10px] xl:text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 xl:mb-2">
                            Problem statement
                          </p>
                          <pre className="text-xs xl:text-sm text-gray-900 leading-relaxed whitespace-pre-wrap font-sans">
                            {currentQ.question || currentQ.title || "Question"}
                          </pre>
                          <MockQuestionImage src={currentQ.questionImage} />
                        </div>
                        {currentQ.description ? (
                          <p className="text-xs xl:text-sm text-gray-600 whitespace-pre-wrap">
                            {currentQ.description}
                          </p>
                        ) : null}
                        {getMockSampleTestCases(currentQ.testCases, 2).length > 0 && (
                          <div className="rounded-lg border bg-gray-50 p-2.5 xl:p-3 text-[11px] xl:text-xs">
                            <p className="font-semibold mb-2">Sample test cases</p>
                            {getMockSampleTestCases(currentQ.testCases, 2).map((tc, i) => (
                              <div key={i} className="mb-2 last:mb-0 space-y-1">
                                <p className="text-[10px] font-medium text-gray-500">Sample {i + 1}</p>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-[10px] text-gray-500 mb-0.5">Input</p>
                                    <pre className="bg-white border rounded p-2 whitespace-pre-wrap">
                                      {tc.input || "—"}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-500 mb-0.5">Expected output</p>
                                    <pre className="bg-white border rounded p-2 whitespace-pre-wrap">
                                      {tc.output || "—"}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="min-h-[240px] lg:min-h-0 flex flex-col p-2.5 xl:p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0">
                          <select
                            value={codeLanguages[currentIdx] || currentQ.language || "javascript"}
                            onChange={(e) =>
                              setCodeLanguages((p) => ({ ...p, [currentIdx]: e.target.value }))
                            }
                            className="border rounded px-2 py-1 xl:px-2.5 xl:py-1.5 text-xs xl:text-sm"
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
                            className="px-2.5 xl:px-3 py-1 xl:py-1.5 rounded bg-[#00448a] text-white text-xs xl:text-sm disabled:opacity-60"
                          >
                            {runLoading[currentIdx] ? "Running..." : "Run Code"}
                          </button>
                        </div>
                        <textarea
                          value={answers[currentIdx] ?? currentQ.starterCode ?? ""}
                          onChange={(e) => setAnswers((p) => ({ ...p, [currentIdx]: e.target.value }))}
                          className="w-full flex-1 min-h-[180px] lg:min-h-0 border rounded-lg px-2.5 xl:px-3 py-1.5 xl:py-2 font-mono text-xs xl:text-sm resize-y lg:resize-none select-text"
                          spellCheck={false}
                        />
                        {codingResults.length > 0 && (
                          <div className="mt-2 shrink-0 max-h-56 overflow-y-auto space-y-2">
                            <div className="text-[11px] xl:text-sm space-y-2">
                              {codingResults.map((r, i) => (
                                <div
                                  key={i}
                                  className={`rounded-lg border p-2 ${
                                    r.pass
                                      ? "border-green-200 bg-green-50"
                                      : r.skipped
                                        ? "border-amber-200 bg-amber-50"
                                        : "border-red-200 bg-red-50"
                                  }`}
                                >
                                  <p
                                    className={`font-semibold ${
                                      r.pass
                                        ? "text-green-800"
                                        : r.skipped
                                          ? "text-amber-800"
                                          : "text-red-800"
                                    }`}
                                  >
                                    Sample {i + 1}:{" "}
                                    {r.pass
                                      ? "Passed"
                                      : r.skipped
                                        ? "Skipped"
                                        : r.error
                                          ? "Error"
                                          : "Failed"}
                                  </p>
                                  {!r.pass && !r.skipped && !r.error ? (
                                    <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-[10px] xl:text-[11px]">
                                      {r.input ? (
                                        <div>
                                          <p className="font-medium text-slate-600 mb-0.5">Input</p>
                                          <pre className="bg-white/80 border border-red-100 rounded px-2 py-1 whitespace-pre-wrap font-mono text-slate-800">
                                            {r.input}
                                          </pre>
                                        </div>
                                      ) : null}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        <div>
                                          <p className="font-medium text-slate-600 mb-0.5">
                                            Expected output
                                          </p>
                                          <pre className="bg-white/80 border border-red-100 rounded px-2 py-1 whitespace-pre-wrap font-mono text-slate-800">
                                            {r.expected || "(empty)"}
                                          </pre>
                                        </div>
                                        <div>
                                          <p className="font-medium text-slate-600 mb-0.5">
                                            Your output
                                          </p>
                                          <pre className="bg-white/80 border border-red-100 rounded px-2 py-1 whitespace-pre-wrap font-mono text-red-900">
                                            {r.actual || "(empty)"}
                                          </pre>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            {codingResults.some((r) => r.error && !r.skipped) ? (
                              <div className="rounded-lg border border-red-300 bg-red-50 p-2 xl:p-2.5">
                                <p className="text-[10px] xl:text-[11px] font-semibold text-red-800 uppercase tracking-wide mb-1">
                                  Compiler / runtime error
                                </p>
                                <pre className="text-[10px] xl:text-[11px] leading-relaxed text-red-800 whitespace-pre-wrap font-mono">
                                  {codingResults.find((r) => r.error && !r.skipped)?.error}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="px-3 xl:px-4 py-1.5 xl:py-2.5 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex flex-wrap gap-1.5 xl:gap-2">
                      <button
                        type="button"
                        onClick={() => goNext(true)}
                        className="px-2.5 xl:px-4 py-1 xl:py-2 rounded border border-purple-300 bg-purple-50 text-purple-800 text-[11px] xl:text-sm font-medium hover:bg-purple-100"
                      >
                        Mark for Review &amp; Next
                      </button>
                      <button
                        type="button"
                        onClick={clearCurrentResponse}
                        className="px-2.5 xl:px-4 py-1 xl:py-2 rounded border border-gray-300 bg-white text-gray-700 text-[11px] xl:text-sm font-medium hover:bg-gray-50"
                      >
                        Clear Response
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => goNext(false)}
                      disabled={!canGoNext}
                      className="px-3 xl:px-5 py-1 xl:py-2 rounded bg-[#00448a] hover:bg-[#003a76] text-white text-[11px] xl:text-sm font-medium disabled:opacity-40"
                    >
                      Save &amp; Next
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs xl:text-sm text-gray-500 py-12">No questions in this section.</p>
              )}
            </div>
          </div>

          {/* Right sidebar — question palette */}
          <aside className="hidden sm:flex w-[12.5rem] lg:w-[13rem] xl:w-72 shrink-0 border-l border-gray-300 bg-white flex-col overflow-hidden">
            <div className="p-2.5 xl:p-4 border-b bg-gradient-to-b from-gray-50 to-white">
              <p className="text-[10px] xl:text-xs text-gray-500 uppercase font-semibold">Question Palette</p>
              <p className="text-xs xl:text-sm font-medium text-[#00448a] mt-0.5 xl:mt-1">
                {activeSection}
                {subSectionsInSection.length > 0
                  ? ` › ${formatMockSubSectionLabel(questions, activeSection, activeSubSection)}`
                  : ""}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 xl:p-3">
              <div className="grid grid-cols-4 xl:grid-cols-5 gap-1.5 xl:gap-2">
                {sectionQuestions.map(({ index }, localIdx) => {
                  const status = getStatus(index);
                  const isCurrent = index === currentIdx;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      className={`h-8 xl:h-10 w-full rounded border text-xs xl:text-sm font-semibold transition ${paletteButtonClass(status, isCurrent)}`}
                      title={`Question ${localIdx + 1}`}
                    >
                      {localIdx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 xl:mt-4 space-y-1 xl:space-y-1.5 text-[10px] xl:text-xs">
                <p className="font-semibold text-gray-700 mb-1.5 xl:mb-2">Legend</p>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 xl:h-4 xl:w-4 rounded bg-green-500 shrink-0" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 xl:h-4 xl:w-4 rounded bg-red-500 shrink-0" />
                  <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 xl:h-4 xl:w-4 rounded bg-purple-500 shrink-0" />
                  <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 xl:h-4 xl:w-4 rounded bg-white border border-gray-300 shrink-0" />
                  <span>Not Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 xl:h-4 xl:w-4 rounded bg-orange-500 shrink-0" />
                  <span>Current Question</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 xl:p-3 border-t bg-gray-50 space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmitByTime}
                className="w-full py-2 xl:py-2.5 rounded-lg text-white font-semibold text-xs xl:text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
              >
                Submit Test
              </button>
              {!canSubmitByTime ? (
                <p className="text-[10px] text-center text-amber-700">
                  Submit unlocks in the last 5 minutes
                  {remainingTestMs != null
                    ? ` (${formatExamTime(Math.max(0, remainingTestMs - SUBMIT_UNLOCK_MS))} left until unlock)`
                    : ""}
                </p>
              ) : null}
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
              disabled={!canSubmitByTime}
              className="h-9 px-4 shrink-0 rounded text-white text-xs font-semibold bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

export default function TakeMockTestPageWithSuspense() {
  return (
    <Suspense fallback={<ExamPageSkeleton />}>
      <TakeMockTestPage />
    </Suspense>
  );
}
