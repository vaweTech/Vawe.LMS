"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "./firebase"; // make sure db = getFirestore(app)
import { doc, getDoc } from "firebase/firestore";
import { watchSingleSession } from "@/lib/singleSession";

export default function CheckAdminAuth({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let stopSessionWatch = () => {};
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/auth/login"); // not logged in
        return;
      }

      stopSessionWatch = watchSingleSession(user, () => {
        router.push("/auth/login?reason=session-expired");
      });

      try {
        // get user doc from Firestore
        const userDocRef = doc(db, "users", user.uid); // assuming user.uid is your doc id
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role;

          if (role === "admin" || role === "superadmin") {
            setIsLoading(false);
          } else if (role === "collegeAdmin") {
            // collegeAdmin now has full Admin access.
            // Tenant scoping ensures they only affect their own college data.
            if (!pathname?.startsWith("/Admin")) router.push("/not-authorized");
            else setIsLoading(false);
          } else {
            router.push("/not-authorized"); // redirect non-admins
          }
        } else {
          router.push("/not-authorized"); // no user doc found
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        router.push("/error");
      }
    });

    return () => {
      stopSessionWatch();
      unsubscribe();
    };
  }, [router, pathname]);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return <>{children}</>;
}
