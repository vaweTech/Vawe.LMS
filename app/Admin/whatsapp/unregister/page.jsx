"use client";

import { useCallback, useState } from "react";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { useRouter } from "next/navigation";
import { makeAuthenticatedRequest } from "@/lib/authUtils";
import ExcelJS from "exceljs";

const TEMPLATE_NAME = "custom_message";

// Sanitize for WhatsApp template (avoid error 132018)
function sanitizeParam(val, maxLen = 1024) {
  if (val == null) return "";
  let s = String(val).trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// Normalize column name for matching
function norm(col) {
  return String(col || "").trim().toLowerCase().replace(/\s+/g, "");
}

// Find column index by possible headers (first row)
function findColumnIndex(headers, ...possibleNames) {
  for (const name of possibleNames) {
    const i = headers.findIndex((h) => norm(h) === norm(name));
    if (i >= 0) return i;
  }
  return -1;
}

// Parse Excel file: expect first row = headers, then data. Required: name, mobile.
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(e.target.result);
        const sheet = workbook.worksheets[0];
        const rows = [];
        if (sheet) {
          sheet.eachRow({ includeEmpty: true }, (row) => {
            rows.push(
              row.values
                .slice(1)
                .map((v) => (v == null ? "" : String(v)))
            );
          });
        }
        if (rows.length < 2) {
          resolve({ headers: [], rows: [] });
          return;
        }
        const headers = rows[0].map((h) => String(h ?? "").trim());
        const nameIdx = findColumnIndex(headers, "name", "names", "student name", "student", "full name");
        const mobileIdx = findColumnIndex(headers, "mobile", "phone", "number", "contact", "whatsapp", "mobile number", "phone number", "mobilenumber", "phonenumber", "contact number");
        const emailIdx = findColumnIndex(headers, "email", "email id", "e-mail", "emailid");

        const out = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() : "";
          const mobile = mobileIdx >= 0 ? String(row[mobileIdx] ?? "").trim() : "";
          const email = emailIdx >= 0 ? String(row[emailIdx] ?? "").trim() : "";
          out.push({ name, mobile, email, _rowIndex: i + 1 });
        }
        resolve({ headers: { nameIdx, mobileIdx, emailIdx }, rows: out });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export default function WhatsAppUnregisterPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [parseError, setParseError] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [language, setLanguage] = useState("en");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const onFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    setFile(f);
    setParsed([]);
    setParseError("");
    if (!f) return;
    const ext = (f.name || "").toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      setParseError("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    parseExcelFile(f)
      .then(({ rows }) => {
        setParsed(rows);
        if (rows.length === 0) setParseError("No data rows found in the sheet.");
      })
      .catch((err) => {
        setParseError(err?.message || "Failed to parse Excel");
      });
  }, []);

  const eligible = parsed.filter((r) => r.name && r.mobile);
  const invalid = parsed.filter((r) => !r.name || !r.mobile);

  async function handleSend() {
    if (eligible.length === 0) {
      alert("No valid rows (name and mobile are required).");
      return;
    }
    if (!messageBody.trim()) {
      alert("Please enter the message body for {{2}}.");
      return;
    }

    setSending(true);
    setSentCount(0);
    let successes = 0;
    const errors = [];

    const bodyText = sanitizeParam(messageBody, 1000);
    if (!bodyText) {
      alert("Message body is empty after sanitization.");
      setSending(false);
      return;
    }

    for (const row of eligible) {
      const nameText = sanitizeParam(row.name, 100);
      if (!nameText) continue;
      try {
        const res = await makeAuthenticatedRequest("/api/send-whatsapp-template", {
          method: "POST",
          body: JSON.stringify({
            phone: row.mobile,
            template: TEMPLATE_NAME,
            language,
            bodyParams: [nameText, bodyText],
          }),
        });
        if (res.ok) {
          successes += 1;
          setSentCount((c) => c + 1);
        } else {
          const data = await res.json().catch(() => ({}));
          errors.push({ name: row.name, mobile: row.mobile, error: data?.error || "Unknown error" });
        }
      } catch (e) {
        errors.push({ name: row.name, mobile: row.mobile, error: e?.message || "Request failed" });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const summary = [
      `Eligible: ${eligible.length}`,
      `Sent: ${successes}`,
      errors.length ? `Failed: ${errors.length}${errors[0] ? `\nExample: ${errors[0].error}` : ""}` : null,
    ].filter(Boolean).join("\n");
    alert(summary);
    if (errors.length) console.warn("Unregister send errors", errors);
    setSending(false);
  }

  return (
    <CheckAdminAuth>
      <div className="mx-auto max-w-4xl p-6 bg-white shadow-md rounded-lg">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push("/Admin/whatsapp")}
            className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
          >
            ⬅ Back to WhatsApp
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-emerald-700">Send to unregistered (Excel)</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload an Excel sheet with <strong>Name</strong> and <strong>Mobile</strong> columns (required). Email is optional. Messages are sent using the <strong>custom_message</strong> template.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel (.xlsx / .xls)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={onFileChange}
            className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
          {parsed.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              Loaded {parsed.length} row(s). Valid (name + mobile): {eligible.length}. Missing required: {invalid.length}.
            </p>
          )}
        </div>

        {parsed.length > 0 && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Template language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full max-w-xs border border-gray-300 rounded px-3 py-2"
              >
                <option value="en">en (English)</option>
                <option value="en_US">en_US</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Must match your template &quot;English&quot; – usually <strong>en</strong>.</p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Message body (template {`{{2}}`}) – required</label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Enter the message body that will replace {{2}} in the custom_message template."
                className="w-full border border-gray-300 rounded px-3 py-2 min-h-[120px]"
                rows={5}
              />
              <p className="text-xs text-gray-500 mt-1">
                Template format: &quot;Dear {`{{1}}`}, … {`{{2}}`} … Best regards, VAWE Institute.&quot; Line breaks are sent as spaces so the template is accepted.
              </p>
            </div>

            {/* custom_message template preview */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">custom_message template preview</h4>
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans bg-white p-3 rounded border border-gray-100">
                {`Dear ${eligible[0]?.name || "Student Name"},

${messageBody.trim() || "(Your message body will appear here)"}

Thank you for your cooperation.

Best regards,
VAWE Institute.`}
              </pre>
              {eligible.length > 1 && (
                <p className="text-xs text-gray-500 mt-2">
                  Preview uses first contact. All {eligible.length} recipients will get the same message with their name as {`{{1}}`}.
                </p>
              )}
            </div>

            <div className="mb-6 overflow-auto border rounded max-h-72">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">#</th>
                    <th className="border p-2 text-left">Name (required)</th>
                    <th className="border p-2 text-left">Mobile (required)</th>
                    <th className="border p-2 text-left">Email</th>
                    <th className="border p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => {
                    const valid = r.name && r.mobile;
                    return (
                      <tr key={i} className={valid ? "" : "bg-red-50"}>
                        <td className="border p-2">{r._rowIndex ?? i + 1}</td>
                        <td className="border p-2">{r.name || <span className="text-red-600">—</span>}</td>
                        <td className="border p-2">{r.mobile || <span className="text-red-600">—</span>}</td>
                        <td className="border p-2">{r.email || "—"}</td>
                        <td className="border p-2">{valid ? <span className="text-green-600">Valid</span> : <span className="text-red-600">Missing name/mobile</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleSend}
                disabled={sending || eligible.length === 0 || !messageBody.trim()}
                className={`px-4 py-2 rounded ${sending || eligible.length === 0 || !messageBody.trim() ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
              >
                {sending ? `Sending… (${sentCount}/${eligible.length})` : `Send to ${eligible.length} contact(s)`}
              </button>
              {eligible.length === 0 && parsed.length > 0 && (
                <span className="text-sm text-amber-600">Add name and mobile in the Excel and re-upload, or fix column headers (Name, Mobile).</span>
              )}
            </div>
          </>
        )}
      </div>
    </CheckAdminAuth>
  );
}