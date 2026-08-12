"use client";

import { XMarkIcon, PhoneIcon } from "@heroicons/react/24/solid";

function PhoneCell({ phone }) {
  if (!phone) return <span className="text-gray-400">—</span>;
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-800 font-medium tabular-nums"
    >
      <PhoneIcon className="w-3.5 h-3.5 shrink-0" />
      {phone}
    </a>
  );
}

/**
 * Popup modal for attended / not-attended lists or per-student test overview.
 */
export default function AttendanceDetailModal({
  open,
  onClose,
  title,
  subtitle,
  variant = "not_attended",
  rows = [],
  studentOverview = null,
}) {
  if (!open) return null;

  const isAttended = variant === "attended";
  const isStudentOverview = variant === "student_overview" && studentOverview;

  const headerClass = isStudentOverview
    ? "bg-gradient-to-r from-violet-50 to-cyan-50 border-violet-100"
    : isAttended
      ? "bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-100"
      : "bg-gradient-to-r from-red-50 to-orange-50 border-red-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        <div
          className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${headerClass}`}
        >
          <div className="min-w-0">
            <h2
              id="attendance-modal-title"
              className="text-lg font-bold text-gray-900 truncate"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
            ) : null}
            {!isStudentOverview && (
              <p className="text-xs text-gray-500 mt-1">
                {rows.length} student{rows.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-white/80 hover:text-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {isStudentOverview ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-gray-500">Student</span>
                  <p className="font-semibold text-gray-900">
                    {studentOverview.userName}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Mobile</span>
                  <p className="mt-0.5">
                    <PhoneCell phone={studentOverview.phone} />
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Regd No</span>
                  <p className="font-medium text-gray-800">
                    {studentOverview.regdNo || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Tests attended</span>
                  <p className="font-bold text-violet-700">
                    {studentOverview.attendedCount} /{" "}
                    {studentOverview.totalTests}
                  </p>
                </div>
              </div>

              {studentOverview.attended?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2">
                    Attended ({studentOverview.attended.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-emerald-100">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-emerald-50 text-gray-600">
                          <th className="px-3 py-2 font-medium">Test</th>
                          <th className="px-3 py-2 font-medium text-center">
                            Score
                          </th>
                          <th className="px-3 py-2 font-medium text-center">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentOverview.attended.map(({ test, sub }) => {
                          const pct =
                            typeof sub.autoScore === "number"
                              ? sub.autoScore
                              : sub.score != null && sub.total
                                ? Math.round((sub.score / sub.total) * 100)
                                : null;
                          return (
                            <tr
                              key={test.key}
                              className="border-t border-gray-100"
                            >
                              <td className="px-3 py-2 text-gray-800">
                                {test.label || test.name}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700">
                                {sub.score != null && sub.total != null
                                  ? `${sub.score} / ${sub.total}`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-center font-medium">
                                {pct != null ? `${pct}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {studentOverview.missed?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-800 mb-2">
                    Not attended ({studentOverview.missed.length})
                  </h3>
                  <ul className="rounded-lg border border-red-100 divide-y divide-red-50 bg-white">
                    {studentOverview.missed.map((test) => (
                      <li
                        key={test.key}
                        className="px-3 py-2 text-sm text-gray-700"
                      >
                        {test.label || test.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              No students in this list.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">Student</th>
                    <th className="px-3 py-2.5 font-semibold">Mobile</th>
                    <th className="px-3 py-2.5 font-semibold">Batch</th>
                    {!isAttended ? (
                      <th className="px-3 py-2.5 font-semibold">Regd No</th>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 font-semibold text-center">
                          Score
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-center">
                          %
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.id || row.rosterDocId || row.userId || i}
                      className="border-t border-gray-100 hover:bg-gray-50/60"
                    >
                      <td className="px-3 py-2.5 text-gray-500 tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">
                        {row.userName || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <PhoneCell phone={row.phone} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {row.batchName || "—"}
                      </td>
                      {!isAttended ? (
                        <td className="px-3 py-2.5 text-gray-600">
                          {row.regdNo || "—"}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 text-center text-gray-700">
                            {row.score != null && row.total != null
                              ? `${row.score} / ${row.total}`
                              : row.score ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium text-gray-800">
                            {row.percent != null ? `${row.percent}%` : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
