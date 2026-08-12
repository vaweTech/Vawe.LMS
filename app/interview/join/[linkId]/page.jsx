"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, firestoreHelpers } from "@/lib/firebase";
import { pickBalancedPaperForLink } from "@/lib/interviewLinkAssignment";

export default function InterviewExamJoinPage() {
  const { linkId } = useParams();
  const router = useRouter();
  const didRun = useRef(false);
  const [message, setMessage] = useState("Preparing your exam…");
  const [error, setError] = useState("");

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    async function run() {
      const token = String(linkId || "").trim();
      if (!token) {
        setError("Invalid exam link.");
        return;
      }

      try {
        const linkRef = firestoreHelpers.doc(db, "interviewExamLinks", token);
        const linkSnap = await firestoreHelpers.getDoc(linkRef);
        if (!linkSnap.exists()) {
          setError("This exam link is invalid or has been removed.");
          return;
        }

        const linkData = linkSnap.data();
        if (linkData?.active === false) {
          setError("This exam link is no longer active.");
          return;
        }

        const assignment = await pickBalancedPaperForLink(token);
        if (!assignment?.examId) {
          setError("The exams for this link have no questions yet.");
          return;
        }

        const linkLabel = String(linkData?.label || assignment.linkLabel || "").trim();
        if (typeof window !== "undefined" && linkLabel) {
          sessionStorage.setItem(`interview-link-label:${token}`, linkLabel);
        }

        const assignedExamId = assignment.examId;
        const assignedTitle = assignment.examTitle;

        setMessage(`Opening exam…${assignedTitle ? ` (${assignedTitle})` : ""}`);

        const qs = new URLSearchParams({ linkToken: token });
        router.replace(`/interview/${assignedExamId}?${qs.toString()}`);
      } catch (e) {
        console.error(e);
        setError("Something went wrong. Please try again or contact your administrator.");
      }
    }

    run();
  }, [linkId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
        {error ? (
          <>
            <p className="text-lg font-semibold text-red-800">Unable to open exam</p>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-gray-900">Interview exam</p>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <div className="mt-6 h-8 w-8 mx-auto border-2 border-[#00448a] border-t-transparent rounded-full animate-spin" />
          </>
        )}
      </div>
    </div>
  );
}
