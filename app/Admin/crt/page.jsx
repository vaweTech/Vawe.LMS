"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Cpu, Layers, FileCheck, ChartBar, ArrowLeft, Users, UserCog, UserCheck, Briefcase } from "lucide-react";
import { useAdminAccess } from "../AdminAccessContext";

export default function CRTDashboardPage() {
  const router = useRouter();
  const { user, loading, hasCrtManagerAccess: isAdmin } = useAdminAccess();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading CRT...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-8">Admin access required.</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const modules = [
    {
      href: "/Admin/crt/PlacementsPage",
      icon: Briefcase,
      title: "Dashboard",
      description: "View and manage placements for CRT programs.",
      color: "from-sky-500 to-indigo-600",
    },
    {
      href: "/Admin/crt/crt",
      icon: Layers,
      title: "CRT Management",
      description: "Create CRTs, courses, batches, assign students, and manage programs.",
      color: "from-emerald-500 to-teal-600",
    },
    {
      href: "/Admin/crt/crtTestSubmission",
      icon: FileCheck,
      title: "Test Submissions",
      description: "View and manage student test submissions grouped by batch.",
      color: "from-cyan-500 to-blue-600",
    },
    {
      href: "/Admin/crt/crtTestSubmission/analytics",
      icon: ChartBar,
      title: "Test Analytics",
      description: "Student-wise exam attendance, average scores, and performance analytics.",
      color: "from-violet-500 to-purple-600",
    },
    {
      href: "/Admin/crt/student-user-management",
      icon: Users,
      title: "Student Management",
      description: "View and manage CRT students only.",
      color: "from-amber-500 to-orange-600",
    },
    {
      href: "/Admin/crt/trainer-management",
      icon: UserCog,
      title: "CRT Trainers",
      description: "View CRT trainers and create new trainer accounts.",
      color: "from-blue-500 to-indigo-600",
    },
    {
      href: "/Admin/crt/po-management",
      icon: Layers,
      title: "CRT PO Management",
      description: "Manage CRT-related purchase orders and tracking.",
      color: "from-rose-500 to-pink-600",
    },
    {
      href: "/Admin/crt/active-incharge",
      icon: UserCheck,
      title: "Active Incharge",
      description: "View and manage active incharge users for CRT programs.",
      color: "from-sky-500 to-indigo-600",
    },
  ];

  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00448a] to-cyan-600 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              CRT Admin
            </h1>
            <p className="text-slate-600 mt-1">
              Manage CRT programs, test submissions, and analytics.
            </p>
          </div>
          <Link
            href="/Admin/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 grid-cols-1">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="h-full"
            >
              <Link
                href={mod.href}
                className="block h-full p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-xl hover:border-slate-300 transition-all duration-200 group"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <mod.icon className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {mod.title}
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {mod.description}
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[#00448a] group-hover:underline">
                  Open →
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
