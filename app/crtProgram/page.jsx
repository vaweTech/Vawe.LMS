"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import CRTProgramView from "../../components/CRTProgramView";

export default function CRTProgramPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentDocId, setStudentDocId] = useState(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    resume: "",
    education10: "",
    education12: "",
    educationDegree: "",
    educationPg: "",
    experience: "",
    educationEntries: [],
  });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editProfile, setEditProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    resume: "",
    education10: "",
    education12: "",
    educationDegree: "",
    educationPg: "",
    experience: "",
    education10College: "",
    education10Course: "",
    education10Marks: "",
    education12College: "",
    education12Course: "",
    education12Marks: "",
    educationDegreeCollege: "",
    educationDegreeCourse: "",
    educationDegreeMarks: "",
    educationPgCollege: "",
    educationPgCourse: "",
    educationPgMarks: "",
    educationEntries: [],
    educationType: "",
    educationCollege: "",
    educationCourse: "",
    educationMarks: "",
  });
  const [profileError, setProfileError] = useState("");
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [activeEducationLevel, setActiveEducationLevel] = useState("10"); // legacy, no longer used
  const [recentClassModal, setRecentClassModal] = useState(null); // 'record' | 'pdf' | 'ppt' | 'assignment' | 'feedback' | 'trainer-pdf'
  const [upcomingClassModal, setUpcomingClassModal] = useState(null); // 'live' | 'pdf' | 'ppt'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setProfile((prev) => ({
          ...prev,
          name:
            prev.name ||
            u.displayName ||
            u.email?.split("@")[0] ||
            "Student",
          email: prev.email || u.email || "",
        }));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, "students"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        if (cancelled) return;
        if (!snap.empty) setStudentDocId(snap.docs[0].id);
        else setStudentDocId(null);
      } catch (_) {
        if (!cancelled) setStudentDocId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdc377]/30 via-[#26ebe5]/20 to-[#00448a]/10">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#00448a]/20" />
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  const displayName =
    profile.name ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Student";
  const email = profile.email || user.email || "";

  return (
    <CRTProgramView
      user={user}
      profile={profile}
      setProfile={setProfile}
      showBackToDashboard={true}
      studentDocId={studentDocId}
    />
  );
}
