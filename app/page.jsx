"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth as emailAuth, firebaseAuth as emailFirebaseAuth } from "../lib/firebase";
import AuthForm from "../components/AuthForm";
import LoginCardShell, { LoginCardLoading } from "../components/LoginCardShell";

function loginErrorMessage(err) {
  if (err?.code === "auth/user-not-found") return "You don't have institute credentials.";
  if (err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
    return "Incorrect email or password.";
  }
  if (err?.code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  return err?.message || "Login failed";
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // If already logged in, redirect to /main
  useEffect(() => {
    const unsub = emailFirebaseAuth.onAuthStateChanged(emailAuth, (user) => {
      if (user) {
        router.replace("/main");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => {
      unsub();
    };
  }, [router]);

  const handleEmailLogin = async (email, password) => {
    setError("");
    setLoading(true);
    try {
      await emailFirebaseAuth.login(email, password);
      router.push("/main");
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) return <LoginCardLoading />;

  return (
    <>
      <LoginCardShell error={error}>
        <AuthForm onSubmit={handleEmailLogin} submitLabel="Sign in" loading={loading} showMethodTab />
      </LoginCardShell>

      {/* Additional SEO Content for Search Engines */}
      <div className="hidden">
        <h1>VAWE Institutes - Best Software Training Institute in Vijayawada</h1>
        <h2>Software Training Institutes in Vijayawada</h2>
        <h3>Programming Courses in Vijayawada</h3>
        <p>VAWE Institutes is the best software training institute in Vijayawada, offering comprehensive programming courses and advanced LMS solutions. We provide training in Python, Java, Web Development, React, and other modern technologies with placement assistance.</p>
        <p>Our software training and placement institute in Vijayawada has helped hundreds of students secure jobs in top IT companies. Join the leading software coaching center in Vijayawada today.</p>
        <ul>
          <li>Python Programming Course</li>
          <li>Java Programming Training</li>
          <li>Full Stack Web Development</li>
          <li>React Development Course</li>
          <li>Advanced LMS Platform</li>
          <li>Placement Assistance</li>
        </ul>
      </div>
    </>
  );
}
