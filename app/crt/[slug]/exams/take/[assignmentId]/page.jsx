"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createCourseUrl } from "../../../../../../lib/urlUtils";
import CheckAuth from "../../../../../../lib/CheckAuth";

/**
 * CRT exam take slug page.
 * Redirects to the assignment/MCQ page with correct courseId so "Start test" opens the MCQ questions.
 */
export default function CRTExamTakePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const didRedirect = useRef(false);
  const slug = params?.slug;
  const assignmentId = params?.assignmentId;
  const courseId = searchParams.get("courseId");
  const courseTitle = searchParams.get("courseTitle") || "";

  useEffect(() => {
    if (didRedirect.current) return;
    if (!assignmentId || !courseId) {
      didRedirect.current = true;
      router.replace(slug ? `/crt/${slug}/exams` : "/crt");
      return;
    }
    didRedirect.current = true;
    const courseSlug = createCourseUrl(courseTitle) || courseId;
    const assignmentUrl = `/courses/${courseSlug}/assignments/${assignmentId}?courseId=${encodeURIComponent(courseId)}`;
    window.location.href = assignmentUrl;
  }, [slug, assignmentId, courseId, courseTitle, router]);

  return (
    <CheckAuth>
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <p className="text-slate-600">Opening test…</p>
      </div>
    </CheckAuth>
  );
}
