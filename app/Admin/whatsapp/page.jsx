"use client";

import { useEffect, useMemo, useState } from "react";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { makeAuthenticatedRequest } from "@/lib/authUtils";
import {
  isCrtStudentRole,
  isSkillwinsStudentRole,
  inferStudentRole,
  formatStudentRoleLabel,
  normalizeStudentsForAdmin,
} from "@/lib/studentRole";

export default function WhatsAppMessagingPage() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [templateName, setTemplateName] = useState("fee_update_notification");
  const [language, setLanguage] = useState("en_US");
  const [param1, setParam1] = useState("");
  const [param2, setParam2] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "students"));
      setStudents(
        normalizeStudentsForAdmin(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      );
      setLoading(false);
    })();
  }, []);

  // Auto-select correct default language per template
  useEffect(() => {
    if (templateName === "custom_message" && language !== "en") {
      setLanguage("en");
    }
    if (templateName !== "custom_message" && language === "en") {
      setLanguage("en_US");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  const classIdOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => s.classId && set.add(String(s.classId)));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const byClass = selectedClassId ? String(s.classId || "") === String(selectedClassId) : true;
      return byClass;
    });
  }, [students, selectedClassId]);

  function renderPreview(s, tmpl, p1In, p2In) {
    const name = p1In || s?.name || "Student";
    const totalFee = Number(s?.totalFee ?? 0);
    const paidFee = Number(s?.PayedFee ?? s?.payedFee ?? 0);
    const due = Math.max(totalFee - paidFee, 0);
    const value2 = p2In || `₹${due}`;

    if (tmpl === "fee_update_notification") {
      return `Hello ${name}, This is a reminder that your fee payment of ${value2} is due. Please make the payment by the due date to avoid any late charges. If you’ve already completed the payment, kindly ignore this message. Thank you for your prompt attention!`;
    }
    if (tmpl === "temporarily_blocked") {
      return `Dear ${name},\n\nYour account has been temporarily blocked due to a pending fee amount of ${value2}.\nPlease clear the outstanding payment at the earliest to restore full access.\n\nIf you have already made the payment, please Contact the Admin.\n\nThank you for your cooperation.\n\nBest regards,\nVAWE Institutes`;
    }
    if (tmpl === "custom_message") {
      return `Dear ${name},\n\n${p2In || ""}\n\nThank you for your cooperation.\n\nBest regards,\nVAWE Institute.`;
    }
    return `Template ${tmpl}: ${name}, ${value2}`;
  }

  async function handleSendBulk() {
    if (filtered.length === 0) {
      alert("No students match the selected filters");
      return;
    }
    if (!templateName) {
      alert("Enter template name");
      return;
    }

    setSending(true);
    setSentCount(0);

    try {
      // Build eligible list and track skips
      let successes = 0;
      const errors = [];
      let skippedNoPhone = 0;
      let skippedMissingParam = 0;

      const eligible = [];
      for (const s of filtered) {
        const phone = s.phone1 || s.phone;
        if (!phone) { skippedNoPhone++; continue; }

        // Build default params if empty for known templates
        let p1 = param1;
        let p2 = param2;
        const totalFee = Number(s.totalFee ?? 0);
        const paidFee = Number(s.PayedFee ?? s.payedFee ?? 0);
        const due = Math.max(totalFee - paidFee, 0);
        if (!p1 && templateName === "fee_update_notification") p1 = s.name || "Student";
        if (!p2 && templateName === "fee_update_notification") p2 = `₹${due}`;
        if (!p1 && templateName === "temporarily_blocked") p1 = s.name || "Student";
        if (!p2 && templateName === "temporarily_blocked") p2 = `₹${due}`;
        if (!p1 && templateName === "custom_message") p1 = s.name || "Student";
        if (templateName === "custom_message" && !p2) { skippedMissingParam++; continue; }

        eligible.push({ s, phone, p1, p2 });
      }

      // Send sequentially to avoid rate limits; simple and safe
      for (const { s, phone, p1, p2 } of eligible) {

        const res = await makeAuthenticatedRequest("/api/send-whatsapp-template", {
          method: "POST",
          body: JSON.stringify({
            phone,
            template: templateName,
            language,
            bodyParams: [p1, p2].filter(Boolean),
          }),
        });
        if (res.ok) {
          successes += 1;
          setSentCount((c) => c + 1);
          
          // If sending temporarily_blocked template, lock the student
          if (templateName === "temporarily_blocked") {
            try {
              const lockRes = await makeAuthenticatedRequest("/api/update-student-lock", {
                method: "POST",
                body: JSON.stringify({
                  id: s.id,
                  locked: true
                }),
              });
              if (lockRes.ok) {
                console.log(`Student ${s.name} locked successfully`);
              } else {
                console.warn(`Failed to lock student ${s.name}`);
              }
            } catch (lockErr) {
              console.error("Lock error for student:", s.name, lockErr);
              // Continue even if lock fails - message was sent
            }
          }
        } else {
          const data = await res.json().catch(() => ({}));
          errors.push({ id: s.id, name: s.name, phone, error: data?.error || "Unknown error" });
        }
        // tiny delay to be gentle on API
        await new Promise((r) => setTimeout(r, 150));
      }
      const firstErrorMsg = errors[0]?.error;
      const summary = [
        `Matched: ${filtered.length}`,
        `Eligible: ${eligible.length}`,
        `Sent: ${successes}`,
        skippedNoPhone ? `Skipped (no phone): ${skippedNoPhone}` : null,
        skippedMissingParam ? `Skipped (missing {{2}}): ${skippedMissingParam}` : null,
        errors.length ? `Failed: ${errors.length}${firstErrorMsg ? `\nExample error: ${firstErrorMsg}` : ""}` : null,
      ].filter(Boolean).join("\n");
      alert(summary);
      if (errors.length) console.warn("Bulk send errors", errors);
    } catch (e) {
      console.error("Bulk send error:", e);
      alert(e?.message || "Failed to send messages");
    } finally {
      setSending(false);
    }
  }

  return (
    <CheckAdminAuth>
      <div className="mx-auto p-6 bg-white shadow-md rounded-md">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
          >
            ⬅ Back
          </button>
          <button
            onClick={() => router.push("/Admin/whatsapp/unregister")}
            className="px-4 py-2 rounded bg-[#00448a] hover:bg-[#003a76] text-white"
          >
            Send to unregistered (Excel)
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-6 text-center text-emerald-700">WhatsApp Messaging</h2>

        {loading ? (
          <p className="text-center text-gray-600">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class/Group</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">All</option>
                  {classIdOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="fee_update_notification">fee_update_notification</option>
                  <option value="temporarily_blocked">temporarily_blocked</option>
                  <option value="custom_message">custom_message</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Select an approved WhatsApp template</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {/* <option value="en_US">en_US</option> */}
                  <option value="en">en</option>
                  <option value="hi">hi</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Use the approved template language code</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template {`{{1}}`}</label>
                <input
                  value={param1}
                  onChange={(e) => setParam1(e.target.value)}
                  placeholder="Defaults to Student Name if empty"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template {`{{2}}`}</label>
                {templateName === "custom_message" ? (
                  <textarea
                    value={param2}
                    onChange={(e) => setParam2(e.target.value)}
                    placeholder="Write your message body for {{2}}"
                    className="w-full border rounded px-3 py-2 min-h-[100px]"
                  />
                ) : (
                  <input
                    value={param2}
                    onChange={(e) => setParam2(e.target.value)}
                    placeholder="Defaults to ₹Due if empty"
                    className="w-full border rounded px-3 py-2"
                  />
                )}
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSendBulk}
                  disabled={sending}
                  className={`w-full px-4 py-2 rounded ${sending ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"} text-white`}
                >
                  {sending ? `Sending... (${sentCount})` : `Send to ${filtered.length} students`}
                </button>
              </div>
            </div>

            <div className="mb-6 p-4 border rounded bg-gray-50">
              <h4 className="font-semibold mb-2">Message preview</h4>
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{renderPreview(filtered[0], templateName, param1, param2)}</pre>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Preview ({filtered.length})</h3>
              <div className="max-h-72 overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Role</th>
                      <th className="border p-2 text-left">Phone</th>
                      <th className="border p-2 text-left">Class</th>
                      <th className="border p-2 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const totalFee = Number(s.totalFee ?? 0);
                      const paidFee = Number(s.PayedFee ?? s.payedFee ?? 0);
                      const due = Math.max(totalFee - paidFee, 0);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="border p-2">{s.name || '-'}</td>
                          <td className="border p-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isCrtStudentRole(inferStudentRole(s))
                                  ? "bg-blue-100 text-blue-700"
                                  : isSkillwinsStudentRole(inferStudentRole(s))
                                  ? "bg-violet-100 text-violet-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {isSkillwinsStudentRole(inferStudentRole(s))
                                ? inferStudentRole(s)
                                : formatStudentRoleLabel(inferStudentRole(s))}
                            </span>
                          </td>
                          <td className="border p-2">{s.phone1 || s.phone || '-'}</td>
                          <td className="border p-2">{s.classId || '-'}</td>
                          <td className="border p-2 text-right">₹{due}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </CheckAdminAuth>
  );
}


