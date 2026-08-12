"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CheckAuth from "@/lib/CheckAuth";
import { fetchMockTestGroups, fetchMockTestsForCompany } from "@/lib/mockTests";
import { AcademicCapIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

export default function MockTestCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/mock-tests/groups?withTests=1", { cache: "no-store" });
        if (!cancelled && res.ok) {
          const groups = await res.json();
          if (Array.isArray(groups)) {
            setCompanies(groups);
            return;
          }
        }
        // Fallback: client Firestore, only groups that still have tests
        const groups = await fetchMockTestGroups();
        const visible = [];
        for (const g of groups) {
          const slug = g.slug || g.id;
          const tests = await fetchMockTestsForCompany(slug);
          if (tests.length) visible.push(g);
        }
        if (!cancelled) setCompanies(visible);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCompanies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-cyan-50 pt-24 px-4 sm:px-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Mock Tests</h1>
          <p className="text-gray-600 mb-8">
            Choose a company to view available mock tests and start practicing.
          </p>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-600">
              No mock test groups available yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {companies.map((company) => {
                const slug = company.slug || company.id;
                return (
                  <Link
                    key={slug}
                    href={`/mock-test/${slug}`}
                    className="group bg-white rounded-xl shadow border border-gray-100 p-5 flex items-center justify-between hover:border-[#26ebe5] hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-[#00448a]/10 flex items-center justify-center">
                        <AcademicCapIcon className="h-7 w-7 text-[#00448a]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-[#00448a]">
                          {company.label || slug}
                        </p>
                        <p className="text-sm text-gray-500">View mock tests</p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-[#00448a]" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CheckAuth>
  );
}
