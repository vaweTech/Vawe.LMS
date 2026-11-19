"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { requestWhatsAppOtp, verifyWhatsAppOtp } from "@/lib/whatsappOtpClient";
import {
  MOCK_PUBLIC_MODE_SEQUENTIAL,
  clearMockPublicSession,
  fetchMockPublicLink,
  getMockPublicLinkMode,
  normalizeMockPublicPhone,
  readMockPublicSession,
  resolveMockPublicAssignment,
  writeMockPublicSession,
} from "@/lib/mockTestPublicLinks";

const emptyForm = {
  name: "",
  college: "",
  branch: "",
  phone: "",
};

export default function MockTestPublicJoinPage() {
  const { linkId } = useParams();
  const router = useRouter();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpPhoneSent, setOtpPhoneSent] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [starting, setStarting] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  const mode = useMemo(() => getMockPublicLinkMode(link), [link]);
  const testCount = Array.isArray(link?.testIds) ? link.testIds.length : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchMockPublicLink(String(linkId || ""));
        if (cancelled) return;
        if (!data) {
          setError("This public test link is invalid or has been removed.");
          setLink(null);
          return;
        }
        if (data.active === false) {
          setError("This public test link is no longer active.");
          setLink(null);
          return;
        }
        setLink(data);

        const existing = readMockPublicSession(String(linkId || ""));
        if (existing?.phoneVerified && existing?.phone) {
          setForm({
            name: existing.name || "",
            college: existing.college || "",
            branch: existing.branch || "",
            phone: existing.phone || "",
          });
          setPhoneVerified(true);
          setOtpSent(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Could not load this test link. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkId]);

  async function handleSendOtp() {
    setOtpError("");
    const phone = normalizeMockPublicPhone(form.phone);
    if (phone.length < 10) {
      setOtpError("Enter a valid 10-digit mobile number.");
      return;
    }
    setOtpSending(true);
    try {
      const res = await requestWhatsAppOtp(phone);
      if (!res.ok) {
        setOtpError(res.error || "Failed to send WhatsApp OTP. Try again.");
        return;
      }
      setOtpSent(true);
      setOtpPhoneSent(phone);
      setPhoneVerified(false);
      setOtpValue("");
    } catch (e) {
      setOtpError(e?.message || "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError("");
    const phone = otpPhoneSent || normalizeMockPublicPhone(form.phone);
    const code = String(otpValue || "").trim();
    if (code.length < 4) {
      setOtpError("Enter the OTP sent on WhatsApp.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await verifyWhatsAppOtp(phone, code);
      if (!res.ok) {
        const reason = res.reason || res.error || "OTP verification failed.";
        setOtpError(
          reason === "expired"
            ? "OTP expired. Request a new code."
            : reason === "mismatch"
              ? "Incorrect OTP. Try again."
              : String(reason)
        );
        return;
      }
      setPhoneVerified(true);
      setForm((p) => ({ ...p, phone }));
    } catch (e) {
      setOtpError(e?.message || "OTP verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleStart() {
    setError("");
    setDoneMessage("");
    if (!form.name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!form.college.trim()) {
      setError("Enter your college name.");
      return;
    }
    if (!form.branch.trim()) {
      setError("Enter your branch.");
      return;
    }
    if (!phoneVerified) {
      setError("Verify your mobile number with WhatsApp OTP first.");
      return;
    }
    if (!acceptedRules) {
      setError("Please accept the test rules to continue.");
      return;
    }

    setStarting(true);
    try {
      const phone = normalizeMockPublicPhone(form.phone);
      const assignment = await resolveMockPublicAssignment({
        linkId: String(linkId),
        phone,
      });
      if (!assignment) {
        setError("Could not assign a test for this link. Contact the administrator.");
        return;
      }
      if (assignment.allDone) {
        clearMockPublicSession(String(linkId));
        setDoneMessage(
          `You have already completed all ${assignment.totalSteps || ""} test(s) for this link. Thank you!`
        );
        return;
      }

      writeMockPublicSession(String(linkId), {
        name: form.name.trim(),
        college: form.college.trim(),
        branch: form.branch.trim(),
        phone,
        phoneVerified: true,
        companySlug: assignment.companySlug,
        testId: assignment.testId,
        testTitle: assignment.testTitle,
        mode: assignment.mode,
        step: assignment.step,
        totalSteps: assignment.totalSteps,
        linkLabel: assignment.linkLabel,
      });

      router.push(
        `/mock-test/${encodeURIComponent(assignment.companySlug)}/${encodeURIComponent(assignment.testId)}?public=1&link=${encodeURIComponent(String(linkId))}`
      );
    } catch (e) {
      console.error(e);
      setError(e?.message || "Could not start the test. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-cyan-50 flex items-center justify-center p-6">
        <div className="h-10 w-10 border-2 border-[#00448a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-cyan-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white shadow-sm p-8 text-center">
          <p className="text-lg font-semibold text-red-800">Unable to open test</p>
          <p className="mt-2 text-sm text-gray-600">{error || "Invalid link."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-cyan-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#00448a] px-5 sm:px-8 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Public mock test
            </p>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">
              {link.label || "Mock Test"}
            </h1>
            <p className="text-sm text-white/80 mt-2">
              {testCount === 1
                ? "Direct test link — complete the registration form to begin."
                : mode === MOCK_PUBLIC_MODE_SEQUENTIAL
                  ? `${testCount} tests · take them one by one in order`
                  : `${testCount} tests · you will get one random question paper`}
            </p>
          </div>

          <div className="px-5 sm:px-8 py-6 space-y-5">
            {doneMessage ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {doneMessage}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-3">Your details</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">College</label>
                  <input
                    value={form.college}
                    onChange={(e) => setForm((p) => ({ ...p, college: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                    placeholder="College name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                  <input
                    value={form.branch}
                    onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a] outline-none"
                    placeholder="e.g. CSE"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Mobile number (WhatsApp verification)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => {
                        setForm((p) => ({
                          ...p,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        }));
                        setPhoneVerified(false);
                      }}
                      disabled={phoneVerified}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-slate-50 outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="10-digit mobile"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={
                        phoneVerified ||
                        otpSending ||
                        normalizeMockPublicPhone(form.phone).length < 10
                      }
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                    >
                      {otpSending
                        ? "Sending…"
                        : otpSent && !phoneVerified
                          ? "Resend OTP"
                          : "Send WhatsApp OTP"}
                    </button>
                  </div>
                  {otpError ? (
                    <p className="mt-2 text-xs text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                      {otpError}
                    </p>
                  ) : null}
                  {otpSent && !phoneVerified ? (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-amber-800">
                          Enter OTP
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otpValue}
                          onChange={(e) =>
                            setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          maxLength={6}
                          placeholder="6-digit code"
                          className="w-full border border-amber-200 rounded-lg px-3 py-2 text-center tracking-widest text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otpValue.length < 4}
                        className="px-4 py-2 rounded-lg bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60"
                      >
                        {otpVerifying ? "Verifying…" : "Verify OTP"}
                      </button>
                    </div>
                  ) : null}
                  {phoneVerified ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      Mobile number verified via WhatsApp
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <h3 className="font-semibold text-slate-900 mb-2 text-sm">Rules</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                <li>No LMS login is required — complete this form to start.</li>
                <li>Do not switch tabs; repeated switches may block the attempt.</li>
                <li>Submit before time ends. Answers cannot be changed after submit.</li>
                {mode === MOCK_PUBLIC_MODE_SEQUENTIAL && testCount > 1 ? (
                  <li>You will take {testCount} tests one by one in the set order.</li>
                ) : null}
                {mode === "random" && testCount > 1 ? (
                  <li>You will receive one random question paper from the selected tests.</li>
                ) : null}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={acceptedRules}
                  onChange={(e) => setAcceptedRules(e.target.checked)}
                  className="w-4 h-4 text-[#00448a]"
                />
                I have read and agree to the rules above.
              </label>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={starting || !!doneMessage}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-semibold disabled:opacity-60 shadow-sm"
            >
              {starting ? "Starting…" : "Start test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
