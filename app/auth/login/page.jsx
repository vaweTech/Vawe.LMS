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
      if (db && cred?.user?.uid) {
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        const userData = snap.exists() ? snap.data() : {};
        const role = userData.role || null;
        const locked =
          userData.locked === true ||
          userData.status === "hold" ||
          userData.status === "locked";
        if (locked && (role === "trainer" || role === "crtTrainer")) {
          await firebaseAuth.logout();
          setError("This account is locked. Contact your administrator.");
          return;
        }
        await registerSingleSessionWithConfirm(cred?.user?.uid);
        if (role === "collegeAdmin") {
          router.push("/Admin/dashboard");
          return;
        }
      } else {
        await registerSingleSessionWithConfirm(cred?.user?.uid);
      }
      router.push("/dashboard");
    } catch (err) {
      if (err?.code === "auth/user-disabled") {
        setError("This account is locked. Contact your administrator.");
      } else {
        setError(err.message || "Login failed. Check your email and password.");
      }
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
