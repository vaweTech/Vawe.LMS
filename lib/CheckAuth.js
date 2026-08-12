"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";
import { watchSingleSession } from "@/lib/singleSession";

export default function CheckAuth({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let stopSessionWatch = () => {};
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/auth/login"); // redirect if not logged in
      } else {
        stopSessionWatch = watchSingleSession(user, () => {
          router.push("/auth/login?reason=session-expired");
        });
        setIsLoading(false);
      }
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

