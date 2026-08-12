"use client";

import AuthForm from "../../../components/AuthForm";
import LoginCardShell, { LoginCardLoading } from "../../../components/LoginCardShell";
import { firebaseAuth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { registerSingleSessionWithConfirm } from "../../../lib/singleSession";
import { Suspense, useMemo, useState } from "react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sessionExpired = useMemo(
    () => searchParams?.get("reason") === "session-expired",
    [searchParams]
  );

  async function handleLogin(email, password) {
    setError("");
    setLoading(true);
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
      setError(err.message || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginCardShell sessionExpired={sessionExpired} error={error}>
      <AuthForm onSubmit={handleLogin} submitLabel="Sign in" loading={loading} showMethodTab />
    </LoginCardShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginCardLoading />}>
      <LoginPageInner />
    </Suspense>
  );
}
