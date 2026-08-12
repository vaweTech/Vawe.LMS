"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, firestoreHelpers } from "../../lib/firebase";

export default function InterviewExamsListPage() {
  const router = useRouter();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      try {
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "interviewExams")
        );
        setExams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-cyan-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Interview Exams</h1>
        {exams.length === 0 ? (
          <p className="text-gray-700">No exams available.</p>
        ) : (
          <div className="grid gap-4">
            {exams.map((ex) => (
              <div key={ex.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{ex.title}</p>
                  {ex.companyName && (
                    <p className="text-sm font-medium text-[#00448a]">{ex.companyName}</p>
                  )}
                  <p className="text-sm text-gray-600">{ex.questions?.length || 0} questions • {ex.durationMinutes} min</p>
                </div>
                <button
                  onClick={() => router.push(`/interview/${ex.id}`)}
                  className="px-4 py-2 rounded bg-[#00448a] hover:bg-[#003a76] text-white"
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


