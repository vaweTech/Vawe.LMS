"use client";

import AuthForm from "../../components/AuthForm";
import LoginCardShell, { LoginCardLoading } from "../../components/LoginCardShell";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { registerSingleSessionWithConfirm } from "../../lib/singleSession";

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
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await registerSingleSessionWithConfirm(cred?.user?.uid);
      router.push("/Admin/crt/po-management");
    } catch (err) {
      setError(err?.message || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginCardShell
      sessionExpired={sessionExpired}
      error={error}
      subtitle="Admin login with your registered email and password."
      footerText="Manage placement officers, CRT programs, and institute administration from one secure portal."
    >
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
