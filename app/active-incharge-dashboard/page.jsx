// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { onAuthStateChanged } from "firebase/auth";
// import { auth, db, firestoreHelpers, isFirebaseConfigured } from "../../lib/firebase";
// import {
//   ArrowLeft,
//   RefreshCw,
//   UserCheck,
//   Download,
//   Layers,
//   Clock,
//   AlertTriangle,
//   Sparkles,
// } from "lucide-react";

// function toMillis(value) {
//   if (!value) return 0;
//   if (typeof value === "number") return value;
//   if (typeof value === "string") {
//     const t = new Date(value).getTime();
//     return Number.isFinite(t) ? t : 0;
//   }
//   if (typeof value === "object") {
//     const seconds = typeof value.seconds === "number" ? value.seconds : 0;
//     const nanos =
//       typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
//     return seconds * 1000 + nanos / 1e6;
//   }
//   return 0;
// }

// function Pie({
//   aLabel,
//   aValue,
//   aColor,
//   bLabel,
//   bValue,
//   bColor,
//   size = 112,
// }) {
//   const total = Math.max(1, aValue + bValue);
//   const aPct = (aValue / total) * 100;
//   // conic-gradient uses percentages as stops
//   const bg = `conic-gradient(${aColor} 0% ${aPct}%, ${bColor} ${aPct}% 100%)`;

//   return (
//     <div className="flex items-center gap-6">
//       <div
//         className="relative"
//         style={{ width: size, height: size }}
//       >
//         <div
//           className="rounded-full"
//           style={{
//             width: size,
//             height: size,
//             background: bg,
//           }}
//         />
//         <div
//           className="absolute inset-3 rounded-full bg-white border border-slate-200"
//           style={{
//             width: size - 24,
//             height: size - 24,
//             margin: 0,
//           }}
//         />
//         <div
//           className="absolute inset-0 flex flex-col items-center justify-center text-center px-3"
//         >
//           <div className="text-lg font-bold text-slate-900">
//             {total}
//           </div>
//           <div className="text-xs text-slate-500">Total</div>
//         </div>
//       </div>

//       <div className="flex flex-col gap-3">
//         <div className="flex items-center gap-2">
//           <span
//             className="w-3 h-3 rounded-full"
//             style={{ background: aColor }}
//           />
//           <span className="text-sm text-slate-700">
//             {aLabel}: <span className="font-semibold text-slate-900">{aValue}</span>
//           </span>
//         </div>
//         <div className="flex items-center gap-2">
//           <span
//             className="w-3 h-3 rounded-full"
//             style={{ background: bColor }}
//           />
//           <span className="text-sm text-slate-700">
//             {bLabel}: <span className="font-semibold text-slate-900">{bValue}</span>
//           </span>
//         </div>
//         <div className="text-xs text-slate-500">
//           {Math.round((aValue / total) * 100)}% / {Math.round((bValue / total) * 100)}%
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function ActiveInchargeDashboardPage() {
//   const router = useRouter();
//   const [user, setUser] = useState(null);
//   const [userRole, setUserRole] = useState("");
//   const [isInchargeUser, setIsInchargeUser] = useState(false);

//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [incharges, setIncharges] = useState([]);

//   const fetchAll = useCallback(async (authUser) => {
//     if (!db || !authUser) return;
//     setRefreshing(true);
//     try {
//       const activeQuery = firestoreHelpers.query(
//         firestoreHelpers.collection(db, "users", "crtActiveIncharge", "activeIncharge"),
//         firestoreHelpers.where("userId", "==", authUser.uid)
//       );
//       const classQuery = firestoreHelpers.query(
//         firestoreHelpers.collection(db, "users", "crtActiveIncharge", "classroomMonitor"),
//         firestoreHelpers.where("userId", "==", authUser.uid)
//       );

//       let [activeSnap, classSnap] = await Promise.all([
//         firestoreHelpers.getDocs(activeQuery),
//         firestoreHelpers.getDocs(classQuery),
//       ]);

//       // fallback for old docs that might not have userId
//       if (activeSnap.empty && classSnap.empty && authUser.email) {
//         const activeEmailQuery = firestoreHelpers.query(
//           firestoreHelpers.collection(db, "users", "crtActiveIncharge", "activeIncharge"),
//           firestoreHelpers.where("email", "==", authUser.email)
//         );
//         const classEmailQuery = firestoreHelpers.query(
//           firestoreHelpers.collection(db, "users", "crtActiveIncharge", "classroomMonitor"),
//           firestoreHelpers.where("email", "==", authUser.email)
//         );
//         [activeSnap, classSnap] = await Promise.all([
//           firestoreHelpers.getDocs(activeEmailQuery),
//           firestoreHelpers.getDocs(classEmailQuery),
//         ]);
//       }

//       const activeList = activeSnap.docs.map((d) => ({
//         id: d.id,
//         subcollection: "activeIncharge",
//         role: "assignment incharge",
//         ...d.data(),
//       }));
//       const classList = classSnap.docs.map((d) => ({
//         id: d.id,
//         subcollection: "classroomMonitor",
//         role: "class room monitor",
//         ...d.data(),
//       }));

//       // normalize sorting by createdAt (string or timestamp)
//       const list = [...activeList, ...classList].sort((a, b) => {
//         const ta = toMillis(a.createdAt);
//         const tb = toMillis(b.createdAt);
//         return tb - ta;
//       });

//       setIncharges(list);
//     } catch (err) {
//       console.error(err);
//       alert("Failed to load your dashboard data.");
//     } finally {
//       setRefreshing(false);
//     }
//   }, []);

//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, async (u) => {
//       setUser(u);
//       if (u) {
//         const ref = firestoreHelpers.doc(db, "users", u.uid);
//         const snap = await firestoreHelpers.getDoc(ref);
//         const role = (snap.exists() ? snap.data().role : "") || "";
//         const roleLc = String(role).toLowerCase();
//         setUserRole(role);
//         setIsInchargeUser(
//           roleLc === "crtincharge" ||
//           roleLc === "superadmin" ||
//             roleLc === "incharge" ||
//             roleLc === "class room monitor" ||
//             roleLc === "assignment incharge" ||
//             snap.data()?.isIncharge === true
//         );
//       }
//       setLoading(false);
//     });
//     return () => unsub();
//   }, []);

//   useEffect(() => {
//     if (user && isFirebaseConfigured) fetchAll(user);
//   }, [user, fetchAll]);

//   const { total, classCount, assignmentCount, deptMap } = useMemo(() => {
//     const totalCount = incharges.length;
//     const classMonitors = incharges.filter(
//       (x) => (x.role || "").toLowerCase() === "class room monitor"
//     ).length;
//     const assignmentIncharges = incharges.filter(
//       (x) => (x.role || "").toLowerCase() === "assignment incharge"
//     ).length;

//     const map = new Map();
//     for (const u of incharges) {
//       const dept =
//         (u.departmentName || u.department || "").toString().trim() || "—";
//       map.set(dept, (map.get(dept) || 0) + 1);
//     }

//     return {
//       total: totalCount,
//       classCount: classMonitors,
//       assignmentCount: assignmentIncharges,
//       deptMap: map,
//     };
//   }, [incharges]);

//   const departmentBars = useMemo(() => {
//     const rows = Array.from(deptMap.entries()).map(([department, count]) => ({
//       department,
//       count,
//     }));
//     rows.sort((a, b) => b.count - a.count);
//     return rows.slice(0, 6);
//   }, [deptMap]);

//   const roleAlerts = useMemo(() => {
//     if (total === 0) return [];
//     const maxCount = Math.max(classCount, assignmentCount);
//     const maxRole =
//       classCount >= assignmentCount ? "Class room monitor" : "Assignment incharge";
//     const share = maxCount / total;

//     const alerts = [];
//     if (share >= 0.75) {
//       alerts.push(`High concentration: ${maxRole} is ${Math.round(share * 100)}% of incharges.`);
//     }

//     // Department low staff alerts (only top 10)
//     const deptRows = Array.from(deptMap.entries()).map(([department, count]) => ({ department, count }));
//     deptRows.sort((a, b) => a.count - b.count);
//     const low = deptRows.filter((d) => d.count <= 1).slice(0, 3);
//     for (const d of low) {
//       alerts.push(`Low staff: ${d.department} has only ${d.count} incharge.`);
//     }

//     return alerts;
//   }, [total, classCount, assignmentCount, deptMap]);

//   const recent = useMemo(() => {
//     return incharges.slice(0, 5).map((u) => {
//       const t = toMillis(u.createdAt);
//       return {
//         ...u,
//         createdAtMillis: t,
//       };
//     });
//   }, [incharges]);

//   const exportCsv = useCallback(() => {
//     const header = [
//       "Employee ID",
//       "Name",
//       "Email",
//       "Mobile Number",
//       "Department Name",
//       "Department ID",
//       "Job Role",
//     ];

//     const rows = incharges.map((u) => [
//       u.empId || "",
//       u.name || "",
//       u.email || "",
//       u.phone || "",
//       u.departmentName || "",
//       u.departmentId || "",
//       (u.role || "").toString(),
//     ]);

//     const escapeCsv = (val) => {
//       const s = String(val ?? "");
//       if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
//       return s;
//     };

//     const csv = [
//       header.map(escapeCsv).join(","),
//       ...rows.map((r) => r.map(escapeCsv).join(",")),
//     ].join("\n");

//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "active-incharges.csv";
//     a.click();
//     URL.revokeObjectURL(url);
//   }, [incharges]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50">
//         <div className="flex flex-col items-center gap-5">
//           <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
//           <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!user) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
//         <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
//           <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
//           <p className="text-slate-600 mb-8">Please login to continue.</p>
//           <button
//             onClick={() => router.push("/")}
//             className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
//           >
//             Go to Login
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (!isInchargeUser) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
//         <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
//           <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
//           <p className="text-slate-600 mb-8">This dashboard is for incharge users only.</p>
//           <button
//             onClick={() => router.push("/main")}
//             className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
//           >
//             Go to Main
//           </button>
//         </div>
//       </div>
//     );
//   }

//   const maxDeptCount = Math.max(1, ...departmentBars.map((d) => d.count));

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="mx-auto px-4 py-10 w-full">
//         <div className="mb-8 flex flex-col gap-4">
//           <div className="flex items-center gap-3">
//             <Link
//               href="/main"
//               className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors w-fit"
//             >
//               <ArrowLeft className="w-4 h-4" />
//               Back to Main
//             </Link>
//           </div>

//           <div>
//             <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
//               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
//                 <UserCheck className="w-6 h-6 text-white" />
//               </div>
//               My Incharge Dashboard
//             </h1>
//             <p className="text-slate-600 mt-1">
//               Personal overview for your incharge account.
//             </p>
//             <p className="text-xs text-slate-500 mt-2">
//               Logged in role: <span className="font-semibold">{userRole || "Unknown"}</span>
//             </p>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <p className="text-xs font-medium text-slate-500">Total Incharges</p>
//                 <p className="mt-2 text-3xl font-bold text-slate-900">{total}</p>
//               </div>
//               <div className="rounded-xl bg-slate-100 p-3">
//                 <Layers className="w-5 h-5 text-[#00448a]" />
//               </div>
//             </div>
//           </div>

//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <p className="text-xs font-medium text-slate-500">Class Room Monitors</p>
//                 <p className="mt-2 text-3xl font-bold text-emerald-700">{classCount}</p>
//               </div>
//               <div className="rounded-xl bg-emerald-50 p-3">
//                 <Sparkles className="w-5 h-5 text-emerald-600" />
//               </div>
//             </div>
//           </div>

//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <p className="text-xs font-medium text-slate-500">Assignment Incharges</p>
//                 <p className="mt-2 text-3xl font-bold text-sky-700">{assignmentCount}</p>
//               </div>
//               <div className="rounded-xl bg-sky-50 p-3">
//                 <Sparkles className="w-5 h-5 text-sky-600" />
//               </div>
//             </div>
//           </div>

//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <p className="text-xs font-medium text-slate-500">Departments</p>
//                 <p className="mt-2 text-3xl font-bold text-slate-900">{deptMap.size}</p>
//               </div>
//               <div className="rounded-xl bg-violet-50 p-3">
//                 <Clock className="w-5 h-5 text-violet-600" />
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 xl:col-span-1">
//             <div className="flex items-center justify-between gap-3 mb-4">
//               <h2 className="text-lg font-semibold text-slate-900">Role distribution</h2>
//               <div className="inline-flex items-center gap-2 text-xs text-slate-500">
//                 <span className="w-2 h-2 rounded-full bg-emerald-500" />
//                 Class
//                 <span className="w-2 h-2 rounded-full bg-sky-500 ml-2" />
//                 Assignment
//               </div>
//             </div>
//             <Pie
//               aLabel="Class room monitor"
//               aValue={classCount}
//               aColor="#10b981"
//               bLabel="Assignment incharge"
//               bValue={assignmentCount}
//               bColor="#0ea5e9"
//             />
//           </div>

//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 xl:col-span-2">
//             <div className="flex items-center justify-between gap-3 mb-4">
//               <h2 className="text-lg font-semibold text-slate-900">Department overview</h2>
//               <div className="text-xs text-slate-500">Top departments by count</div>
//             </div>

//             {departmentBars.length === 0 ? (
//               <div className="text-sm text-slate-500">No department data yet.</div>
//             ) : (
//               <div className="flex flex-col gap-4">
//                 {departmentBars.map((d) => (
//                   <div key={d.department} className="flex items-center gap-3">
//                     <div className="w-36 truncate text-sm font-medium text-slate-700">
//                       {d.department}
//                     </div>
//                     <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
//                       <div
//                         className="h-full rounded-full bg-gradient-to-r from-slate-800 to-[#00448a]"
//                         style={{ width: `${Math.round((d.count / maxDeptCount) * 100)}%` }}
//                       />
//                     </div>
//                     <div className="w-10 text-right text-sm font-semibold text-slate-900">
//                       {d.count}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 xl:col-span-2">
//             <div className="flex items-center justify-between gap-3 mb-4">
//               <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
//               <div className="text-xs text-slate-500">Personal shortcuts</div>
//             </div>

//             <div className="flex flex-wrap gap-3">
//               <button
//                 type="button"
//                 onClick={() => fetchAll(user)}
//                 disabled={refreshing}
//                 className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-60"
//               >
//                 <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
//                 Refresh
//               </button>

//               <button
//                 type="button"
//                 onClick={exportCsv}
//                 disabled={incharges.length === 0}
//                 className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-60"
//               >
//                 <Download className="w-4 h-4" />
//                 Export CSV
//               </button>

//               <Link
//                 href="/main"
//                 className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors"
//               >
//                 Go to Main →
//               </Link>
//             </div>
//           </div>

//           <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//             <div className="flex items-center justify-between gap-3 mb-4">
//               <h2 className="text-lg font-semibold text-slate-900">Highlights</h2>
//             </div>

//             {roleAlerts.length === 0 ? (
//               <div className="text-sm text-slate-600">
//                 No alerts right now.
//               </div>
//             ) : (
//               <div className="flex flex-col gap-3">
//                 {roleAlerts.slice(0, 4).map((msg, idx) => (
//                   <div
//                     key={`${msg}-${idx}`}
//                     className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"
//                   >
//                     <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
//                     <div className="text-sm text-amber-900">{msg}</div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//           <div className="flex items-center justify-between gap-3 mb-4">
//             <h2 className="text-lg font-semibold text-slate-900">My recent entries</h2>
//             <div className="text-xs text-slate-500">Latest records linked to your account</div>
//           </div>

//           {recent.length === 0 ? (
//             <div className="text-sm text-slate-500">No incharges found.</div>
//           ) : (
//             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
//               {recent.map((u) => {
//                 const isClass = (u.role || "").toLowerCase() === "class room monitor";
//                 const badgeClass = isClass
//                   ? "bg-emerald-100 text-emerald-800 border-emerald-200"
//                   : "bg-sky-100 text-sky-800 border-sky-200";

//                 return (
//                   <div
//                     key={u.id}
//                     className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4"
//                   >
//                     <div className="flex items-start justify-between gap-3">
//                       <div>
//                         <div className="text-sm font-semibold text-slate-900">
//                           {u.name || "—"}
//                         </div>
//                         <div className="text-xs text-slate-500 mt-1">
//                           {u.email || "—"}
//                         </div>
//                       </div>
//                       <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${badgeClass}`}>
//                         {isClass ? "Class Room Monitor" : "Assignment Incharge"}
//                       </div>
//                     </div>

//                     <div className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
//                       <div>
//                         <span className="text-slate-500">Emp ID:</span>{" "}
//                         <span className="font-medium">{u.empId || "—"}</span>
//                       </div>
//                       <div>
//                         <span className="text-slate-500">Dept:</span>{" "}
//                         <span className="font-medium">{u.departmentName || "—"}</span>
//                       </div>
//                       <div className="text-xs text-slate-500">
//                         Created:{" "}
//                         {u.createdAt
//                           ? new Date(toMillis(u.createdAt)).toLocaleString()
//                           : "—"}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth, db, firestoreHelpers, isFirebaseConfigured } from "../../lib/firebase";
import {
  ArrowLeft,
  RefreshCw,
  UserCheck,
  Download,
  Layers,
  Clock,
  AlertTriangle,
  Sparkles,
  PlusCircle,
  BookOpen,
  Users,
  Save,
} from "lucide-react";

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof value === "object") {
    const seconds = typeof value.seconds === "number" ? value.seconds : 0;
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return seconds * 1000 + nanos / 1e6;
  }
  return 0;
}

export default function ActiveInchargeDashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [isInchargeUser, setIsInchargeUser] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);

  const [activities, setActivities] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const [activityForm, setActivityForm] = useState({
    activityTitle: "",
    activityType: "",
    maxMarks: "",
    dueDate: "",
  });

  const [studentResults, setStudentResults] = useState({});
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fetchAssignedClasses = useCallback(async (authUser) => {
    if (!db || !authUser) return;

    const q = firestoreHelpers.query(
      firestoreHelpers.collection(db, "assignedClasses"),
      firestoreHelpers.where("inchargeId", "==", authUser.uid)
    );

    const snap = await firestoreHelpers.getDocs(q);

    const list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setAssignedClasses(list);

    if (list.length > 0 && !selectedClass) {
      setSelectedClass(list[0]);
    }
  }, [selectedClass]);

  const fetchActivities = useCallback(async () => {
    if (!db || !selectedClass || !user) return;

    const q = firestoreHelpers.query(
      firestoreHelpers.collection(db, "activities"),
      firestoreHelpers.where("classId", "==", selectedClass.classId),
      firestoreHelpers.where("inchargeId", "==", user.uid)
    );

    const snap = await firestoreHelpers.getDocs(q);

    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    setActivities(list);
  }, [selectedClass, user]);

  const fetchStudents = useCallback(async () => {
    if (!db || !selectedClass) return;
    const batchId = selectedClass.batchId || selectedClass.classId || "";
    const directList = [];

    // 1) Preferred source: selected batch's students subcollection.
    try {
      const studentsPath =
        selectedClass.studentsPath ||
        (selectedClass.batchPath ? `${selectedClass.batchPath}/students` : "");

      if (studentsPath) {
        const segments = studentsPath.split("/").filter(Boolean);
        const subSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, ...segments)
        );
        subSnap.docs.forEach((d) => directList.push({ id: d.id, ...d.data() }));
      } else if (selectedClass.crtId && selectedClass.parentBathesId && batchId) {
        const subSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            "crt",
            selectedClass.crtId,
            "bathes",
            selectedClass.parentBathesId,
            "baths",
            batchId,
            "students"
          )
        );
        subSnap.docs.forEach((d) => directList.push({ id: d.id, ...d.data() }));
      } else if (selectedClass.crtId && batchId) {
        const subSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(
            db,
            "crt",
            selectedClass.crtId,
            "batches",
            batchId,
            "students"
          )
        );
        subSnap.docs.forEach((d) => directList.push({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      // Keep fallback flow below if direct subcollection read fails/missing.
      console.warn("batch students subcollection read failed", err);
    }

    // 2) Fallback source: top-level students collection by batch id mappings.
    const fallbackMap = new Map();
    if (batchId) {
      try {
        const studentsCol = firestoreHelpers.collection(db, "students");
        const q1 = firestoreHelpers.query(
          studentsCol,
          firestoreHelpers.where("classId", "==", batchId)
        );
        const q2 = firestoreHelpers.query(
          studentsCol,
          firestoreHelpers.where("classIds", "array-contains", batchId)
        );
        const [snap1, snap2] = await Promise.all([
          firestoreHelpers.getDocs(q1),
          firestoreHelpers.getDocs(q2),
        ]);
        snap1.docs.forEach((d) => fallbackMap.set(d.id, { id: d.id, ...d.data() }));
        snap2.docs.forEach((d) => fallbackMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (err) {
        console.warn("top-level students fallback read failed", err);
      }
    }

    const combinedMap = new Map();
    directList.forEach((s) => combinedMap.set(s.id, s));
    fallbackMap.forEach((s, id) => combinedMap.set(id, s));
    setStudents(Array.from(combinedMap.values()));
  }, [selectedClass]);

  const fetchAll = useCallback(async (authUser) => {
    if (!authUser) return;
    setRefreshing(true);
    try {
      await fetchAssignedClasses(authUser);
    } catch (err) {
      console.error(err);
      alert("Failed to load dashboard data.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchAssignedClasses]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        const ref = firestoreHelpers.doc(db, "users", u.uid);
        const snap = await firestoreHelpers.getDoc(ref);
        const role = (snap.exists() ? snap.data().role : "") || "";
        const roleLc = String(role).toLowerCase();

        setUserRole(role);
        setIsInchargeUser(
          roleLc === "crtincharge" ||
          roleLc === "superadmin" ||
          roleLc === "incharge" ||
          roleLc === "class room monitor" ||
          roleLc === "assignment incharge" ||
          snap.data()?.isIncharge === true
        );
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (user && isFirebaseConfigured) {
      fetchAll(user);
    }
  }, [user, fetchAll]);

  useEffect(() => {
    if (selectedClass) {
      fetchActivities();
      fetchStudents();
    }
  }, [selectedClass, fetchActivities, fetchStudents]);

  const createActivity = async () => {
    if (!db || !user || !selectedClass) return;

    if (!activityForm.activityTitle || !activityForm.activityType || !activityForm.maxMarks) {
      alert("Please fill all required activity fields.");
      return;
    }

    try {
      const ref = firestoreHelpers.doc(firestoreHelpers.collection(db, "activities"));

      await firestoreHelpers.setDoc(ref, {
        activityId: ref.id,
        inchargeId: user.uid,
        classId: selectedClass.classId,
        className: selectedClass.className,
        section: selectedClass.section || "",
        departmentName: selectedClass.departmentName || "",
        activityTitle: activityForm.activityTitle,
        activityType: activityForm.activityType,
        maxMarks: Number(activityForm.maxMarks),
        dueDate: activityForm.dueDate || "",
        createdAt: new Date().toISOString(),
      });

      alert("Activity created successfully.");

      setActivityForm({
        activityTitle: "",
        activityType: "",
        maxMarks: "",
        dueDate: "",
      });

      fetchActivities();
    } catch (err) {
      console.error(err);
      alert("Failed to create activity.");
    }
  };

  const saveStudentResults = async () => {
    if (!db || !selectedActivity || !selectedClass) {
      alert("Please select an activity first.");
      return;
    }

    try {
      for (const student of students) {
        const data = studentResults[student.id] || {};
        const resultRef = firestoreHelpers.doc(
          db,
          "activityResults",
          `${selectedActivity.id}_${student.id}`
        );

        await firestoreHelpers.setDoc(resultRef, {
          resultId: `${selectedActivity.id}_${student.id}`,
          activityId: selectedActivity.id,
          classId: selectedClass.classId,
          className: selectedClass.className,
          studentId: student.id,
          studentName: student.studentName || student.name || "",
          rollNumber: student.rollNumber || "",
          marksObtained: Number(data.marksObtained || 0),
          status: data.status || "Pending",
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      alert("Student-wise results updated successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to save results.");
    }
  };

  const updateStudentResult = (studentId, field, value) => {
    setStudentResults((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const changeMyPassword = async () => {
    if (!user?.email) {
      alert("Unable to verify your account.");
      return;
    }

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      alert("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      // Re-auth is required before sensitive actions
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);

      const idToken = await user.getIdToken();
      const res = await fetch("/api/change-incharge-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update password.");
      }

      alert("Password updated successfully.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      alert(err?.message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const totalStudents = students.length;
  const totalActivities = activities.length;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Please login.</div>;
  }

  if (!isInchargeUser) {
    return <div className="min-h-screen flex items-center justify-center">Access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/main" className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <button
          onClick={() => fetchAll(user)}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">Incharge Activity Dashboard</h1>
      <p className="text-slate-600 mb-6">Manage your assigned classes, activities, and student-wise results.</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border p-5">
          <div className="text-sm text-slate-500">Assigned Classes</div>
          <div className="text-3xl font-bold mt-2">{assignedClasses.length}</div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <div className="text-sm text-slate-500">Activities</div>
          <div className="text-3xl font-bold mt-2">{totalActivities}</div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <div className="text-sm text-slate-500">Students</div>
          <div className="text-3xl font-bold mt-2">{totalStudents}</div>
        </div>
      </div>

      {/* Assigned Classes */}
      <div className="bg-white rounded-2xl border p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">My Assigned Classes</h2>
        <div className="flex flex-wrap gap-3">
          {assignedClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => {
                setSelectedClass(cls);
                setSelectedActivity(null);
              }}
              className={`px-4 py-2 rounded-xl border ${
                selectedClass?.id === cls.id
                  ? "bg-[#00448a] text-white border-[#00448a]"
                  : "bg-white text-slate-700"
              }`}
            >
              {cls.className} {cls.section ? `- ${cls.section}` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Create Activity */}
      {selectedClass && (
        <div className="bg-white rounded-2xl border p-5 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Create Activity for {selectedClass.className}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Activity Title"
              value={activityForm.activityTitle}
              onChange={(e) =>
                setActivityForm((prev) => ({ ...prev, activityTitle: e.target.value }))
              }
              className="px-4 py-3 border rounded-xl"
            />
            <input
              type="text"
              placeholder="Activity Type"
              value={activityForm.activityType}
              onChange={(e) =>
                setActivityForm((prev) => ({ ...prev, activityType: e.target.value }))
              }
              className="px-4 py-3 border rounded-xl"
            />
            <input
              type="number"
              placeholder="Max Marks"
              value={activityForm.maxMarks}
              onChange={(e) =>
                setActivityForm((prev) => ({ ...prev, maxMarks: e.target.value }))
              }
              className="px-4 py-3 border rounded-xl"
            />
            <input
              type="date"
              value={activityForm.dueDate}
              onChange={(e) =>
                setActivityForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
              className="px-4 py-3 border rounded-xl"
            />
          </div>

          <button
            onClick={createActivity}
            className="mt-4 px-5 py-3 bg-[#00448a] text-white rounded-xl flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Create Activity
          </button>
        </div>
      )}

      {/* Activities */}
      {selectedClass && (
        <div className="bg-white rounded-2xl border p-5 mb-6">
          <h2 className="text-xl font-semibold mb-4">Activities</h2>

          {activities.length === 0 ? (
            <p className="text-slate-500">No activities created yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {activities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className={`px-4 py-2 rounded-xl border ${
                    selectedActivity?.id === act.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {act.activityTitle} ({act.activityType})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student Wise Results */}
      {selectedClass && selectedActivity && (
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="text-xl font-semibold mb-4">
            Student-wise Results - {selectedActivity.activityTitle}
          </h2>

          {students.length === 0 ? (
            <p className="text-slate-500">No students found for this class.</p>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-left p-3 border">Roll No</th>
                      <th className="text-left p-3 border">Student Name</th>
                      <th className="text-left p-3 border">Marks</th>
                      <th className="text-left p-3 border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td className="p-3 border">{student.rollNumber || "—"}</td>
                        <td className="p-3 border">{student.studentName || student.name || "—"}</td>
                        <td className="p-3 border">
                          <input
                            type="number"
                            className="px-3 py-2 border rounded-lg w-28"
                            value={studentResults[student.id]?.marksObtained || ""}
                            onChange={(e) =>
                              updateStudentResult(student.id, "marksObtained", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-3 border">
                          <select
                            className="px-3 py-2 border rounded-lg"
                            value={studentResults[student.id]?.status || "Pending"}
                            onChange={(e) =>
                              updateStudentResult(student.id, "status", e.target.value)
                            }
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={saveStudentResults}
                className="mt-5 px-5 py-3 bg-emerald-600 text-white rounded-xl flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Student Results
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
} 

