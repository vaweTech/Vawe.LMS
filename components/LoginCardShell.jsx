"use client";

import Image from "next/image";
import { AlertCircle, MonitorSmartphone } from "lucide-react";

const featureTags = [
  { label: "Interactive Learning", className: "bg-orange-100 text-orange-800" },
  { label: "Expert Guidance", className: "bg-cyan-100 text-cyan-800" },
  { label: "Career Support", className: "bg-rose-100 text-rose-800" },
  { label: "Modern Platform", className: "bg-slate-200 text-slate-700" },
];

export function LoginCardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/70 to-slate-100 px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00448a] border-t-transparent" />
    </div>
  );
}

export default function LoginCardShell({
  children,
  sessionExpired = false,
  error = "",
  title = "Welcome to VAWE Institutes",
  subtitle = "Login with your institute credentials",
  footerTitle = "Welcome to VAWE Institutes",
  footerText = "Your gateway to professional programming education. Learn, practice, and excel in software development.",
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/70 to-slate-100 px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_-12px_rgba(0,68,138,0.18)] ring-1 ring-slate-200/60">
        <div className="flex flex-col md:flex-row">
          <div className="flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-white p-8 md:w-[42%] md:p-10 lg:p-12">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-[min(280px,70vw)] w-[min(280px,70vw)] rounded-full bg-gradient-to-br from-slate-300/40 to-slate-100/80 shadow-inner" />
              <div className="relative rounded-full bg-gradient-to-br from-slate-200 to-white p-2 shadow-lg ring-4 ring-white/90">
                <div className="overflow-hidden rounded-full bg-white">
                  <Image
                    src="/LmsImg.jpg"
                    alt="VAWE LMS"
                    width={260}
                    height={260}
                    className="h-[min(240px,62vw)] w-[min(240px,62vw)] object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 md:w-[58%] lg:px-12">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#00448a] bg-white shadow-sm">
              <div className="h-5 w-5 rounded-full bg-[#00448a]/15 ring-2 ring-[#00448a]/30" />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold text-[#00448a] sm:text-2xl">{title}</h1>
              <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
            </div>

            {sessionExpired && (
              <div
                role="alert"
                className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-left"
              >
                <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0 text-sm text-amber-900">
                  <p className="font-semibold">Session ended on this device</p>
                  <p className="mt-0.5 leading-relaxed text-amber-800/90">
                    This account was signed in elsewhere. Sign in again to continue here.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6">{children}</div>

            <div className="my-6 border-t border-slate-200" />

            <div className="text-center">
              <h2 className="text-sm font-bold text-[#00448a]">{footerTitle}</h2>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">{footerText}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {featureTags.map((tag) => (
                  <span
                    key={tag.label}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${tag.className}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
