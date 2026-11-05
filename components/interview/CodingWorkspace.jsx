"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, GripVertical, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import MathTextDisplay from "@/components/MathTextDisplay";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading editor…</div>
  ),
});

export const CODING_LANGUAGES = [
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" },
  { id: "java", label: "Java", monaco: "java" },
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
];

const LEVEL_STYLES = {
  easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  hard: "bg-rose-50 text-rose-700 border-rose-200",
};

const SPLIT_MIN = 28;
const SPLIT_MAX = 65;
const SPLIT_DEFAULT = 42;

/** Editor font grows with the screen: laptop 14px, full HD 15px, 2K 16px, 4K 18px. */
function editorFontSize() {
  if (typeof window === "undefined") return 14;
  const w = window.innerWidth;
  if (w >= 3000) return 18;
  if (w >= 2200) return 16;
  if (w >= 1700) return 15;
  return 14;
}

function CodeBlock({ label, value, tone = "default" }) {
  const toneCls =
    tone === "pass"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "fail"
        ? "border-rose-200 bg-rose-50/60"
        : "border-slate-200 bg-slate-50";
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 2xl:text-xs">{label}</p>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border px-3 py-2 font-mono text-xs text-slate-800 2xl:text-sm ${toneCls}`}
      >
        {value === "" || value == null ? "—" : value}
      </pre>
    </div>
  );
}

/**
 * Coding question workspace (IDE layout).
 * - Phones/tablets: problem, editor and results stacked.
 * - Laptop and up: problem | draggable divider | editor + results, filling the screen height.
 * Ctrl/Cmd + Enter runs all test cases.
 */
export default function CodingWorkspace({
  question,
  questionKey,
  code,
  onCodeChange,
  language,
  onLanguageChange,
  onRun,
  running,
  results,
}) {
  const testCases = Array.isArray(question?.testCases) ? question.testCases : [];
  const level = String(question?.section || "easy").trim();
  const levelCls = LEVEL_STYLES[level.toLowerCase()] || "bg-slate-50 text-slate-700 border-slate-200";
  const lang = CODING_LANGUAGES.find((l) => l.id === language) || CODING_LANGUAGES[0];
  const hasResults = Array.isArray(results) && results.length > 0;
  const passed = hasResults ? results.filter((r) => r?.pass).length : 0;
  const [activeCase, setActiveCase] = useState(0);
  const [fontSize, setFontSize] = useState(14);
  const [splitPct, setSplitPct] = useState(SPLIT_DEFAULT);
  const containerRef = useRef(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    setActiveCase(0);
  }, [results]);

  useEffect(() => {
    const update = () => setFontSize(editorFontSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current?.());
  };

  const startDrag = useCallback((e) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const move = (ev) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }, []);

  const selected = hasResults ? results[Math.min(activeCase, results.length - 1)] : null;

  return (
    <div
      ref={containerRef}
      style={{ "--split": `${splitPct}%` }}
      className="grid gap-3 lg:h-[calc(100dvh-9rem)] lg:min-h-[560px] lg:gap-0 lg:[grid-template-columns:var(--split)_12px_minmax(0,1fr)]"
    >
      {/* Problem */}
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 2xl:px-6 2xl:py-3">
          <p className="text-sm font-semibold text-slate-900 2xl:text-base">Problem</p>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize 2xl:text-sm ${levelCls}`}>
            {level || "easy"}
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5 2xl:px-8 2xl:py-6">
          <MathTextDisplay className="whitespace-pre-line text-[15px] leading-7 text-slate-800 2xl:text-base 2xl:leading-8 min-[2800px]:text-lg">
            {question?.question}
          </MathTextDisplay>
          {testCases.length === 0 ? (
            <p className="text-sm text-slate-500">No example test cases provided.</p>
          ) : (
            testCases.map((tc, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 2xl:p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800 2xl:text-base">Example {i + 1}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <CodeBlock label="Input" value={tc?.input} />
                  <CodeBlock label="Output" value={tc?.output} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Drag handle (laptop and up) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize problem and editor"
        onPointerDown={startDrag}
        onDoubleClick={() => setSplitPct(SPLIT_DEFAULT)}
        className="group hidden cursor-col-resize items-center justify-center lg:flex"
        title="Drag to resize · double-click to reset"
      >
        <div className="flex h-12 w-1.5 items-center justify-center rounded-full bg-slate-200 group-hover:bg-cyan-400">
          <GripVertical className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
        </div>
      </div>

      {/* Editor + results */}
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#1e1e1e]">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2 2xl:px-4 2xl:py-2.5">
          <select
            value={lang.id}
            onChange={(e) => onLanguageChange(e.target.value)}
            aria-label="Programming language"
            className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 2xl:text-base"
          >
            {CODING_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-slate-500 xl:inline">Ctrl + Enter to run</span>
            <button
              type="button"
              onClick={() => {
                if (!code || confirm("Clear your code for this question?")) onCodeChange("");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 2xl:text-sm"
              title="Clear code"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={onRun}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 2xl:px-4 2xl:text-base"
              title="Run all test cases (Ctrl + Enter)"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        <div className="relative h-[360px] shrink-0 sm:h-[440px] lg:h-auto lg:min-h-0 lg:flex-1">
          <MonacoEditor
            height="100%"
            language={lang.monaco}
            value={code || ""}
            onChange={(v) => onCodeChange(v || "")}
            onMount={handleMount}
            theme="vs-dark"
            path={`exam-question-${questionKey}.${lang.id}`}
            options={{
              fontSize,
              lineHeight: Math.round(fontSize * 1.6),
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
              contextmenu: false,
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
            }}
          />
          {!code && (
            <div
              className="pointer-events-none absolute top-3 font-mono text-slate-500"
              style={{ left: `${Math.round(fontSize * 4.4)}px`, fontSize, lineHeight: `${Math.round(fontSize * 1.6)}px` }}
            >
              {lang.id === "python" ? "# Write your solution here" : "// Write your solution here"}
            </div>
          )}
        </div>

        <div className="flex max-h-[45%] shrink-0 flex-col border-t border-slate-200 bg-white lg:h-56 2xl:h-72 min-[2800px]:h-80">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 2xl:px-4">
            <p className="text-sm font-semibold text-slate-900 2xl:text-base">Test result</p>
            {hasResults && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold 2xl:text-sm ${
                  passed === results.length ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {passed}/{results.length} passed
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {running ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Running test cases…
              </div>
            ) : !hasResults ? (
              <p className="px-3 py-6 text-sm text-slate-500 2xl:px-4 2xl:text-base">
                Click <span className="font-semibold">Run</span> (or press Ctrl + Enter) to check your code against the
                test cases.
              </p>
            ) : (
              <div className="px-3 py-3 2xl:px-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveCase(i)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold 2xl:text-sm ${
                        i === activeCase
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {r?.pass ? (
                        <CheckCircle2 className={`h-3.5 w-3.5 ${i === activeCase ? "text-emerald-300" : "text-emerald-600"}`} />
                      ) : (
                        <XCircle className={`h-3.5 w-3.5 ${i === activeCase ? "text-rose-300" : "text-rose-600"}`} />
                      )}
                      Case {i + 1}
                    </button>
                  ))}
                </div>
                {selected && (
                  <div className="space-y-2">
                    <p className={`text-sm font-semibold 2xl:text-base ${selected.pass ? "text-emerald-700" : "text-rose-700"}`}>
                      {selected.pass
                        ? "Accepted"
                        : selected.status && selected.status !== "Accepted"
                          ? selected.status
                          : "Wrong answer"}
                    </p>
                    <CodeBlock label="Input" value={selected.input} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <CodeBlock label="Expected" value={selected.expected} />
                      <CodeBlock label="Your output" value={selected.actual} tone={selected.pass ? "pass" : "fail"} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
