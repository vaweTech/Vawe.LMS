"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CheckAuth from "@/lib/CheckAuth";
import {
  fetchMockTestGroup,
  fetchMockTestsForCompany,
  summarizeMockTestQuestions,
} from "@/lib/mockTests";
import {
  ArrowLeftIcon,
  ClockIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";

export default function MockTestCompanyPage() {
  const { companySlug } = useParams();
  const router = useRouter();
  const [tests, setTests] = useState([]);
  const [groupLabel, setGroupLabel] = useState("");
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-dvh bg-gradient-to-br from-[#00448a]/5 via-sky-50 to-cyan-50 pt-24 px-4 sm:px-6 pb-12">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => router.push("/mock-test")}
            className="inline-flex items-center gap-2 text-sm text-[#00448a] hover:underline mb-6"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            All companies
          </button>

          <div className="rounded-2xl bg-gradient-to-r from-[#00448a] to-[#0066b3] text-white p-6 sm:p-8 shadow-lg mb-8">
            <p className="text-sm text-white/80 uppercase tracking-wide font-medium">Mock Tests</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">{groupLabel}</h1>
            <p className="text-white/90 mt-2 text-sm sm:text-base">
              {loading
                ? "Loading..."
                : `${tests.length} test${tests.length === 1 ? "" : "s"} · section-based MCQ & coding`}
            </p>
            {!loading && tests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
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

          {loading ? (
            <div className="text-center py-16 text-gray-500">Loading mock tests...</div>
          ) : tests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-600 shadow-sm">
              No mock tests available yet for {groupLabel}.
            </div>
          ) : (
            <div className="grid gap-5">
              {tests.map((test, index) => {
                const summary = summarizeMockTestQuestions(test.questions);
                const duration = Number(test.durationMinutes) || null;

                return (
                  <article
                    key={test.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden"
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#00448a]/70">
                              Test {index + 1}
                            </span>
                            {duration ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <ClockIcon className="h-3.5 w-3.5" />
                                {duration} min
                              </span>
                            ) : null}
                          </div>
                          <h2 className="text-xl font-bold text-gray-900">
                            {test.title || `Mock Test ${index + 1}`}
                          </h2>

                          <div className="flex flex-wrap gap-2 mt-3">
                            {summary.mcq > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-medium">
                                <DocumentTextIcon className="h-3.5 w-3.5" />
                                {summary.mcq} MCQ
                              </span>
                            )}
                            {summary.coding > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-800 text-xs font-medium">
                                <CodeBracketIcon className="h-3.5 w-3.5" />
                                {summary.coding} Coding
                              </span>
                            )}
                          </div>

                          {summary.sections.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Sections
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {summary.sections.map((section) => (
                                  <span
                                    key={section}
                                    className="px-3 py-1 rounded-full border border-[#26ebe5]/40 bg-[#26ebe5]/10 text-[#00448a] text-xs font-medium"
                                  >
                                    {section}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/mock-test/${companySlug}/${test.id}`}
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-semibold shadow-md shrink-0 transition"
                        >
                          <PlayIcon className="h-5 w-5" />
                          Start Test
                        </Link>
                      </div>
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
