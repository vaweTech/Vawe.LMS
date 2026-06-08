"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import {
  LayoutDashboard,
  LogOut,
  ArrowLeft,
  PanelLeftClose,
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
} from "lucide-react";
import { AdminAccessProvider, useAdminAccess } from "./AdminAccessContext";

const SIDEBAR_LINKS = [
  { href: "/Admin/dashboard", icon: LayoutDashboard, label: "All modules" },
  { href: "/Admin/mcqs", icon: ClipboardList, label: "Manage MCQs" },
  { href: "/Admin/coding", icon: Code2, label: "Coding Questions" },
  { href: "/Admin/tutorials", icon: BookOpen, label: "Tutorials" },
  { href: "/Admin/assignments", icon: FileCheck, label: "Progress Tests" },
  { href: "/Admin/userManager", icon: UserCog, label: "Manage Users" },
  { href: "/Admin/StudentInfo", icon: GraduationCap, label: "Student Info" },
  { href: "/Admin/trainers", icon: Users, label: "Trainers" },
  { href: "/Admin/programs", icon: Layers, label: "Programs" },
  { href: "/Admin/internships", icon: Briefcase, label: "Internships" },
  { href: "/Admin/crt", icon: Cpu, label: "Manage CRT" },
  { href: "/Admin/interview", icon: FileQuestion, label: "JSET" },
  { href: "/Admin/whatsapp", icon: MessageCircle, label: "WhatsApp" },
];

const AUTO_CLOSE_MS = 1000;

function AdminLayoutInner({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const access = useAdminAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (access.loading) return;
    if (!access.user) {
      router.replace("/auth/login");
      return;
    }
    const { isFullAdmin, isDataEntry, isCollegeAdmin } = access;
    if (isFullAdmin) return;
    if (isDataEntry) return;
    if (isCollegeAdmin) {
      return;
    }
    router.replace("/not-authorized");
  }, [access, pathname, router]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCloseTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setSidebarOpen(false);
      timerRef.current = null;
    }, AUTO_CLOSE_MS);
  }, [clearTimer]);

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true);
    startCloseTimer();
  }, [startCloseTimer]);

  const handleSidebarMouseEnter = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleSidebarMouseLeave = useCallback(() => {
    startCloseTimer();
  }, [startCloseTimer]);

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };

  const roleChecked = !access.loading;
  const showAdminNav =
    roleChecked && !access.isDataEntry && (access.isFullAdmin || access.isCollegeAdmin);

  const visibleLinks = SIDEBAR_LINKS.filter((link) => {
    if (!access.isCollegeAdmin) return true;
    if (link.href === "/Admin/crt" && !access.moduleCrt) return false;
    if (
      link.href !== "/Admin/crt" &&
      link.href !== "/Admin/whatsapp" &&
      !access.moduleLms
    ) {
      return false;
    }
    if (link.href === "/Admin/internships") return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {showAdminNav && !sidebarOpen && (
        <button
          type="button"
          onMouseEnter={handleOpenSidebar}
          onClick={handleOpenSidebar}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 w-10 h-14 rounded-r-xl bg-slate-800 text-white shadow-lg border border-slate-700 border-l-0 flex items-center justify-center hover:bg-slate-700 hover:w-11 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00448a] focus:ring-offset-2"
          aria-label="Open menu"
        >
          <PanelLeftClose className="w-5 h-5 rotate-180" />
        </button>
      )}

      {showAdminNav && (
        <aside
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          className={`fixed left-0 top-0 bottom-0 z-40 w-64 bg-slate-900 text-white border-r border-slate-700/50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00448a] to-[#f56c53] flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm">Admin</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-3">
            {visibleLinks.map(({ href, icon: Icon, label }) => {
              const isActive =
                pathname === href ||
                (href !== "/Admin/dashboard" && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm transition-colors ${
                    isActive
                      ? "bg-[#00448a] text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-700/50 space-y-1">
            <button
              type="button"
              onClick={() => {
                router.push("/dashboard");
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Main Dashboard
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>
      )}

      <div className={`min-h-screen ${showAdminNav ? "pl-12 sm:pl-14" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AdminAccessProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAccessProvider>
  );
}
