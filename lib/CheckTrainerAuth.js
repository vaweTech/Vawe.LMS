"use client";

import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
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
        const data = snap.exists() ? snap.data() : {};
        const role = data.role;
        const locked =
          data.locked === true || data.status === "hold" || data.status === "locked";
        if (locked && (role === "trainer" || role === "crtTrainer")) {
          await signOut(auth);
          router.push("/auth/login");
          return;
        }
        setAllowed(role === "trainer" || role === "crtTrainer" || role === "admin" || role === "superadmin");
        setLoading(false);
      } catch (e) {
        console.error("Error checking trainer access:", e);
        setAllowed(false);
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

