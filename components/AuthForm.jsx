"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

export default function AuthForm({
  onSubmit,
  submitLabel = "Sign in",
  loading = false,
  showMethodTab = false,
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00448a] focus:ring-2 focus:ring-[#00448a]/15 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (loading) return;
        onSubmit(String(identifier || "").trim(), password);
      }}
      className="space-y-4"
      autoComplete="on"
    >
      {showMethodTab && (
        <div className="mb-1">
          <span className="inline-block rounded-md bg-[#00448a] px-3 py-1 text-xs font-semibold text-white">
            Email / Password
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="auth-email" className="text-sm font-medium text-slate-600">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            name="email"
            className={inputClass}
            placeholder="you@institute.edu"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value.replace(/\s+/g, ""))}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="auth-password" className="text-sm font-medium text-slate-600">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="auth-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            name="current-password"
            className={`${inputClass} pr-10`}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-[#00448a] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#00448a]/20 transition hover:bg-[#003a76] focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in...
            </>
          ) : (
            submitLabel
          )}
        </span>
      </button>
    </form>
  );
}
