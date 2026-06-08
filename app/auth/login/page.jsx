"use client";
import AuthForm from "../../../components/AuthForm";
import { firebaseAuth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { registerSingleSessionWithConfirm } from "../../../lib/singleSession";
import { Suspense, useMemo } from "react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const infoMessage = useMemo(() => {
    const reason = searchParams?.get("reason");
    if (reason === "session-expired") {
      return "You were logged out because this account was used on another device.";
    }
    return "";
  }, [searchParams]);

  async function handleLogin(email, password) {
    try {
      const cred = await firebaseAuth.login(email, password);
      await registerSingleSessionWithConfirm(cred?.user?.uid);
      if (db && cred?.user?.uid) {
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        const role = snap.exists() ? snap.data().role : null;
        if (role === "collegeAdmin") {
          router.push("/Admin/dashboard");
          return;
        }
      }
      router.push("/dashboard");
    } catch (err) {
      alert(err.message || "Login failed");
    }
  }

  // No OTP state in email-only page

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 text-center">Login</h1>

      {infoMessage && (
        <div className="mx-auto mb-4 max-w-lg rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {infoMessage}
        </div>
      )}

      {/* Email/password only */}
      <AuthForm
        onSubmit={handleLogin}
        submitLabel="Sign in"
      />
      
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6">Loading...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
