"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Download,
  IndianRupee,
  Lightbulb,
  RefreshCw,
  TrendingUp,
  Users,
  UserX,
} from "lucide-react";
import { auth, db, firestoreHelpers } from "../../../../lib/firebase";
import { csvEscape, subscribeCrtStudents, toMillis } from "@/lib/crtPlacementData";

const DATE_RANGES = ["Last 30 Days", "Last 90 Days", "Last 6 Months", "Full Year", "All Time"];
const DAY_MS = 86400000;

function rangeStart(label) {
  const now = Date.now();
  if (label === "Last 30 Days") return now - 30 * DAY_MS;
  if (label === "Last 90 Days") return now - 90 * DAY_MS;
  if (label === "Last 6 Months") return now - 183 * DAY_MS;
  if (label === "Full Year") return now - 365 * DAY_MS;
  return 0;
}

const CARD_COLORS = {
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  green: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  red: "bg-gradient-to-br from-rose-500 to-rose-600",
  violet: "bg-gradient-to-br from-violet-500 to-violet-600",
  amber: "bg-gradient-to-br from-amber-500 to-orange-500",
  cyan: "bg-gradient-to-br from-cyan-500 to-sky-500",
  indigo: "bg-gradient-to-br from-indigo-500 to-indigo-600",
  teal: "bg-gradient-to-br from-teal-500 to-teal-600",
};

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {children}
  </div>
);

const KpiCard = ({ label, value, icon: Icon, accent }) => (
  <Card className="p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">{value}</p>
      </div>
      <div className={`rounded-xl p-2.5 ${accent}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>
    </div>
  </Card>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const TableSection = ({ title, headers, rows, renderRow, empty }) => (
  <Card className="overflow-x-auto">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <table className="w-full text-left mt-4">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/80">
          {headers.map((h) => (
            <th key={h} className="p-3 text-sm font-semibold text-slate-700">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(renderRow)}
        {rows.length === 0 && (
          <tr>
            <td colSpan={headers.length} className="p-6 text-center text-sm text-slate-500">{empty}</td>
          </tr>
        )}
      </tbody>
    </table>
  </Card>
);

/** Offers inside the selected date range (offers without a date are kept). */
function offersInRange(student, startMs) {
  if (!startMs) return student.offers;
  return student.offers.filter((o) => !o.offerDate || toMillis(o.offerDate) >= startMs);
}

export default function CRTPOAnalyticsDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState({
    academicYear: "All",
    department: "All",
    placementStatus: "All",
    dateRange: "All Time",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) return setLoading(false);
      try {
        const snap = await firestoreHelpers.getDoc(firestoreHelpers.doc(db, "users", u.uid));
        const role = snap.exists() ? snap.data().role : null;
        setHasAccess(["admin", "superadmin", "collegeAdmin", "crtPoUser", "po", "crtPO"].includes(role));
      } catch {
        setHasAccess(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !hasAccess) return undefined;
    setDataLoading(true);
    setDataError("");
    return subscribeCrtStudents(
      (rows) => {
        setStudents(rows);
        setDataLoading(false);
        setLastUpdated(new Date());
      },
      (err) => {
        setDataLoading(false);
        setDataError(
          err?.code === "permission-denied"
            ? "You do not have permission to read CRT student data."
            : err?.message || "Could not load CRT students."
        );
      }
    );
  }, [user, hasAccess, reloadKey]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const academicYearOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.academicYear).filter(Boolean));
    return ["All", ...[...set].sort().reverse()];
  }, [students]);

  const departmentOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.department).filter(Boolean));
    return ["All", ...[...set].sort()];
  }, [students]);

  const startMs = rangeStart(filters.dateRange);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          (filters.academicYear === "All" || s.academicYear === filters.academicYear) &&
          (filters.department === "All" || s.department === filters.department) &&
          (filters.placementStatus === "All" || s.status === filters.placementStatus)
      ),
    [students, filters.academicYear, filters.department, filters.placementStatus]
  );

  const placedStudents = useMemo(
    () =>
      filteredStudents
        .filter((s) => s.status === "Placed" && (!startMs || offersInRange(s, startMs).length > 0))
        .map((s) => {
          const offers = offersInRange(s, startMs);
          const best = offers.reduce((top, o) => (o.packageLpa > (top?.packageLpa || 0) ? o : top), offers[0]);
          return { ...s, bestOffer: best, offersInRange: offers };
        }),
    [filteredStudents, startMs]
  );

  const unplacedStudents = useMemo(
    () => filteredStudents.filter((s) => s.status === "Unplaced"),
    [filteredStudents]
  );

  const departmentOverview = useMemo(() => {
    const map = new Map();
    filteredStudents.forEach((s) => {
      const row = map.get(s.department) || { department: s.department, total: 0, placed: 0 };
      row.total += 1;
      if (s.status === "Placed") row.placed += 1;
      map.set(s.department, row);
    });
    return [...map.values()]
      .map((r) => ({ ...r, rate: r.total ? Math.round((r.placed / r.total) * 100) : 0 }))
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [filteredStudents]);

  const allOffers = useMemo(() => placedStudents.flatMap((s) => s.offersInRange), [placedStudents]);

  const companyRecruitment = useMemo(() => {
    const map = new Map();
    placedStudents.forEach((s) => {
      s.offersInRange.forEach((o) => {
        const key = o.company.toLowerCase();
        const row = map.get(key) || { company: o.company, students: new Set(), offers: 0, total: 0 };
        row.students.add(s.id);
        row.offers += 1;
        row.total += o.packageLpa || 0;
        map.set(key, row);
      });
    });
    return [...map.values()]
      .map((r) => ({
        company: r.company,
        recruited: r.students.size,
        offers: r.offers,
        avgPackageLpa: r.offers ? (r.total / r.offers).toFixed(1) : "0.0",
      }))
      .sort((a, b) => b.recruited - a.recruited || a.company.localeCompare(b.company));
  }, [placedStudents]);

  const monthlyTrend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, month: d.toLocaleString("en-IN", { month: "short" }), placed: 0, offers: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    filteredStudents.forEach((s) => {
      const counted = new Set();
      s.offers.forEach((o) => {
        const key = o.offerDate?.slice(0, 7);
        const bucket = key && byKey.get(key);
        if (!bucket) return;
        bucket.offers += 1;
        if (!counted.has(key)) {
          bucket.placed += 1;
          counted.add(key);
        }
      });
    });
    return months;
  }, [filteredStudents]);

  const trendMax = Math.max(1, ...monthlyTrend.map((m) => Math.max(m.placed, m.offers)));

  const stats = useMemo(() => {
    const placementRate = filteredStudents.length
      ? Math.round((placedStudents.length / filteredStudents.length) * 100)
      : 0;
    const packages = allOffers.map((o) => o.packageLpa).filter((p) => p > 0);
    const highestPackage = packages.length ? Math.max(...packages) : 0;
    const averagePackage = packages.length ? packages.reduce((a, b) => a + b, 0) / packages.length : 0;
    return { placementRate, highestPackage, averagePackage };
  }, [filteredStudents, placedStudents, allOffers]);

  const insights = useMemo(() => {
    const ranked = departmentOverview.filter((d) => d.total >= 3).sort((a, b) => b.rate - a.rate);
    const positive = [];
    const actions = [];
    if (ranked[0]) positive.push(`${ranked[0].department} leads with a ${ranked[0].rate}% placement rate.`);
    if (companyRecruitment[0]) positive.push(`${companyRecruitment[0].company} recruited the most students (${companyRecruitment[0].recruited}).`);
    if (stats.averagePackage) positive.push(`Average package is ${stats.averagePackage.toFixed(1)} LPA.`);
    const weak = ranked.filter((d) => d.rate < 50).slice(-2);
    if (weak.length) actions.push(`Run focused mock drives for ${weak.map((d) => d.department).join(" and ")}.`);
    if (unplacedStudents.length) actions.push(`${unplacedStudents.length} student(s) are still unplaced — plan aptitude refresh sessions.`);
    if (!companyRecruitment.length) actions.push("No offers recorded yet for this filter.");
    return {
      positive: positive.length ? positive : ["Not enough data yet."],
      actions: actions.length ? actions : ["Keep the current placement plan going."],
    };
  }, [departmentOverview, companyRecruitment, stats.averagePackage, unplacedStudents.length]);

  const kpis = [
    { label: "Total Students", value: filteredStudents.length, icon: Users, accent: CARD_COLORS.blue },
    { label: "Placed", value: placedStudents.length, icon: TrendingUp, accent: CARD_COLORS.green },
    { label: "Unplaced", value: unplacedStudents.length, icon: UserX, accent: CARD_COLORS.red },
    { label: "Placement Rate", value: `${stats.placementRate}%`, icon: BarChart3, accent: CARD_COLORS.violet },
    { label: "Highest Package", value: `${stats.highestPackage.toFixed(1)} LPA`, icon: IndianRupee, accent: CARD_COLORS.amber },
    { label: "Average Package", value: `${stats.averagePackage.toFixed(1)} LPA`, icon: IndianRupee, accent: CARD_COLORS.cyan },
    { label: "Total Recruiters", value: companyRecruitment.length, icon: Building2, accent: CARD_COLORS.indigo },
    { label: "Offers Made", value: allOffers.length, icon: TrendingUp, accent: CARD_COLORS.teal },
  ];

  const handleExport = () => {
    const header = ["Reg No", "Name", "Department", "Academic Year", "Status", "Companies", "Best Package LPA", "Latest Offer Date"];
    const placedById = new Map(placedStudents.map((s) => [s.id, s]));
    const lines = filteredStudents.map((s) => {
      const p = placedById.get(s.id);
      const offers = p ? p.offersInRange : [];
      const latest = offers.map((o) => o.offerDate).filter(Boolean).sort().pop() || "";
      return [
        s.regNo,
        s.name,
        s.department,
        s.academicYear,
        s.status,
        offers.map((o) => o.company).join("; "),
        p?.bestOffer?.packageLpa ?? "",
        latest,
      ]
        .map(csvEscape)
        .join(",");
    });
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crt-po-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading CRT PO analytics...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md w-full text-center p-10 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-8">PO or Admin access required.</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
          >
            Go to Home
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4 py-8 sm:py-10">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">CRT PO Analytics Dashboard</h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1">
                  Live placement data recorded by the PO for students assigned to CRT programs.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {lastUpdated ? `Live · last update ${lastUpdated.toLocaleString()}` : "Connecting…"}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  disabled={dataLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60"
                  title="Reload the list of students assigned to CRT programs"
                >
                  <RefreshCw className={`w-4 h-4 ${dataLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  disabled={filteredStudents.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <SelectField label="Academic Year" value={filters.academicYear} onChange={(e) => setFilter("academicYear", e.target.value)} options={academicYearOptions} />
              <SelectField label="Department" value={filters.department} onChange={(e) => setFilter("department", e.target.value)} options={departmentOptions} />
              <SelectField label="Placement Status" value={filters.placementStatus} onChange={(e) => setFilter("placementStatus", e.target.value)} options={["All", "Placed", "Unplaced"]} />
              <SelectField label="Offer Date Range" value={filters.dateRange} onChange={(e) => setFilter("dateRange", e.target.value)} options={DATE_RANGES} />
            </div>
          </div>
        </Card>

        {dataError && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-rose-800">{dataError}</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold">
              Retry
            </button>
          </div>
        )}

        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading live student data…</p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
            </div>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-lg font-semibold text-slate-900">Department Placement Overview</h2>
                <div className="mt-4 space-y-4">
                  {departmentOverview.map(({ department, placed, total, rate }) => (
                    <div key={department}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700">{department}</span>
                        <span className="text-slate-500">{placed}/{total} ({rate}%)</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#00448a] to-cyan-600" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  ))}
                  {departmentOverview.length === 0 && <p className="text-sm text-slate-500">No students for this filter.</p>}
                </div>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-slate-900">Placement Status Chart</h2>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Placed", value: placedStudents.length, color: "text-emerald-600" },
                    { label: "Unplaced", value: unplacedStudents.length, color: "text-rose-600" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className={`mt-2 text-2xl font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${stats.placementRate}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Placement ratio: {stats.placementRate}%</p>
              </Card>
            </div>

            <Card className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900">Placement Trend (last 6 months)</h2>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {monthlyTrend.map(({ key, month, placed, offers }) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">{month}</p>
                    <div className="mt-2 space-y-2">
                      {[
                        { label: "Placed", value: placed, color: "bg-[#00448a]" },
                        { label: "Offers", value: offers, color: "bg-cyan-500" },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div className={`h-full ${item.color}`} style={{ width: `${(item.value / trendMax) * 100}%` }} />
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">{item.label}: {item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TableSection
                title="Company-wise Recruitment"
                headers={["Company", "Students Recruited", "Offers Made", "Avg Package"]}
                rows={companyRecruitment}
                empty="No offers recorded for this filter."
                renderRow={(c) => (
                  <tr key={c.company} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 text-sm text-slate-900 font-medium">{c.company}</td>
                    <td className="p-3 text-sm text-slate-600">{c.recruited}</td>
                    <td className="p-3 text-sm text-slate-600">{c.offers}</td>
                    <td className="p-3 text-sm text-slate-600">{c.avgPackageLpa} LPA</td>
                  </tr>
                )}
              />

              <TableSection
                title="Placed Students"
                headers={["Reg No", "Name", "Dept", "Company", "Package"]}
                rows={placedStudents}
                empty="No placed students for this filter."
                renderRow={(s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 text-sm text-slate-600">{s.regNo}</td>
                    <td className="p-3 text-sm text-slate-900 font-medium">{s.name}</td>
                    <td className="p-3 text-sm text-slate-600">{s.department}</td>
                    <td className="p-3 text-sm text-slate-600">
                      {s.offersInRange.map((o) => o.company).join(", ") || "—"}
                    </td>
                    <td className="p-3 text-sm text-slate-600">
                      {s.bestOffer?.packageLpa ? `${s.bestOffer.packageLpa} LPA` : "—"}
                    </td>
                  </tr>
                )}
              />
            </div>

            <div className="mt-6">
              <TableSection
                title="Unplaced Students"
                headers={["Reg No", "Name", "Dept", "Status"]}
                rows={unplacedStudents}
                empty="Every student in this filter is placed."
                renderRow={(s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 text-sm text-slate-600">{s.regNo}</td>
                    <td className="p-3 text-sm text-slate-900 font-medium">{s.name}</td>
                    <td className="p-3 text-sm text-slate-600">{s.department}</td>
                    <td className="p-3 text-sm">
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-rose-700 text-xs font-medium">
                        Unplaced
                      </span>
                    </td>
                  </tr>
                )}
              />
            </div>

            <Card className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Insights & Recommendations
              </h2>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  { title: "Positive Signals", box: "border-emerald-200 bg-emerald-50", titleColor: "text-emerald-800", textColor: "text-emerald-700", items: insights.positive },
                  { title: "Action Recommendations", box: "border-amber-200 bg-amber-50", titleColor: "text-amber-800", textColor: "text-amber-700", items: insights.actions },
                ].map((section) => (
                  <div key={section.title} className={`rounded-xl border p-4 ${section.box}`}>
                    <p className={`text-sm font-semibold ${section.titleColor}`}>{section.title}</p>
                    <ul className={`mt-2 space-y-1 text-sm ${section.textColor}`}>
                      {section.items.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
