"use client";

import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { watchSingleSession } from "@/lib/singleSession";

export default function CheckTrainerAuth({ children }) {
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
        const role = snap.exists() ? snap.data().role : undefined;
        setAllowed(role === "trainer" || role === "crtTrainer" || role === "admin" || role === "superadmin");
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

