import { NextResponse } from "next/server";
import { adminDb, getFirestoreProjectId, getFirestoreRestAccessToken } from "@/lib/firebaseAdmin";
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from "zod";

const deleteOneSchema = z.object({
  action: z.literal("one"),
  examId: z.string().min(1),
  submissionId: z.string().min(1),
});

const deleteAllSchema = z.object({
  action: z.literal("all"),
  examIds: z.array(z.string().min(1)).min(1),
});

const deleteInterviewResultsSchema = z.discriminatedUnion("action", [
  deleteOneSchema,
  deleteAllSchema,
]);

async function restDeleteDocument(relativePath) {
  const projectId = getFirestoreProjectId();
  const token = await getFirestoreRestAccessToken();
  if (!projectId || !token) {
    throw new Error(
      "Service account credentials are required. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT."
    );
  }
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${relativePath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function deleteDocWithFallback(docRef, restPath) {
  try {
    await docRef.delete();
  } catch (err) {
    await restDeleteDocument(restPath);
  }
}

async function deleteSubmissionsForExam(examId) {
  const submissionsRef = adminDb
    .collection("interviewExams")
    .doc(examId)
    .collection("submissions");
  const snap = await submissionsRef.get();
  if (snap.empty) return 0;

  const docs = snap.docs;
  let deleted = 0;
  const batchSize = 400;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    try {
      const batch = adminDb.batch();
      chunk.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    } catch {
      await Promise.all(
        chunk.map((docSnap) =>
          deleteDocWithFallback(
            docSnap.ref,
            `interviewExams/${encodeURIComponent(examId)}/submissions/${encodeURIComponent(docSnap.id)}`
          )
        )
      );
    }
    deleted += chunk.length;
  }

  return deleted;
}

async function deleteInterviewResultsHandler(request) {
  const body = request.validatedBody;

  if (body.action === "one") {
    const { examId, submissionId } = body;
    const docRef = adminDb
      .collection("interviewExams")
      .doc(examId)
      .collection("submissions")
      .doc(submissionId);

    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    await deleteDocWithFallback(
      docRef,
      `interviewExams/${encodeURIComponent(examId)}/submissions/${encodeURIComponent(submissionId)}`
    );

    return NextResponse.json({
      success: true,
      deletedCount: 1,
      deletedBy: request.user?.email || null,
    });
  }

  let deletedCount = 0;
  for (const examId of body.examIds) {
    deletedCount += await deleteSubmissionsForExam(examId);
  }

  return NextResponse.json({
    success: true,
    deletedCount,
    deletedBy: request.user?.email || null,
  });
}

export async function POST(request) {
  try {
    return await withAdminAuth(request, (req1) =>
      withRateLimit(30, 15 * 60 * 1000)(req1, (req2) =>
        validateInput(deleteInterviewResultsSchema)(req2, deleteInterviewResultsHandler)
      )
    );
  } catch (error) {
    console.error("delete-interview-results route error:", error);
    const errorMessage = String(error?.message || "Failed to delete interview results");
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
