"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { watchSingleSession } from "@/lib/singleSession";

export default function CheckAuth({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let stopSessionWatch = () => {};
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/auth/login"); // redirect if not logged in
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const isTrainer = data.role === "trainer" || data.role === "crtTrainer";
          const locked =
            data.locked === true || data.status === "hold" || data.status === "locked";
          if (isTrainer && locked) {
            await signOut(auth);
            router.push("/auth/login");
            return;
          }
        }
      } catch (e) {
        console.error("Error checking account lock:", e);
      }
      stopSessionWatch = watchSingleSession(user, () => {
        router.push("/auth/login?reason=session-expired");
      });
      setIsLoading(false);
    });

    return () => {
      stopSessionWatch();
      unsubscribe();
    };
  }, [router]);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return <>{children}</>;
}

