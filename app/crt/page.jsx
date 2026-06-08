"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import CheckAuth from "../../lib/CheckAuth";
import { db, firestoreHelpers } from "../../lib/firebase";
import { createSlug } from "../../lib/urlUtils";
import { tenantSegments } from "@/lib/tenantPath";
import {
  CodeBracketIcon,
  CpuChipIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

const ICON_MAP = { code: CodeBracketIcon, cpu: CpuChipIcon };

const STYLE_BY_ICON = {
  code: { iconBg: "bg-red-100", iconColor: "text-red-600", bg: "bg-red-50" },
  cpu: { iconBg: "bg-violet-100", iconColor: "text-violet-600", bg: "bg-violet-50" },
};

function mapCrtToProgram(doc) {
  const d = doc.data();
  const id = doc.id;
  const iconKey = d.iconKey === "cpu" ? "cpu" : "code";
  const style = STYLE_BY_ICON[iconKey] || STYLE_BY_ICON.code;
  const totalHours = typeof d.totalHours === "number" ? d.totalHours : 400;
  const commonHours = typeof d.commonHours === "number" ? d.commonHours : 200;
  const technicalHours = typeof d.technicalHours === "number" ? d.technicalHours : 200;
  const commonCourses = Array.isArray(d.commonCourses) ? d.commonCourses : [];
  const technicalCourses = Array.isArray(d.technicalCourses) ? d.technicalCourses : [];
  return {
    id,
    title: d.name || id,
    description: d.description || "",
    duration: d.duration || "12–16 weeks",
    image: d.image || "/LmsImg.jpg",
    iconKey,
    icon: ICON_MAP[iconKey] || CodeBracketIcon,
    ...style,
    totalHours,
    commonHours,
    commonLabel: d.commonLabel || "Non-technical",
    commonCourses,
    technicalHours,
    technicalCourses,
  };
}

export default function CRTPage() {
  const router = useRouter();
  const [imageErrors, setImageErrors] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [crts, setCrts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, ...tenantSegments(null, "crt"))
        );
        if (cancelled) return;
        setCrts(snap.docs.map(mapCrtToProgram));
      } catch (e) {
        if (!cancelled) setCrts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const programs = useMemo(() => crts, [crts]);

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 pt-16">
        {/* Hero – CRT Banner image */}
        <div className="relative mt-[-80px] min-h-[280px] sm:min-h-[320px] md:min-h-[380px] text-white py-12 sm:py-16 px-4 sm:px-6 shadow-xl overflow-hidden">
          <Image
            src="/CRTImages/CRT Banner.jpg"
            alt="CRT Programmes"
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-blue-900/40" aria-hidden="true" />
          <div className="relative max-w-4xl  text-black mx-auto text-center z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-medium mb-5 border border-white/20">
              <AcademicCapIcon className="w-4 h-4" />
              Campus Recruitment Training
            </div>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl  font-bold tracking-tight mb-4 drop-shadow-sm"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              Programmes
            </h1>
          </div>
        </div>

        {/* Program blocks */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8 sm:space-y-10">
          {loading && (
            <div className="text-center py-12 text-slate-500">Loading programmes...</div>
          )}
          {!loading && programs.length === 0 && (
            <div className="text-center py-12 text-slate-500">No CRT programmes yet.</div>
          )}
          {!loading && programs.map((program) => {
            const Icon = program.icon;
            const totalHours = program.totalHours ?? 400;
            const commonHours = program.commonHours ?? 200;
            const technicalHours = program.technicalHours ?? 200;
            const commonLabel = program.commonLabel || "Non-technical";
            const commonCourses = program.commonCourses || [];
            const technicalCourses = program.technicalCourses || [];
            const showCourses = expandedId === program.id;

            return (
              <div
                key={program.id}
                className="group flex flex-col md:flex-row gap-0 bg-white rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/60 border border-slate-200/80"
              >
                {/* Image / Courses area – always left */}
                <div
                  className="relative w-full md:w-[55%] aspect-[16/10] md:aspect-[2/1] shrink-0 overflow-hidden md:order-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId((prev) => (prev === program.id ? null : program.id));
                  }}
                >
                  <div className="absolute inset-3 md:inset-4 rounded-2xl md:rounded-3xl overflow-hidden shadow-inner">
                    {/* Image */}
                    <div
                      className={`absolute inset-0 transition-all duration-400 ${
                        showCourses ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 group-hover:opacity-0 group-hover:scale-105"
                      }`}
                    >
                      <Image
                        src={imageErrors[program.id] ? "/LmsImg.jpg" : program.image}
                        alt={program.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 55vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={() => setImageErrors((prev) => ({ ...prev, [program.id]: true }))}
                      />
                    </div>
                    {/* Course list overlay: 200 hr common + 200 hr technical */}
                    <div
                      className={`absolute inset-0 flex flex-col justify-center p-5 md:p-6 transition-all duration-400 rounded-2xl md:rounded-3xl overflow-y-auto ${
                        showCourses
                          ? "opacity-100 bg-gradient-to-br from-[#1a5796] to-[#0d3a6e]"
                          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:bg-gradient-to-br group-hover:from-[#1a5796] group-hover:to-[#0d3a6e]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                          <BookOpenIcon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white/95 font-semibold text-sm uppercase tracking-wider">{totalHours}hours program</span>
                      </div>
                      {/* Non-technical (common) block */}
                      <p className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-2">{commonHours}hours – {commonLabel}</p>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {commonCourses.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-medium border border-white/15"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      {/* Technical block */}
                      <p className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-2">{technicalHours}hours – Technical</p>
                      <div className="flex flex-wrap gap-1.5">
                        {technicalCourses.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/15 text-white text-xs font-medium backdrop-blur-sm border border-white/10"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-white/70 text-xs">
                        {showCourses ? "Tap again to show image" : "Hover or tap to see courses"}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Description – always right */}
                <div
                  className="flex-1 flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 md:py-12 md:order-2 md:pl-4"
                  onClick={() => router.push(`/crt/${createSlug(program.title)}`)}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-xl ${program.iconBg} ${program.iconColor} flex items-center justify-center shrink-0 shadow-sm`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{program.title}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ${program.bg} ${program.iconColor}`}>
                        {program.duration}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{program.totalHours ?? 400} hours programme</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed mb-6 max-w-lg text-sm sm:text-base">
                      {program.description}
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-[#00448a]/25 transition-all duration-200"
                    >
                      View Programme
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CheckAuth>
  );
}
