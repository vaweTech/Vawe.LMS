"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CheckAuth from "@/lib/CheckAuth";
import { useNoCopy } from "@/lib/useSecureExamSession";
import {
  fetchMockTestGroup,
  fetchMockTestsForCompany,
  isMockTestLocked,
  summarizeMockTestQuestions,
} from "@/lib/mockTests";
import {
  ArrowLeftIcon,
  ClockIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  LockClosedIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";

export default function MockTestCompanyPage() {
  const { companySlug } = useParams();
  const router = useRouter();
  const [tests, setTests] = useState([]);
  const [group, setGroup] = useState(null);
  const [groupLabel, setGroupLabel] = useState("");
  const [loading, setLoading] = useState(true);
  useNoCopy({ enabled: true, allowEditable: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [group, list] = await Promise.all([
          fetchMockTestGroup(companySlug),
          fetchMockTestsForCompany(companySlug),
        ]);
        if (!cancelled) {
          setGroup(group);
          setGroupLabel(group?.label || String(companySlug || "").replace(/_/g, " "));
          setTests(list);
        }
      } catch (e) {
        console.error("Failed to load mock tests:", e);
        if (!cancelled) {
          setTests([]);
          setGroupLabel(String(companySlug || "").replace(/_/g, " "));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  const stats = useMemo(() => {
    return tests.reduce(
      (acc, test) => {
        const s = summarizeMockTestQuestions(test.questions);
        acc.mcq += s.mcq;
        acc.coding += s.coding;
        s.sections.forEach((sec) => acc.sections.add(sec));
        return acc;
      },
      { mcq: 0, coding: 0, sections: new Set() }
    );
  }, [tests]);

  return (
    <CheckAuth>
      <div className="min-h-dvh bg-gradient-to-br from-[#00448a]/5 via-sky-50 to-cyan-50 pt-20 md:pt-24 px-4 md:px-6 pb-10 select-none">
        <div className="max-w-6xl mx-auto">
          <button
            type="button"
            onClick={() => router.push("/mock-test")}
            className="inline-flex items-center gap-2 text-sm text-[#00448a] hover:underline mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            All companies
          </button>

          <div className="rounded-2xl bg-gradient-to-r from-[#00448a] to-[#0066b3] text-white px-5 py-4 md:px-6 md:py-5 shadow-lg mb-5 md:mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-white/75 uppercase tracking-wide font-medium">Mock Tests</p>
                <h1 className="text-xl md:text-2xl font-bold mt-0.5 truncate">{groupLabel}</h1>
                <p className="text-white/85 mt-1 text-sm">
                  {loading
                    ? "Loading tests…"
                    : `${tests.length} test${tests.length === 1 ? "" : "s"} · MCQ & coding`}
                </p>
              </div>
              {!loading && tests.length > 0 && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-sm">
                    <DocumentTextIcon className="h-4 w-4" />
                    {stats.mcq} MCQ
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-sm">
                    <CodeBracketIcon className="h-4 w-4" />
                    {stats.coding} Coding
                  </span>
                  {stats.sections.size > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-sm">
                      {stats.sections.size} section{stats.sections.size === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 animate-pulse"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  </div>
                  <div className="h-10 w-28 bg-slate-200 rounded-xl hidden md:block" />
                </div>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-600 shadow-sm">
              No mock tests available yet for {groupLabel}.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-slate-100">
              {tests.map((test, index) => {
                const summary = summarizeMockTestQuestions(test.questions);
                const duration = Number(test.durationMinutes) || null;
                const locked = isMockTestLocked(test, group);

                return (
                  <article key={test.id} className="px-4 md:px-5 py-3.5 md:py-4 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="h-10 w-10 rounded-xl bg-[#00448a]/10 text-[#00448a] flex items-center justify-center font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h2 className="text-base md:text-lg font-bold text-gray-900 truncate">
                            {test.title || `Mock Test ${index + 1}`}
                          </h2>
                          {duration ? (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 shrink-0">
                              <ClockIcon className="h-3.5 w-3.5" />
                              {duration} min
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium">
                              <LockClosedIcon className="h-3 w-3" />
                              Locked
                            </span>
                          ) : null}
                          {summary.mcq > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[11px] font-medium">
                              <DocumentTextIcon className="h-3.5 w-3.5" />
                              {summary.mcq} MCQ
                            </span>
                          )}
                          {summary.coding > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 text-[11px] font-medium">
                              <CodeBracketIcon className="h-3.5 w-3.5" />
                              {summary.coding} Coding
                            </span>
                          )}
                          {summary.sections.slice(0, 4).map((section) => (
                            <span
                              key={section}
                              className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-[#26ebe5]/15 text-[#00448a] text-[11px] font-medium"
                            >
                              {section}
                            </span>
                          ))}
                          {summary.sections.length > 4 && (
                            <span className="hidden md:inline text-[11px] text-gray-400">
                              +{summary.sections.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                      {locked ? (
                        <div className="inline-flex items-center justify-center gap-1.5 h-10 px-3 md:px-4 rounded-xl bg-slate-100 text-slate-500 text-sm font-semibold shrink-0">
                          <LockClosedIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Locked</span>
                        </div>
                      ) : (
                        <Link
                          href={`/mock-test/${companySlug}/${test.id}`}
                          className="inline-flex items-center justify-center gap-1.5 h-10 px-3 md:px-5 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-semibold shadow-sm shrink-0"
                        >
                          <PlayIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Start Test</span>
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CheckAuth>
  );
}
