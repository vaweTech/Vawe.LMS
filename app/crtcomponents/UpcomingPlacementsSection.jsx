"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Building2, Users, CheckCircle2, XCircle } from "lucide-react";

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {children}
  </div>
);

const UPCOMING_PLACEMENTS = [
  {
    id: 1,
    company: "Amazon",
    role: "SDE Intern / FTE",
    driveDate: "2026-01-12",
    minCgpa: 7.5,
    departments: ["CSE", "ECE"],
    eligibleStudents: [
      { regNo: "CRT001", name: "Akhil Kumar", department: "CSE", eligibility: "Eligible", placementStatus: "Placed" },
      { regNo: "CRT002", name: "Divya Reddy", department: "ECE", eligibility: "Eligible", placementStatus: "Placed" },
      { regNo: "CRT008", name: "Bhavya T", department: "CSE", eligibility: "Eligible", placementStatus: "Unplaced" },
      { regNo: "CRT012", name: "Mounika N", department: "ECE", eligibility: "Not Eligible", placementStatus: "Placed" },
    ],
  },
  {
    id: 2,
    company: "HCL",
    role: "Graduate Engineer Trainee",
    driveDate: "2026-01-18",
    minCgpa: 6.5,
    departments: ["CSE", "ECE", "EEE"],
    eligibleStudents: [
      { regNo: "CRT003", name: "Sandeep Raj", department: "EEE", eligibility: "Eligible", placementStatus: "Unplaced" },
      { regNo: "CRT007", name: "Karthik B", department: "ECE", eligibility: "Eligible", placementStatus: "Placed" },
      { regNo: "CRT009", name: "Sai Teja", department: "EEE", eligibility: "Eligible", placementStatus: "Placed" },
      { regNo: "CRT011", name: "Anusha V", department: "CSE", eligibility: "Eligible", placementStatus: "Placed" },
    ],
  },
  {
    id: 3,
    company: "Zoho",
    role: "Software Developer",
    driveDate: "2026-01-25",
    minCgpa: 7.0,
    departments: ["CSE"],
    eligibleStudents: [
      { regNo: "CRT001", name: "Akhil Kumar", department: "CSE", eligibility: "Eligible", placementStatus: "Placed" },
      { regNo: "CRT004", name: "Harika S", department: "CSE", eligibility: "Eligible", placementStatus: "Placed" },
      { regNo: "CRT008", name: "Bhavya T", department: "CSE", eligibility: "Eligible", placementStatus: "Unplaced" },
      { regNo: "CRT011", name: "Anusha V", department: "CSE", eligibility: "Eligible", placementStatus: "Placed" },
    ],
  },
];

export default function UpcomingPlacementsSection() {
  const [selectedCompanyId, setSelectedCompanyId] = useState(UPCOMING_PLACEMENTS[0]?.id || null);

  const selectedCompany = useMemo(
    () => UPCOMING_PLACEMENTS.find((c) => c.id === selectedCompanyId),
    [selectedCompanyId]
  );

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-100 p-2.5">
            <CalendarDays className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Upcoming Placements</h2>
            <p className="text-sm text-slate-600">
              Click a company to view eligible students and their current placement status.
            </p>
          </div>
        </div>

        {/* Company List */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {UPCOMING_PLACEMENTS.map((placement) => {
            const isActive = selectedCompanyId === placement.id;

            return (
              <button
                key={placement.id}
                onClick={() => setSelectedCompanyId(placement.id)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  isActive
                    ? "border-[#00448a] bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{placement.company}</p>
                    <p className="text-sm text-slate-600 mt-1">{placement.role}</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-200">
                    <Building2 className="w-4 h-4 text-slate-700" />
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  <p><span className="font-medium">Drive Date:</span> {placement.driveDate}</p>
                  <p><span className="font-medium">Min CGPA:</span> {placement.minCgpa}</p>
                  <p><span className="font-medium">Departments:</span> {placement.departments.join(", ")}</p>
                  <p><span className="font-medium">Eligible Students:</span> {placement.eligibleStudents.length}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Company Details */}
        {selectedCompany && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedCompany.company} - Eligible Student List
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Role: {selectedCompany.role} | Drive Date: {selectedCompany.driveDate}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <Users className="w-4 h-4" />
                {selectedCompany.eligibleStudents.length} Students
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="p-3 text-sm font-semibold text-slate-700">Reg No</th>
                    <th className="p-3 text-sm font-semibold text-slate-700">Name</th>
                    <th className="p-3 text-sm font-semibold text-slate-700">Department</th>
                    <th className="p-3 text-sm font-semibold text-slate-700">Eligibility</th>
                    <th className="p-3 text-sm font-semibold text-slate-700">Current Placement Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCompany.eligibleStudents.map((student) => (
                    <tr key={student.regNo} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="p-3 text-sm text-slate-600">{student.regNo}</td>
                      <td className="p-3 text-sm text-slate-900 font-medium">{student.name}</td>
                      <td className="p-3 text-sm text-slate-600">{student.department}</td>
                      <td className="p-3 text-sm">
                        {student.eligibility === "Eligible" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-rose-700 text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            Not Eligible
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {student.placementStatus === "Placed" ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 text-xs font-medium">
                            Placed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 text-xs font-medium">
                            Unplaced
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}