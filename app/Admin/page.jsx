"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, firestoreHelpers } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export default function AdminRootPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDataEntry, setIsDataEntry] = useState(false);
  const [isCollegeAdmin, setIsCollegeAdmin] = useState(false);
  const [moduleLms, setModuleLms] = useState(true);
  const [moduleCrt, setModuleCrt] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = firestoreHelpers.doc(db, "users", u.uid);
        const snap = await firestoreHelpers.getDoc(ref);
        const userRole = snap.exists()
          ? (snap.data().role || snap.data().Role)
          : null;
        const admin = userRole === "admin" || userRole === "superadmin";
        const dataEntry = userRole === "dataentry";
        const collegeAdmin = userRole === "collegeAdmin";
        const userData = snap.exists() ? snap.data() : {};
        const lmsEnabled = collegeAdmin ? !!userData.moduleLms : true;
        const crtEnabled = collegeAdmin ? !!userData.moduleCrt : true;
        setIsAdmin(admin);
        setIsDataEntry(dataEntry);
        setIsCollegeAdmin(collegeAdmin);
        setModuleLms(lmsEnabled);
        setModuleCrt(crtEnabled);
        if (admin || dataEntry) {
          router.replace("/Admin/dashboard");
        } else if (collegeAdmin && lmsEnabled) {
          router.replace("/Admin/dashboard");
        } else if (collegeAdmin && !lmsEnabled && crtEnabled) {
          router.replace("/Admin/crt");
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Opening Admin Dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (
    !user ||
    (!isAdmin && !isDataEntry && !isCollegeAdmin) ||
    (isCollegeAdmin && !moduleLms && !moduleCrt)
  ) {
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
          <p className="text-slate-600 mb-8">
            You don&apos;t have permission to view this page. Sign in with an admin or data entry account.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium shadow-lg shadow-[#00448a]/20"
          >
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Redirecting to Admin Dashboard...</p>
      </div>
    </div>
  );
}
