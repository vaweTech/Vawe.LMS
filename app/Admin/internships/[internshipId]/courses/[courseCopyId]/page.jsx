"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db, firestoreHelpers } from "../../../../../../lib/firebase";
import { signOut } from "firebase/auth";
import { useAdminAccess } from "../../../../AdminAccessContext";

export default function EditInternshipCourse() {
  const router = useRouter();
  const params = useParams();
  const internshipId = params?.internshipId;
  const courseCopyId = params?.courseCopyId;

  const access = useAdminAccess();
  const user = access.user;
  const loading = access.loading;
  const isAdmin =
    access.isFullAdmin || access.isCollegeAdmin;

  const [course, setCourse] = useState(null);
  const [savingCourse, setSavingCourse] = useState(false);

  const [chapters, setChapters] = useState([]);
  const [chapterSavingId, setChapterSavingId] = useState("");
  const [newChapter, setNewChapter] = useState({
    title: "",
    topics: "",
    video: "",
    pdfDocument: "",
    classDocs: "",
    order: 1,
  });

  useEffect(() => {
    if (!internshipId || !courseCopyId) return;
    fetchCourse();
    fetchChapters();
  }, [internshipId, courseCopyId, fetchCourse, fetchChapters]);

  const fetchCourse = useCallback(async function fetchCourse() {
    const ref = firestoreHelpers.doc(
      db,
      "internships",
      internshipId,
      "courses",
      courseCopyId
    );
    const snap = await firestoreHelpers.getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setCourse({
        id: snap.id,
        title: data.title || "",
        description: data.description || "",
        courseCode: data.courseCode || "",
        syllabus: Array.isArray(data.syllabus) ? data.syllabus : [],
        sourceCourseId: data.sourceCourseId || "",
      });
    }
  }, [internshipId, courseCopyId]);

  const fetchChapters = useCallback(async function fetchChapters() {
    const snap = await firestoreHelpers.getDocs(
      firestoreHelpers.collection(
        db,
        "internships",
        internshipId,
        "courses",
        courseCopyId,
        "chapters"
      )
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // sort by order if present
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    setChapters(list);
  }, [internshipId, courseCopyId]);

  async function saveCourse(e) {
    e.preventDefault();
    if (!course) return;
    try {
      setSavingCourse(true);
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(
          db,
          "internships",
          internshipId,
          "courses",
          courseCopyId
        ),
        {
          title: course.title,
          description: course.description,
          courseCode: course.courseCode,
          syllabus:
            typeof course.syllabus === "string"
              ? course.syllabus.split(",").map((s) => s.trim()).filter(Boolean)
              : course.syllabus || [],
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid || null,
        }
      );
      alert("Course saved.");
    } finally {
      setSavingCourse(false);
    }
  }

  async function addChapter(e) {
    e.preventDefault();
    try {
      setChapterSavingId("new");
      await firestoreHelpers.addDoc(
        firestoreHelpers.collection(
          db,
          "internships",
          internshipId,
          "courses",
          courseCopyId,
          "chapters"
        ),
        {
          title: newChapter.title || "",
          topics: newChapter.topics || "",
          video: newChapter.video || "",
          pdfDocument: newChapter.pdfDocument || "",
          classDocs: newChapter.classDocs || "",
          order: Number(newChapter.order) || 1,
          createdAt: new Date().toISOString(),
        }
      );
      setNewChapter({ title: "", topics: "", video: "", pdfDocument: "", classDocs: "", order: 1 });
      await fetchChapters();
    } finally {
      setChapterSavingId("");
    }
  }

  async function updateChapter(ch) {
    try {
      setChapterSavingId(ch.id);
      await firestoreHelpers.updateDoc(
        firestoreHelpers.doc(
          db,
          "internships",
          internshipId,
          "courses",
          courseCopyId,
          "chapters",
          ch.id
        ),
        {
          title: ch.title || "",
          topics: ch.topics || "",
          video: ch.video || "",
          pdfDocument: ch.pdfDocument || "",
          classDocs: ch.classDocs || "",
          order: Number(ch.order) || 1,
          updatedAt: new Date().toISOString(),
        }
      );
      await fetchChapters();
    } finally {
      setChapterSavingId("");
    }
  }

  async function deleteChapter(id) {
    if (!confirm("Delete this chapter?")) return;
    await firestoreHelpers.deleteDoc(
      firestoreHelpers.doc(
        db,
        "internships",
        internshipId,
        "courses",
        courseCopyId,
        "chapters",
        id
      )
    );
    await fetchChapters();
  }

  function logout() {
    signOut(auth);
  }

  if (loading) return <div>Loading...</div>;
  if (!user || !isAdmin) return <div>Access Denied</div>;
  if (!course) return <div className="p-6">Course not found.</div>;

  const syllabusText = Array.isArray(course.syllabus)
    ? course.syllabus.join(", ")
    : course.syllabus || "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Internship Course</h1>
          <p className="text-sm text-slate-600">
            Editing a copy. Master course remains unchanged.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/Admin/internships`}
            className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200"
          >
            Back
          </Link>
          <button
            onClick={logout}
            className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      <form onSubmit={saveCourse} className="rounded-xl border p-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-600">Title</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={course.title}
              onChange={(e) =>
                setCourse((s) => ({ ...s, title: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Course Code</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={course.courseCode}
              onChange={(e) =>
                setCourse((s) => ({ ...s, courseCode: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Description</label>
            <textarea
              rows={3}
              className="w-full border rounded-md px-3 py-2"
              value={course.description}
              onChange={(e) =>
                setCourse((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">
              Syllabus (comma-separated)
            </label>
            <input
              className="w-full border rounded-md px-3 py-2"
              value={syllabusText}
              onChange={(e) =>
                setCourse((s) => ({ ...s, syllabus: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            disabled={savingCourse}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            {savingCourse ? "Saving..." : "Save Course"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border p-4 bg-white">
        <div className="mb-4">
          <h2 className="font-semibold">Chapters</h2>
          <p className="text-sm text-slate-600">
            Edit chapters for this internship-specific copy.
          </p>
        </div>
        <div className="space-y-4">
          {chapters.map((ch) => (
            <div key={ch.id} className="border rounded-md p-3">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input
                  className="border rounded-md px-3 py-2"
                  value={ch.title || ""}
                  onChange={(e) =>
                    setChapters((cs) =>
                      cs.map((x) =>
                        x.id === ch.id ? { ...x, title: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Title"
                />
                <input
                  className="border rounded-md px-3 py-2"
                  value={ch.topics || ""}
                  onChange={(e) =>
                    setChapters((cs) =>
                      cs.map((x) =>
                        x.id === ch.id ? { ...x, topics: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Topics"
                />
                <input
                  className="border rounded-md px-3 py-2"
                  value={ch.video || ""}
                  onChange={(e) =>
                    setChapters((cs) =>
                      cs.map((x) =>
                        x.id === ch.id ? { ...x, video: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Video URL"
                />
                <input
                  className="border rounded-md px-3 py-2"
                  value={ch.pdfDocument || ""}
                  onChange={(e) =>
                    setChapters((cs) =>
                      cs.map((x) =>
                        x.id === ch.id ? { ...x, pdfDocument: e.target.value } : x
                      )
                    )
                  }
                  placeholder="PDF URL"
                />
                <input
                  className="border rounded-md px-3 py-2"
                  value={ch.classDocs || ""}
                  onChange={(e) =>
                    setChapters((cs) =>
                      cs.map((x) =>
                        x.id === ch.id ? { ...x, classDocs: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Docs URL"
                />
                <input
                  type="number"
                  className="border rounded-md px-3 py-2"
                  value={ch.order || 1}
                  onChange={(e) =>
                    setChapters((cs) =>
                      cs.map((x) =>
                        x.id === ch.id
                          ? { ...x, order: Number(e.target.value) }
                          : x
                      )
                    )
                  }
                  placeholder="Order"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={chapterSavingId === ch.id}
                  onClick={() => updateChapter(ch)}
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
                >
                  {chapterSavingId === ch.id ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => deleteChapter(ch.id)}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm"
                >
                  Delete
                </button>
                {ch.pdfDocument && (
                  <a
                    href={ch.pdfDocument}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-md bg-slate-100 text-sm"
                  >
                    View PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addChapter} className="mt-6 border-t pt-4 space-y-3">
          <h3 className="font-medium">Add Chapter</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              className="border rounded-md px-3 py-2"
              value={newChapter.title}
              onChange={(e) =>
                setNewChapter((s) => ({ ...s, title: e.target.value }))
              }
              placeholder="Title"
            />
            <input
              className="border rounded-md px-3 py-2"
              value={newChapter.topics}
              onChange={(e) =>
                setNewChapter((s) => ({ ...s, topics: e.target.value }))
              }
              placeholder="Topics"
            />
            <input
              className="border rounded-md px-3 py-2"
              value={newChapter.video}
              onChange={(e) =>
                setNewChapter((s) => ({ ...s, video: e.target.value }))
              }
              placeholder="Video URL"
            />
            <input
              className="border rounded-md px-3 py-2"
              value={newChapter.pdfDocument}
              onChange={(e) =>
                setNewChapter((s) => ({ ...s, pdfDocument: e.target.value }))
              }
              placeholder="PDF URL"
            />
            <input
              className="border rounded-md px-3 py-2"
              value={newChapter.classDocs}
              onChange={(e) =>
                setNewChapter((s) => ({ ...s, classDocs: e.target.value }))
              }
              placeholder="Docs URL"
            />
            <input
              type="number"
              className="border rounded-md px-3 py-2"
              value={newChapter.order}
              onChange={(e) =>
                setNewChapter((s) => ({
                  ...s,
                  order: Number(e.target.value),
                }))
              }
              placeholder="Order"
            />
          </div>
          <div>
            <button
              disabled={chapterSavingId === "new"}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50"
            >
              {chapterSavingId === "new" ? "Adding..." : "Add Chapter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

