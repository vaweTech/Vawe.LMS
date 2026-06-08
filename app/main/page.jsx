"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import CheckAuth from "../../lib/CheckAuth";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
 import { FiSmile } from "react-icons/fi";


export default function Hero() {
  const [userData, setUserData] = useState({
    name: "User",
    coursesCompleted: 0,
    achievements: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user role from users collection
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userRole = userSnap.exists() ? userSnap.data().role || "user" : "user";

        // Query students collection where uid == authenticated user uid
        const studentsRef = collection(db, "students");
        const q = query(studentsRef, where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        let name = user.email || "User";
        let coursesCompleted = 0;
        let achievements = 0;

        if (!querySnapshot.empty) {
          const studentData = querySnapshot.docs[0].data();
          name = studentData.name || user.email || "User";
          
          // Count completed courses (courses with progress = 100%)
          const coursesRef = collection(db, "students", user.uid, "courses");
          const coursesSnap = await getDocs(coursesRef);
          coursesCompleted = coursesSnap.docs.filter(doc => {
            const data = doc.data();
            return data.progress && data.progress >= 100;
          }).length;

          // Calculate achievements based on completed courses and other factors
          achievements = Math.max(
            coursesCompleted * 5, // 5 achievements per completed course
            studentData.achievements || 0 // fallback to stored achievements
          );
        }

        setUserData({
          name,
          coursesCompleted,
          achievements
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData({
          name: user.email || "User",
          coursesCompleted: 0,
          achievements: 0
        });
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <CheckAuth>
        <div className="min-h-screen bg-gradient-to-b from-[#fdc377]/30 via-[#26ebe5]/15 to-[#00448a]/10 flex items-center justify-center">
          <div className="text-lg font-medium text-slate-600">Loading...</div>
        </div>
      </CheckAuth>
    );
  }

  return (
    <CheckAuth>
    <motion.section
      className="relative text-center py-12 sm:py-16 lg:py-24 px-4 sm:px-6 bg-gradient-to-b from-[#fdc377]/30 via-[#26ebe5]/15 to-[#00448a]/10 overflow-hidden min-h-[80vh] flex flex-col justify-center"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,68,138,0.08)_0%,transparent_50%)]"></div>
      
      {/* Main content container */}
      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light mb-2 sm:mb-3 text-slate-800 tracking-tight">
            Welcome back,<FiSmile className="inline-block ml-2 text-black" />
          </h1>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold mb-4 sm:mb-6 text-[#00448a] tracking-tight">
            {userData.name}
          </h2>
        </motion.div>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-slate-600 mb-8 sm:mb-12 font-light leading-relaxed max-w-2xl mx-auto px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Continue your learning journey and unlock new possibilities
        </motion.p>

        {/* Call-to-action buttons */}
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Link href="/courses">
            <motion.button
              className="w-full sm:w-auto bg-[#00448a] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-medium shadow-lg shadow-[#00448a]/25 hover:bg-[#003a76] hover:shadow-[#00448a]/30 transition-all duration-300 transform hover:-translate-y-1 text-sm sm:text-base"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Explore Courses
            </motion.button>
          </Link>
          <Link href="/dashboard">
            <motion.button
              className="w-full sm:w-auto border-2 border-black text-slate-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-medium hover:border-[#26ebe5]/50 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-all duration-300 backdrop-blur-sm text-sm sm:text-base"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              View Dashboard
            </motion.button>
          </Link>
        </motion.div>

        {/* User Stats */}
        <motion.div
          className="flex flex-col sm:flex-row justify-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200 px-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <div className="text-center py-4 sm:py-0 sm:px-6 lg:px-12">
            <motion.p
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800 mb-1 sm:mb-2"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1, duration: 0.5, type: "spring", stiffness: 200 }}
            >
              {userData.coursesCompleted}
            </motion.p>
            <p className="text-slate-500 font-medium text-xs sm:text-sm uppercase tracking-wide">
              Completed Courses
            </p>
          </div>
          <div className="text-center py-4 sm:py-0 sm:px-6 lg:px-12">
            <motion.p
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800 mb-1 sm:mb-2"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.1, duration: 0.5, type: "spring", stiffness: 200 }}
            >
              {userData.achievements}
            </motion.p>
            <p className="text-slate-500 font-medium text-xs sm:text-sm uppercase tracking-wide">
              Achievements
            </p>
          </div>
        </motion.div>
      </div>

    </motion.section>
    </CheckAuth>
  );
}
