"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "../AdminAccessContext";

export default function CrtLayout({ children }) {
  const router = useRouter();
  const access = useAdminAccess();

  useEffect(() => {
    if (access.loading) return;
    if (!access.user) {
      router.replace("/auth/login");
      return;
    }
    if (!access.hasCrtManagerAccess) {
      // If LMS is enabled, send user to admin dashboard; otherwise deny CRT access.
      if (access.isCollegeAdmin && access.moduleLms) {
        router.replace("/Admin/dashboard");
        return;
      }
      router.replace("/not-authorized");
    }
  }, [access, router]);

  if (access.loading || !access.user || !access.hasCrtManagerAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Checking CRT access...</p>
        </div>
      </div>
    );
  }

  return children;
}
