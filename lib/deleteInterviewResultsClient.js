import {
  getDeleteStudentFallbackReason,
  shouldUseClientDeleteFallback,
} from "@/lib/deleteStudentClient";

async function deleteSubmissionClient({ firestore, examId, submissionId }) {
  const submissionRef = firestore.doc(
    firestore.db,
    "interviewExams",
    examId,
    "submissions",
    submissionId
  );
  await firestore.deleteDoc(submissionRef);
}

async function deleteAllSubmissionsClient({ firestore, examIds }) {
  let deletedCount = 0;
  for (const examId of examIds) {
    const subCol = firestore.collection(
      firestore.db,
      "interviewExams",
      examId,
      "submissions"
    );
    const snap = await firestore.getDocs(subCol);
    await Promise.all(
      snap.docs.map((d) =>
        firestore.deleteDoc(
          firestore.doc(
            firestore.db,
            "interviewExams",
            examId,
            "submissions",
            d.id
          )
        )
      )
    );
    deletedCount += snap.docs.length;
  }
  return deletedCount;
}

async function callDeleteApi(makeAuthenticatedRequest, payload) {
  const res = await makeAuthenticatedRequest("/api/admin/delete-interview-results", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (res.status >= 200 && res.status < 300) {
    const data = await res.json().catch(() => ({}));
    return { ok: true, deletedCount: data.deletedCount ?? null };
  }

  let errorMessage = `Failed to delete result (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error) errorMessage = data.error;
  } catch {
    // ignore
  }
  throw new Error(errorMessage);
}

/**
 * Delete one interview submission via Admin API (Vercel) with localhost Firestore fallback.
 */
export async function executeDeleteInterviewResult({
  firestore,
  examId,
  submissionId,
  makeAuthenticatedRequest,
  onRefresh,
}) {
  const runClientDelete = async () => {
    await deleteSubmissionClient({ firestore, examId, submissionId });
    await onRefresh?.();
  };

  try {
    const result = await callDeleteApi(makeAuthenticatedRequest, {
      action: "one",
      examId,
      submissionId,
    });
    await onRefresh?.();
    return { success: true, mode: "api", deletedCount: result.deletedCount ?? 1 };
  } catch (error) {
    const message = String(error?.message || "");
    if (!shouldUseClientDeleteFallback(message)) {
      throw error;
    }

    const reason = getDeleteStudentFallbackReason(message);
    const proceed = confirm(
      `Server delete failed (${reason}).\n\nDelete this result directly from Firestore in the browser instead?`
    );
    if (!proceed) {
      return { success: false, cancelled: true };
    }

    await runClientDelete();
    return { success: true, mode: "client-fallback", deletedCount: 1 };
  }
}

/**
 * Delete all interview submissions for the given exams via Admin API (Vercel).
 */
export async function executeDeleteAllInterviewResults({
  firestore,
  examIds,
  makeAuthenticatedRequest,
  onRefresh,
}) {
  const runClientDelete = async () => {
    const deletedCount = await deleteAllSubmissionsClient({ firestore, examIds });
    await onRefresh?.();
    return deletedCount;
  };

  try {
    const result = await callDeleteApi(makeAuthenticatedRequest, {
      action: "all",
      examIds,
    });
    await onRefresh?.();
    return {
      success: true,
      mode: "api",
      deletedCount: result.deletedCount ?? 0,
    };
  } catch (error) {
    const message = String(error?.message || "");
    if (!shouldUseClientDeleteFallback(message)) {
      throw error;
    }

    const reason = getDeleteStudentFallbackReason(message);
    const proceed = confirm(
      `Server delete failed (${reason}).\n\nDelete results directly from Firestore in the browser instead?`
    );
    if (!proceed) {
      return { success: false, cancelled: true };
    }

    const deletedCount = await runClientDelete();
    return { success: true, mode: "client-fallback", deletedCount };
  }
}
