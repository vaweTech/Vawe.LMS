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

const FILTER_OPTIONS = {
  academicYears: ["2023-24", "2024-25", "2025-26"],
  departments: ["All", "CSE", "ECE", "EEE", "MECH", "CIVIL"],
  placementStatus: ["All", "Placed", "Unplaced"],
  dateRanges: ["Last 30 Days", "Last 90 Days", "Last 6 Months", "Full Year"],
};

const MONTHLY_TREND = [
  { month: "Jun", placed: 42, offers: 65 },
  { month: "Jul", placed: 51, offers: 73 },
  { month: "Aug", placed: 58, offers: 81 },
  { month: "Sep", placed: 63, offers: 88 },
  { month: "Oct", placed: 67, offers: 94 },
  { month: "Nov", placed: 74, offers: 102 },
];

const STUDENT_DATA = [
  { regNo: "CRT001", name: "Akhil Kumar", department: "CSE", status: "Placed", company: "TCS", packageLpa: 6.8, offerDate: "2025-11-03" },
  { regNo: "CRT002", name: "Divya Reddy", department: "ECE", status: "Placed", company: "Infosys", packageLpa: 5.4, offerDate: "2025-10-20" },
  { regNo: "CRT003", name: "Sandeep Raj", department: "EEE", status: "Unplaced", company: "-", packageLpa: 0, offerDate: "-" },
  { regNo: "CRT004", name: "Harika S", department: "CSE", status: "Placed", company: "Accenture", packageLpa: 7.2, offerDate: "2025-11-17" },
  { regNo: "CRT005", name: "Nithin M", department: "MECH", status: "Unplaced", company: "-", packageLpa: 0, offerDate: "-" },
  { regNo: "CRT006", name: "Pranavi P", department: "CIVIL", status: "Placed", company: "Wipro", packageLpa: 4.2, offerDate: "2025-10-11" },
  { regNo: "CRT007", name: "Karthik B", department: "ECE", status: "Placed", company: "Capgemini", packageLpa: 5.9, offerDate: "2025-09-28" },
  { regNo: "CRT008", name: "Bhavya T", department: "CSE", status: "Unplaced", company: "-", packageLpa: 0, offerDate: "-" },
  { regNo: "CRT009", name: "Sai Teja", department: "EEE", status: "Placed", company: "Tech Mahindra", packageLpa: 4.8, offerDate: "2025-11-22" },
  { regNo: "CRT010", name: "Keerthana L", department: "MECH", status: "Unplaced", company: "-", packageLpa: 0, offerDate: "-" },
  { regNo: "CRT011", name: "Anusha V", department: "CSE", status: "Placed", company: "Deloitte", packageLpa: 8.6, offerDate: "2025-12-02" },
  { regNo: "CRT012", name: "Mounika N", department: "ECE", status: "Placed", company: "Cognizant", packageLpa: 6.1, offerDate: "2025-11-09" },
];

const COMPANY_RECRUITMENT = [
  { company: "TCS", recruited: 22, offers: 29, avgPackageLpa: 5.6 },
  { company: "Infosys", recruited: 19, offers: 26, avgPackageLpa: 5.1 },
  { company: "Accenture", recruited: 16, offers: 21, avgPackageLpa: 6.4 },
  { company: "Deloitte", recruited: 11, offers: 15, avgPackageLpa: 8.1 },
  { company: "Cognizant", recruited: 14, offers: 18, avgPackageLpa: 5.8 },
];

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

const TableSection = ({ title, headers, rows, renderRow }) => (
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
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  </Card>
);

export default function CRTPOAnalyticsDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [filters, setFilters] = useState({
    academicYear: "2025-26",
    department: "All",
    placementStatus: "All",
    dateRange: "Last 6 Months",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) return setLoading(false);

      const snap = await firestoreHelpers.getDoc(firestoreHelpers.doc(db, "users", u.uid));
      const role = snap.exists() ? snap.data().role : null;
      setHasAccess(["admin", "superadmin", "crtPoUser", "po", "crtPO"].includes(role));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const filteredStudents = useMemo(
    () =>
      STUDENT_DATA.filter(
        ({ department, status }) =>
          (filters.department === "All" || department === filters.department) &&
          (filters.placementStatus === "All" || status === filters.placementStatus)
      ),
    [filters.department, filters.placementStatus]
  );

  const placedStudents = useMemo(
    () => filteredStudents.filter((s) => s.status === "Placed"),
    [filteredStudents]
  );

  const unplacedStudents = useMemo(
    () => filteredStudents.filter((s) => s.status === "Unplaced"),
    [filteredStudents]
  );

  const departmentOverview = useMemo(
    () =>
      FILTER_OPTIONS.departments
        .filter((d) => d !== "All")
        .map((department) => {
          const deptStudents = filteredStudents.filter((s) => s.department === department);
          const placed = deptStudents.filter((s) => s.status === "Placed").length;
          const total = deptStudents.length;
          return { department, total, placed, rate: total ? Math.round((placed / total) * 100) : 0 };
        }),
    [filteredStudents]
  );

  const stats = useMemo(() => {
    const placementRate = filteredStudents.length
      ? Math.round((placedStudents.length / filteredStudents.length) * 100)
      : 0;

    const highestPackage = placedStudents.length
      ? Math.max(...placedStudents.map((s) => s.packageLpa))
      : 0;

    const averagePackage = placedStudents.length
      ? (placedStudents.reduce((sum, s) => sum + s.packageLpa, 0) / placedStudents.length).toFixed(1)
      : "0.0";

    return { placementRate, highestPackage, averagePackage };
  }, [filteredStudents, placedStudents]);

  const kpis = [
    { label: "Total Students", value: filteredStudents.length, icon: Users, accent: CARD_COLORS.blue },
    { label: "Placed", value: placedStudents.length, icon: TrendingUp, accent: CARD_COLORS.green },
    { label: "Unplaced", value: unplacedStudents.length, icon: UserX, accent: CARD_COLORS.red },
    { label: "Placement Rate", value: `${stats.placementRate}%`, icon: BarChart3, accent: CARD_COLORS.violet },
    { label: "Highest Package", value: `${stats.highestPackage.toFixed(1)} LPA`, icon: IndianRupee, accent: CARD_COLORS.amber },
    { label: "Average Package", value: `${stats.averagePackage} LPA`, icon: IndianRupee, accent: CARD_COLORS.cyan },
    { label: "Total Recruiters", value: COMPANY_RECRUITMENT.length, icon: Building2, accent: CARD_COLORS.indigo },
    { label: "Offers Made", value: COMPANY_RECRUITMENT.reduce((sum, c) => sum + c.offers, 0), icon: TrendingUp, accent: CARD_COLORS.teal },
  ];

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setRefreshing(false);
    }, 600);
  };

  const handleExport = () => {
    const csv = [
      "RegNo,Name,Department,Status,Company,PackageLPA,OfferDate",
      ...filteredStudents.map(
        ({ regNo, name, department, status, company, packageLpa, offerDate }) =>
          `${regNo},${name},${department},${status},${company},${packageLpa},${offerDate}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url,
      download: "crt-po-analytics.csv",
    }).click();
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
                  Placement performance and hiring insights for CRT PO module.
                </p>
                <p className="text-xs text-slate-500 mt-2">Last updated: {lastUpdated.toLocaleString()}</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <SelectField label="Academic Year" value={filters.academicYear} onChange={(e) => setFilter("academicYear", e.target.value)} options={FILTER_OPTIONS.academicYears} />
              <SelectField label="Department" value={filters.department} onChange={(e) => setFilter("department", e.target.value)} options={FILTER_OPTIONS.departments} />
              <SelectField label="Placement Status" value={filters.placementStatus} onChange={(e) => setFilter("placementStatus", e.target.value)} options={FILTER_OPTIONS.placementStatus} />
              <SelectField label="Date Range" value={filters.dateRange} onChange={(e) => setFilter("dateRange", e.target.value)} options={FILTER_OPTIONS.dateRanges} />
            </div>
          </div>
        </Card>

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
          <h2 className="text-lg font-semibold text-slate-900">Placement Trend Chart</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {MONTHLY_TREND.map(({ month, placed, offers }) => (
              <div key={month} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">{month}</p>
                <div className="mt-2 space-y-2">
                  {[
                    { label: "Placed", value: placed, color: "bg-[#00448a]" },
                    { label: "Offers", value: offers, color: "bg-cyan-500" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${Math.min(item.value, 100)}%` }} />
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
            rows={COMPANY_RECRUITMENT}
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
            renderRow={(s) => (
              <tr key={s.regNo} className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="p-3 text-sm text-slate-600">{s.regNo}</td>
                <td className="p-3 text-sm text-slate-900 font-medium">{s.name}</td>
                <td className="p-3 text-sm text-slate-600">{s.department}</td>
                <td className="p-3 text-sm text-slate-600">{s.company}</td>
                <td className="p-3 text-sm text-slate-600">{s.packageLpa} LPA</td>
              </tr>
            )}
          />
        </div>

        <TableSection
          title="Unplaced Students"
          headers={["Reg No", "Name", "Dept", "Status"]}
          rows={unplacedStudents}
          renderRow={(s) => (
            <tr key={s.regNo} className="border-b border-slate-100 hover:bg-slate-50/60">
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

        <Card className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Insights & Recommendations Panel
          </h2>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              {
                title: "Positive Signals",
                box: "border-emerald-200 bg-emerald-50",
                titleColor: "text-emerald-800",
                textColor: "text-emerald-700",
                items: [
                  "CSE is consistently leading placement conversion.",
                  "Recruiter participation remains healthy this cycle.",
                  "Average package shows month-over-month improvement.",
                ],
              },
              {
                title: "Action Recommendations",
                box: "border-amber-200 bg-amber-50",
                titleColor: "text-amber-800",
                textColor: "text-amber-700",
                items: [
                  "Run focused mock drives for MECH and EEE cohorts.",
                  "Add aptitude refresh sessions for unplaced students.",
                  "Prioritize 2-3 high-offer recruiters for campus follow-up.",
                ],
              },
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
      </div>
    </div>
  );
}