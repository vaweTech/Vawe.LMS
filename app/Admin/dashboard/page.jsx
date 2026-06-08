 "use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { db, firestoreHelpers } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAdminAccess } from "../AdminAccessContext";
import {
  Plus,
  ClipboardList,
  Code2,
  BookOpen,
  Users,
  GraduationCap,
  FileCheck,
  UserCog,
  MessageCircle,
  Layers,
  Briefcase,
  FileQuestion,
  Cpu,
  ShieldAlert,
  ChevronRight,
  Search,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { makeAuthenticatedRequest } from "@/lib/authUtils";

const MODULES = [
  { href: "/Admin/mcqs", icon: ClipboardList, title: "Manage MCQs", description: "Add, edit, and delete multiple-choice questions.", section: "content", color: "blue" },
  { href: "/Admin/coding", icon: Code2, title: "Coding Questions", description: "Create and manage programming challenges.", section: "content", color: "indigo" },
  { href: "/Admin/tutorials", icon: BookOpen, title: "Manage Tutorials", description: "Publish and update tutorials for learners.", section: "content", color: "amber" },
  { href: "/Admin/assignments", icon: FileCheck, title: "Progress Test Submissions", description: "Grade and review student progress tests.", section: "content", color: "purple", adminOnly: true },
  { href: "/Admin/userManager", icon: UserCog, title: "Manage Users", description: "Manage users, classes and permissions.", section: "users", color: "rose", adminOnly: true },
  { href: "/Admin/StudentInfo", icon: GraduationCap, title: "Student Info", description: "View and manage student information.", section: "users", color: "teal", adminOnly: true },
  { href: "/Admin/trainers", icon: Users, title: "Manage Trainers", description: "Create trainers and assign classes/courses.", section: "users", color: "green", adminOnly: true },
  { href: "/Admin/programs", icon: Layers, title: "Manage Programs", description: "Create programs and manage batches/classes.", section: "programs", color: "violet", adminOnly: true },
  { href: "/Admin/internships", icon: Briefcase, title: "Manage Internships", description: "Assign course copies to internships.", section: "programs", color: "lime", adminOnly: true },
  { href: "/Admin/crt", icon: Cpu, title: "Manage CRT", description: "Create courses and assign them to CRT programs.", section: "programs", color: "orange", adminOnly: true },
  { href: "/Admin/interview", icon: FileQuestion, title: "Exams", description: "Create MCQ and descriptive tests.", section: "exams", color: "cyan", adminOnly: true },
  { href: "/Admin/whatsapp", icon: MessageCircle, title: "WhatsApp Messaging", description: "Send group messages by class and courses.", section: "comms", color: "emerald", adminOnly: true },
];

const SECTION_LABELS = {
  content: "Content & Assessments",
  users: "Users & Access",
  programs: "Programs & Internships",
  exams: "Exams",
  comms: "Communications",
};

const COLOR_MAP = {
  blue: "from-blue-500 to-blue-600",
  indigo: "from-indigo-500 to-indigo-600",
  amber: "from-amber-500 to-amber-600",
  purple: "from-purple-500 to-purple-600",
  rose: "from-rose-500 to-rose-600",
  teal: "from-teal-500 to-teal-600",
  green: "from-green-500 to-green-600",
  violet: "from-violet-500 to-violet-600",
  lime: "from-lime-500 to-lime-600",
  orange: "from-orange-500 to-orange-600",
  cyan: "from-cyan-500 to-cyan-600",
  emerald: "from-emerald-500 to-emerald-600",
};

function AdminCard({ href, icon: Icon, title, description, color, index }) {
  const gradient = COLOR_MAP[color] || "from-gray-500 to-gray-600";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35 }}
    >
      <Link href={href} className="block h-full group group/card">
        <div className="h-full relative overflow-hidden rounded-2xl bg-white border border-gray-200/90 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 flex flex-col p-5 group-hover/card:-translate-y-1 group-hover/card:border-[#00448a]/30">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00448a] to-[#f56c53] opacity-0 group-hover/card:opacity-100 transition-opacity rounded-l-2xl" />
          <div className={`mb-4 w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shadow-black/5 group-hover/card:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1.5 group-hover/card:text-[#00448a] transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-500 flex-1 line-clamp-2 leading-relaxed">{description}</p>
          <span className="inline-flex items-center text-xs font-semibold text-[#00448a] mt-4 gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
            Open module
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function StudentRoleMigrationPanel() {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      setStatusError("");
      const res = await makeAuthenticatedRequest("/api/admin/migrate-student-roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load migration status");
      setStatus(data);
    } catch (e) {
      setStatusError(e.message || "Could not load migration status");
      console.error(e);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  async function runMigration(dryRun) {
    if (
      !dryRun &&
      !confirm(
        "Apply role migration for this batch (up to 500 student + 500 internship docs)? Run again until legacy counts are 0."
      )
    ) {
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      const res = await makeAuthenticatedRequest("/api/admin/migrate-student-roles", {
        method: "POST",
        body: JSON.stringify({
          dryRun,
          collegeSubdomain: "vawe",
          limit: 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Migration failed");
      setLastResult(data);
      await loadStatus();
    } catch (e) {
      alert(e.message || "Migration request failed. Sign in as admin/superadmin.");
    } finally {
      setBusy(false);
    }
  }

  const pendingStudent =
    status?.pendingLegacyRoles?.student ?? (status?.countsUnavailable ? "?" : "—");
  const pendingInternship =
    status?.pendingLegacyRoles?.internship ?? (status?.countsUnavailable ? "?" : "—");

  return (
    <div className="mb-10 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 mb-2">
        Student role migration
      </h2>
      <p className="text-sm text-amber-950/80 mb-4">
        Converts legacy <code className="text-xs bg-white/60 px-1 rounded">student</code> →{" "}
        <strong>{status?.targetRoles?.student || "vaweStudent"}</strong> and{" "}
        <code className="text-xs bg-white/60 px-1 rounded">internship</code> →{" "}
        <strong>{status?.targetRoles?.internship || "vaweInternship"}</strong>.
        Pending: {pendingStudent} student, {pendingInternship} internship.
      </p>
      {(statusError || status?.countsUnavailable) && (
        <p className="text-sm text-amber-800 mb-3">
          {statusError ||
            "Counts temporarily unavailable (network). Use Refresh or run a dry run to see batch results."}
        </p>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => runMigration(true)}
          className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          Dry run
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => runMigration(false)}
          className="px-4 py-2 rounded-xl bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
        >
          {busy ? "Running…" : "Apply batch"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={loadStatus}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-amber-900 hover:bg-amber-100/80"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </motion.div>
      {lastResult && (
        <pre className="mt-4 text-xs overflow-auto max-h-48 p-3 rounded-xl bg-white/70 border border-amber-200 text-slate-800">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const access = useAdminAccess();
  const user = access.user;
  const loading = access.loading;
  const [search, setSearch] = useState("");
  const [crtCourses, setCrtCourses] = useState([]);
  const [loadingCrtCourses, setLoadingCrtCourses] = useState(false);

  useEffect(() => {
    async function loadCrtCourses() {
      if (!access.hasCrtManagerAccess) {
        setCrtCourses([]);
        return;
      }
      try {
        setLoadingCrtCourses(true);
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "crtCourses")
        );
        const courses = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        courses.sort((a, b) =>
          String(a.title || "").localeCompare(String(b.title || ""))
        );
        setCrtCourses(courses);
      } catch (error) {
        console.error("Failed to load CRT courses:", error);
        setCrtCourses([]);
      } finally {
        setLoadingCrtCourses(false);
      }
    }

    loadCrtCourses();
  }, [access.hasCrtManagerAccess]);

  const filteredModules = useMemo(() => {
    const canSee = (m) => {
      if (access.isFullAdmin) return true;
      if (access.isDataEntry) return m.adminOnly ? false : true;
      if (access.isCollegeAdmin) {
        // Respect module toggles from superadmin for college domains.
        if (!access.moduleLms && m.href !== "/Admin/crt" && m.href !== "/Admin/whatsapp") return false;
        if (!access.moduleCrt && m.href === "/Admin/crt") return false;
        // Hide internship management for college-domain admins.
        if (m.href === "/Admin/internships") return false;
        return true;
      }
      return false;
    };
    let list = MODULES.filter(canSee);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    }
    return list;
  }, [access, search]);

  const bySection = useMemo(() => {
    const map = {};
    filteredModules.forEach((m) => {
      if (!map[m.section]) map[m.section] = [];
      map[m.section].push(m);
    });
    return map;
  }, [filteredModules]);

  const filteredCrtCourses = useMemo(() => {
    if (!search.trim()) return crtCourses;
    const q = search.trim().toLowerCase();
    return crtCourses.filter((course) => {
      const title = String(course.title || "").toLowerCase();
      const code = String(course.courseCode || "").toLowerCase();
      const desc = String(course.description || "").toLowerCase();
      return title.includes(q) || code.includes(q) || desc.includes(q);
    });
  }, [crtCourses, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const canUseDashboard =
    access.isFullAdmin || access.isDataEntry || access.isCollegeAdmin;
  const canMigrateRoles =
    access.role === "admin" || access.role === "superadmin";

  if (!user || !canUseDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-8">Sign in with an admin, college admin, or data entry account.</p>
          <button onClick={() => router.push("/")} className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] font-medium">
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#00448a] focus:ring-2 focus:ring-[#00448a]/20 outline-none transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2 ml-3">
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-[#00448a]/10 text-[#00448a] text-xs font-semibold">
            {access.isFullAdmin ? "Admin" : access.isCollegeAdmin ? "College admin" : "Data entry"}
          </span>
          {access.isFullAdmin && (
            <Link
              href="/Admin/register-form"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Register Form</span>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 rounded-2xl bg-gradient-to-r from-[#00448a] via-[#00448a] to-[#f56c53] p-6 sm:p-8 text-white shadow-xl shadow-[#00448a]/20"
        >
          <div className="flex items-center gap-2 text-white/90 text-sm mb-1">
            <Sparkles className="w-4 h-4" />
            All modules
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">{user?.email?.split("@")[0] || "Admin"}</h2>
          <p className="text-white/80 text-sm mt-1">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </motion.div>

        {canMigrateRoles && <StudentRoleMigrationPanel />}

        {filteredModules.length === 0 && (
          <div className="text-center py-16 rounded-2xl bg-white border border-slate-200">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No modules match &quot;{search}&quot;</p>
            <button onClick={() => setSearch("")} className="mt-4 text-sm font-medium text-[#00448a] hover:underline">Clear search</button>
          </div>
        )}

        {Object.entries(bySection).map(([sectionKey, items], sectionIndex) => (
          <motion.section
            key={sectionKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + sectionIndex * 0.05 }}
            className="mb-10"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              {SECTION_LABELS[sectionKey]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {items.map((m, i) => (
                <AdminCard
                  key={m.href}
                  href={m.href}
                  icon={m.icon}
                  title={m.title}
                  description={m.description}
                  color={m.color}
                  index={i}
                />
              ))}
            </div>
          </motion.section>
        ))}

        {access.hasCrtManagerAccess && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-10"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              CRT Course Management
            </h2>

            {loadingCrtCourses ? ( 
              <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-slate-500">
                Loading CRT courses...
              </div>
            ) : filteredCrtCourses.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-slate-500">
                No CRT courses found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredCrtCourses.map((course, i) => (
                  <AdminCard
                    key={course.id}
                    href={`/Admin/crt/courses/${course.id}`}
                    icon={BookOpen}
                    title={course.title || "Untitled CRT Course"}
                    description={
                      course.courseCode
                        ? `Course Code: ${course.courseCode}`
                        : "Open course management page"
                    }
                    color="orange"
                    index={i}
                  />
                ))}
              </div>
            )}
          </motion.section>
        )}
      </main>
    </div>
  );
}

