"use client";

import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { watchSingleSession } from "@/lib/singleSession";
import { canonicalAdminRole } from "@/lib/collegeAdminAccess";

export default function CheckDataEntryAuth({ children }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopSessionWatch = () => {};
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/auth/login");
        return;
      }
      stopSessionWatch = watchSingleSession(u, () => {
        router.push("/auth/login?reason=session-expired");
      });
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const d = snap.exists() ? snap.data() : {};
        const role = canonicalAdminRole(d);
        setAllowed(
          role === "dataentry" ||
            role === "admin" ||
            role === "superadmin" ||
            role === "collegeAdmin"
        );
      } finally {
        setLoading(false);
      }
    });
    return () => {
      stopSessionWatch();
      unsub();
    };
  }, [router]);

  if (loading) return <div className="p-6 text-center">Checking access…</div>;
  if (!allowed) return <div className="p-6 text-center">Access denied.</div>;
  return children;
}


