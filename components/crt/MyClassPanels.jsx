"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  MessageSquare,
  Presentation,
  Radio,
  Video,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { localDateStr } from "@/lib/crtAttendance";
import { fetchMyCrtClasses } from "@/lib/crtStudentProgress";

const RECENT_ACTIONS = [
  { id: "record", label: "Record class", icon: Video, primary: true },
  { id: "pdf", label: "Class PDF", icon: FileText },
  { id: "ppt", label: "PPT", icon: Presentation },
  { id: "assignment", label: "Assignment", icon: ClipboardList },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "trainer-pdf", label: "Trainer reference PDF", icon: BookOpen },
];

const UPCOMING_ACTIONS = [
  { id: "live", label: "Live class", icon: Radio, primary: true },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "ppt", label: "PPT", icon: Presentation },
];

function pdfHref(url, title) {
  return `/view-pdf-secure?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || "PDF")}`;
}

function pptHref(url, title) {
  return `/view-ppt?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || "PPT")}`;
}

function whenLabel(cls) {
  if (!cls?.unlockedAt) return "";
  const d = cls.unlockedAt;
  return localDateStr(d) === localDateStr() ? "Today" : d.toLocaleDateString();
}

/** Class shown in the "Upcoming / Current" panel: today's class, else the next locked day. */
function upcomingOf(course) {
  return course.current ? { ...course.current, isCurrent: true } : course.upcoming;
}

/**
 * What one action does for one course's class: { disabled, reason } or { href, external } or
 * { tests } for assignments.
 */
function resolveAction(panel, actionId, course) {
  const cls = panel === "recent" ? course.recent : upcomingOf(course);
  if (!cls) {
    return {
      disabled: true,
      reason: panel === "recent" ? "No class unlocked yet" : "No upcoming class",
    };
  }
  const name = `${course.courseTitle} – Day ${cls.day}`;
  const dayLink = (action) => `${course.courseHref}?day=${encodeURIComponent(cls.id)}&action=${action}`;

  if (panel === "upcoming") {
    if (actionId === "live") {
      return cls.liveClassLink
        ? { href: cls.liveClassLink, external: true }
        : { disabled: true, reason: "Live link not shared yet" };
    }
    if (!cls.isCurrent) return { disabled: true, reason: "Opens when the trainer starts this class" };
  }

  switch (actionId) {
    case "record":
      return cls.recordedClassLink
        ? { href: dayLink("record") }
        : { disabled: true, reason: "Recording not uploaded yet" };
    case "pdf":
      return cls.pdfUrl ? { href: pdfHref(cls.pdfUrl, name) } : { disabled: true, reason: "No PDF for this class" };
    case "ppt":
      return cls.pptUrl ? { href: pptHref(cls.pptUrl, name) } : { disabled: true, reason: "No PPT for this class" };
    case "trainer-pdf":
      return cls.referenceUrl
        ? { href: pdfHref(cls.referenceUrl, `${name} – Trainer reference`) }
        : { disabled: true, reason: "No trainer reference for this class" };
    case "feedback":
      return { href: dayLink("feedback") };
    case "assignment":
      return cls.tests?.length ? { tests: cls.tests } : { disabled: true, reason: "No assignment for this day" };
    default:
      return { disabled: true, reason: "" };
  }
}

function PanelButtons({ actions, onSelect }) {
  const secondaryCount = actions.filter((a) => !a.primary).length;
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {actions.map(({ id, label, icon: Icon, primary }, idx) => {
        const lastOdd = !primary && secondaryCount % 2 === 1 && idx === actions.length - 1;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium leading-tight transition-colors ${
              primary || lastOdd ? "col-span-2" : ""
            } ${
              primary
                ? "bg-[#00448a] text-white hover:bg-[#003a76]"
                : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-[#26ebe5]"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${primary ? "" : "text-[#00448a]"}`} />
            <span className="text-center">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** "Recent class" and "Upcoming / Current class" panels for the student's enrolled programme. */
export default function MyClassPanels({ user, enrollment }) {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { panel: "recent" | "upcoming", action }

  useEffect(() => {
    if (!enrollment?.crtId || !user?.uid) {
      setCourses([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMyCrtClasses(db, user, enrollment)
      .then((list) => !cancelled && setCourses(list))
      .catch(() => !cancelled && setCourses([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [enrollment, user]);

  const actionMeta = modal
    ? (modal.panel === "recent" ? RECENT_ACTIONS : UPCOMING_ACTIONS).find((a) => a.id === modal.action)
    : null;

  const runAction = (result) => {
    if (result.external) window.open(result.href, "_blank", "noopener,noreferrer");
    else router.push(result.href);
    setModal(null);
  };

  const selectAction = (panel, action) => setModal({ panel, action });

  // Courses with a class for the open panel first (latest on top), then the rest.
  const modalCourses = modal
    ? [...courses].sort((a, b) => {
        const ca = modal.panel === "recent" ? a.recent : upcomingOf(a);
        const cb = modal.panel === "recent" ? b.recent : upcomingOf(b);
        if (!!ca !== !!cb) return ca ? -1 : 1;
        if (modal.panel === "recent") {
          return (cb?.unlockedAt?.getTime() || 0) - (ca?.unlockedAt?.getTime() || 0);
        }
        return Number(!!cb?.isCurrent) - Number(!!ca?.isCurrent);
      })
    : [];

  return (
    <>
      <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-md p-4 sm:p-6 lg:p-5 xl:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
          <Video className="w-5 h-5 text-[#00448a]" />
          Recent class
        </h2>
        <PanelButtons actions={RECENT_ACTIONS} onSelect={(action) => selectAction("recent", action)} />
      </div>

      <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-md p-4 sm:p-6 lg:p-5 xl:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#00448a]" />
          Upcoming / Current class
        </h2>
        <PanelButtons actions={UPCOMING_ACTIONS} onSelect={(action) => selectAction("upcoming", action)} />
      </div>

      {modal && actionMeta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} aria-hidden="true" />
          <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#00448a] to-[#26ebe5] text-white">
              <div className="flex items-center gap-2">
                <actionMeta.icon className="w-5 h-5" />
                <h2 className="text-base sm:text-lg font-semibold">
                  {actionMeta.label}
                  <span className="ml-2 text-sm font-normal text-white/80">
                    · {modal.panel === "recent" ? "Recent class" : "Upcoming / Current class"}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-5 sm:px-6 pt-3 text-xs sm:text-sm text-gray-600">Select a course</p>
            <div className="p-4 sm:p-6 space-y-3 max-h-[65vh] overflow-y-auto">
              {loading && <p className="text-sm text-gray-500">Loading your classes…</p>}
              {!loading && modalCourses.length === 0 && (
                <p className="text-sm text-gray-500">No courses in your programme yet.</p>
              )}
              {!loading && modalCourses.map((course) => {
                  const cls = modal.panel === "recent" ? course.recent : upcomingOf(course);
                  const result = resolveAction(modal.panel, modal.action, course);
                  const header = (
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{course.courseTitle}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {cls ? `Day ${cls.day}: ${cls.title}` : "—"}
                        {cls && modal.panel === "recent" && whenLabel(cls) ? ` · ${whenLabel(cls)}` : ""}
                        {cls?.isCurrent ? " · Live today" : ""}
                      </p>
                    </div>
                  );

                  if (result.tests) {
                    return (
                      <div key={course.courseId} className="rounded-xl border border-gray-200 p-3">
                        {header}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {result.tests.map((t) => (
                            <Link
                              key={t.id}
                              href={`${course.assignmentBase}/${t.id}`}
                              onClick={() => setModal(null)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              {t.title}
                              <span className="text-[10px] uppercase text-blue-600">{t.type}</span>
                              {t.submitted ? (
                                <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">Done</span>
                              ) : (
                                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">Pending</span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={course.courseId}
                      type="button"
                      disabled={result.disabled}
                      onClick={() => runAction(result)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-[#00448a]/40 hover:bg-[#00448a]/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white disabled:hover:border-gray-200"
                    >
                      {header}
                      <span
                        className={`shrink-0 max-w-[45%] text-right text-xs font-semibold ${result.disabled ? "text-gray-500" : "text-[#00448a]"}`}
                      >
                        {result.disabled ? result.reason : result.external ? "Join →" : "Open →"}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
