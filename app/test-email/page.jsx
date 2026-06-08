"use client";

import { useState } from "react";

export default function TestEmailPage() {
  const [configResult, setConfigResult] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [loading, setLoading] = useState({ config: false, verify: false, send: false });
  const [testTo, setTestTo] = useState("");

  async function checkConfig() {
    setConfigResult(null);
    setLoading((p) => ({ ...p, config: true }));
    try {
      const res = await fetch("/api/test-email");
      const data = await res.json();
      setConfigResult({ status: res.status, data });
    } catch (e) {
      setConfigResult({ status: 0, data: { error: e.message } });
    } finally {
      setLoading((p) => ({ ...p, config: false }));
    }
  }

  async function verifyConnection() {
    setVerifyResult(null);
    setLoading((p) => ({ ...p, verify: true }));
    try {
      const res = await fetch("/api/test-email?verify=1");
      const data = await res.json();
      setVerifyResult({ status: res.status, data });
    } catch (e) {
      setVerifyResult({ status: 0, data: { error: e.message } });
    } finally {
      setLoading((p) => ({ ...p, verify: false }));
    }
  }

  async function sendTestEmail(e) {
    e.preventDefault();
    if (!testTo.trim()) return;
    setSendResult(null);
    setLoading((p) => ({ ...p, send: true }));
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const data = await res.json();
      setSendResult({ status: res.status, data });
    } catch (e) {
      setSendResult({ status: 0, data: { error: e.message } });
    } finally {
      setLoading((p) => ({ ...p, send: false }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2 text-[var(--brand-text)]">Nodemailer / SMTP Test</h1>
      <p className="text-[var(--brand-text-secondary)] mb-6">
        Use this page to check SMTP config and send a test email. Configure <code className="bg-[var(--brand-border)] px-1 rounded">.env.local</code> with{" "}
        <code className="bg-[var(--brand-border)] px-1 rounded">SMTP_HOST</code>, <code className="bg-[var(--brand-border)] px-1 rounded">SMTP_USER</code>,{" "}
        <code className="bg-[var(--brand-border)] px-1 rounded">SMTP_PASS</code>.
      </p>

      <div className="space-y-6">
        <section className="border border-[var(--brand-border)] rounded-lg p-4 bg-[var(--brand-bg)]">
          <h2 className="font-semibold mb-2 text-[var(--brand-text)]">1. Check config</h2>
          <p className="text-sm text-[var(--brand-text-secondary)] mb-3">See if SMTP env vars are set (values are masked).</p>
          <button
            type="button"
            onClick={checkConfig}
            disabled={loading.config}
            className="px-4 py-2 rounded bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading.config ? "Checking…" : "Check config"}
          </button>
          {configResult && (
            <pre className="mt-3 p-3 bg-[var(--brand-border)] rounded text-sm overflow-auto max-h-48">
              {JSON.stringify(configResult.data, null, 2)}
            </pre>
          )}
        </section>

        <section className="border border-[var(--brand-border)] rounded-lg p-4 bg-[var(--brand-bg)]">
          <h2 className="font-semibold mb-2 text-[var(--brand-text)]">2. Verify connection</h2>
          <p className="text-sm text-[var(--brand-text-secondary)] mb-3">Test connection to the SMTP server.</p>
          <button
            type="button"
            onClick={verifyConnection}
            disabled={loading.verify}
            className="px-4 py-2 rounded bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading.verify ? "Verifying…" : "Verify connection"}
          </button>
          {verifyResult && (
            <pre className="mt-3 p-3 bg-[var(--brand-border)] rounded text-sm overflow-auto max-h-48">
              {JSON.stringify(verifyResult.data, null, 2)}
            </pre>
          )}
        </section>

        <section className="border border-[var(--brand-border)] rounded-lg p-4 bg-[var(--brand-bg)]">
          <h2 className="font-semibold mb-2 text-[var(--brand-text)]">3. Send test email</h2>
          <p className="text-sm text-[var(--brand-text-secondary)] mb-3">Send a test message to an address you can check.</p>
          <form onSubmit={sendTestEmail} className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[200px]">
              <span className="block text-sm mb-1 text-[var(--brand-text)]">To</span>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-[var(--brand-border)] rounded px-3 py-2 text-[var(--brand-text)] bg-[var(--brand-bg)]"
              />
            </label>
            <button
              type="submit"
              disabled={loading.send || !testTo.trim()}
              className="px-4 py-2 rounded bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading.send ? "Sending…" : "Send test email"}
            </button>
          </form>
          {sendResult && (
            <pre className="mt-3 p-3 bg-[var(--brand-border)] rounded text-sm overflow-auto max-h-48">
              {JSON.stringify(sendResult.data, null, 2)}
            </pre>
          )}
        </section>
      </div>

      <p className="mt-6 text-sm text-[var(--brand-text-secondary)]">
        For Gmail: use an App Password, not your normal password. Enable 2FA and create an App Password in Google Account → Security.
      </p>
    </div>
  );
}
