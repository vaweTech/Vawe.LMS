// "use client";

// import { useEffect, useState, useCallback } from "react";
// import Link from "next/link";
// import { auth, db, firestoreHelpers, isFirebaseConfigured } from "../../../../lib/firebase";
// import { onAuthStateChanged } from "firebase/auth";
// import { useRouter } from "next/navigation";
// import { motion } from "framer-motion";
// import { ArrowLeft, UserCheck, Search, RefreshCw, Mail, Phone, X } from "lucide-react";

// function isIncharge(u) {
//   const role = (u.role || "").toLowerCase();
//   return (
//     role === "crtincharge" ||
//     role === "incharge" ||
//     role === "classroommonitor" ||
//     role === "activeincharge" ||
//     role === "class room monitor" ||
//     role === "assignment incharge" ||
//     u.isIncharge === true
//   );
// }

// function normalizeInchargeRole(role, subcollection) {
//   const value = (role || "").toLowerCase().trim();
//   if (
//     value === "classroommonitor" ||
//     value === "class room monitor" ||
//     subcollection === "classroomMonitor"
//   ) {
//     return "classroomMonitor";
//   }
//   return "activeIncharge";
// }

// function inchargeRoleLabel(role) {
//   return normalizeInchargeRole(role) === "classroomMonitor"
//     ? "Class Room Monitor"
//     : "Active Incharge";
// }

// export default function ActiveInchargePage() {
//   const router = useRouter();
//   const [user, setUser] = useState(null);
//   const [isAdmin, setIsAdmin] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [incharges, setIncharges] = useState([]);
//   const [classes, setClasses] = useState([]);
//   const [loadingClasses, setLoadingClasses] = useState(false);
//   const [loadingIncharges, setLoadingIncharges] = useState(false);
//   const [search, setSearch] = useState("");
//   const [showCreateModal, setShowCreateModal] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [editingIncharge, setEditingIncharge] = useState(null);
//   const [updating, setUpdating] = useState(false);
//   const [createForm, setCreateForm] = useState({
//     empId: "",
//     name: "",
//     email: "",
//     phone: "",
//     departmentName: "",
//     departmentId: "",
//     isClassRoomMonitor: false,
//     assignedClassIds: [],
//   });

//   const [editForm, setEditForm] = useState({
//     empId: "",
//     name: "",
//     email: "",
//     phone: "",
//     departmentName: "",
//     departmentId: "",
//     isClassRoomMonitor: false,
//     assignedClassIds: [],
//   });

//   const updateForm = (key, value) => {
//     setCreateForm((prev) => ({ ...prev, [key]: value }));
//   };

//   const updateEditForm = (key, value) => {
//     setEditForm((prev) => ({ ...prev, [key]: value }));
//   };

//   const classLabel = (cls) => {
//     const name = cls?.name || cls?.className || cls?.title || "Unnamed Class";
//     const section = cls?.section ? ` - ${cls.section}` : "";
//     return `${name}${section}`;
//   };

//   const getInchargeRoleValue = (isClassRoomMonitor) =>
//     isClassRoomMonitor ? "class room monitor" : "assignment incharge";

//   const fetchClasses = useCallback(async () => {
//     if (!db) return;
//     setLoadingClasses(true);
//     try {
//       const snap = await firestoreHelpers.getDocs(firestoreHelpers.collection(db, "classes"));
//       const list = snap.docs
//         .map((d) => ({ id: d.id, ...d.data() }))
//         .sort((a, b) => classLabel(a).localeCompare(classLabel(b)));
//       setClasses(list);
//     } catch (err) {
//       console.error(err);
//       alert("Failed to load classes.");
//     } finally {
//       setLoadingClasses(false);
//     }
//   }, []);

//   const syncAssignedClasses = useCallback(
//     async ({
//       inchargeId,
//       inchargeEmail,
//       inchargeName,
//       isClassRoomMonitor,
//       selectedClassIds,
//     }) => {
//       if (!db) return;
//       if (!inchargeId && !inchargeEmail) return;

//       const safeEmail = (inchargeEmail || "").toLowerCase();
//       const classMap = new Map(classes.map((c) => [c.id, c]));
//       const selectedIds = Array.isArray(selectedClassIds)
//         ? Array.from(new Set(selectedClassIds.filter(Boolean)))
//         : [];

//       const queries = [];
//       if (inchargeId) {
//         queries.push(
//           firestoreHelpers.getDocs(
//             firestoreHelpers.query(
//               firestoreHelpers.collection(db, "assignedClasses"),
//               firestoreHelpers.where("inchargeId", "==", inchargeId)
//             )
//           )
//         );
//       }
//       if (safeEmail) {
//         queries.push(
//           firestoreHelpers.getDocs(
//             firestoreHelpers.query(
//               firestoreHelpers.collection(db, "assignedClasses"),
//               firestoreHelpers.where("inchargeEmail", "==", safeEmail)
//             )
//           )
//         );
//       }

//       const snapshots = await Promise.all(queries);
//       const existingDocs = [];
//       snapshots.forEach((snap) => {
//         snap.docs.forEach((docSnap) => {
//           if (!existingDocs.find((x) => x.id === docSnap.id)) {
//             existingDocs.push(docSnap);
//           }
//         });
//       });

//       const existingByClassId = new Map(
//         existingDocs
//           .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
//           .filter((row) => row.classId)
//           .map((row) => [row.classId, row])
//       );

//       const role = getInchargeRoleValue(isClassRoomMonitor);
//       const now = new Date().toISOString();

//       // Create/update selected class assignments
//       for (const classId of selectedIds) {
//         const c = classMap.get(classId) || {};
//         const payload = {
//           inchargeId: inchargeId || null,
//           inchargeEmail: safeEmail,
//           inchargeName: inchargeName || "",
//           role,
//           classId,
//           className: c.name || c.className || c.title || classId,
//           section: c.section || "",
//           departmentName: c.departmentName || c.department || "",
//           departmentId: c.departmentId || "",
//           updatedAt: now,
//         };

//         const existing = existingByClassId.get(classId);
//         if (existing?.id) {
//           const docRef = firestoreHelpers.doc(db, "assignedClasses", existing.id);
//           await firestoreHelpers.updateDoc(docRef, payload);
//         } else {
//           const colRef = firestoreHelpers.collection(db, "assignedClasses");
//           await firestoreHelpers.addDoc(colRef, {
//             ...payload,
//             createdAt: now,
//           });
//         }
//       }

//       // Delete removed class assignments
//       for (const existing of existingByClassId.values()) {
//         if (!selectedIds.includes(existing.classId)) {
//           const docRef = firestoreHelpers.doc(db, "assignedClasses", existing.id);
//           await firestoreHelpers.deleteDoc(docRef);
//         }
//       }
//     },
//     [classes]
//   );

//   const clearAssignedClasses = useCallback(async ({ inchargeId, inchargeEmail }) => {
//     if (!db) return;
//     if (!inchargeId && !inchargeEmail) return;

//     const safeEmail = (inchargeEmail || "").toLowerCase();
//     const queries = [];
//     if (inchargeId) {
//       queries.push(
//         firestoreHelpers.getDocs(
//           firestoreHelpers.query(
//             firestoreHelpers.collection(db, "assignedClasses"),
//             firestoreHelpers.where("inchargeId", "==", inchargeId)
//           )
//         )
//       );
//     }
//     if (safeEmail) {
//       queries.push(
//         firestoreHelpers.getDocs(
//           firestoreHelpers.query(
//             firestoreHelpers.collection(db, "assignedClasses"),
//             firestoreHelpers.where("inchargeEmail", "==", safeEmail)
//           )
//         )
//       );
//     }

//     const snapshots = await Promise.all(queries);
//     const ids = new Set();
//     snapshots.forEach((snap) => snap.docs.forEach((d) => ids.add(d.id)));
//     await Promise.all(
//       Array.from(ids).map((id) =>
//         firestoreHelpers.deleteDoc(firestoreHelpers.doc(db, "assignedClasses", id))
//       )
//     );
//   }, []);

//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, async (u) => {
//       setUser(u);
//       if (u) {
//         const ref = firestoreHelpers.doc(db, "users", u.uid);
//         const snap = await firestoreHelpers.getDoc(ref);
//         const role = snap.exists() ? (snap.data().role || snap.data().Role) : null;
//         setIsAdmin(role === "admin"||role === "superadmin");
//       }
//       setLoading(false);
//     });
//     return () => unsub();
//   }, []);

//   const fetchIncharges = useCallback(async () => {
//     if (!db) return;
//     setLoadingIncharges(true);
//     try {
//       // 1. activeIncharge subcollection = role "activeIncharge"
//       const activeSnap = await firestoreHelpers.getDocs(
//         firestoreHelpers.collection(db, "users", "crtActiveIncharge", "activeIncharge")
//       );
//       const assignmentList = activeSnap.docs.map((d) => ({
//         id: d.id,
//         subcollection: "activeIncharge",
//         ...d.data(),
//         role: normalizeInchargeRole(d.data()?.role, "activeIncharge"),
//       }));

//       // 2. classroomMonitor subcollection = role "classroomMonitor"
//       const classroomSnap = await firestoreHelpers.getDocs(
//         firestoreHelpers.collection(db, "users", "crtActiveIncharge", "classroomMonitor")
//       );
//       const classroomList = classroomSnap.docs.map((d) => ({
//         id: d.id,
//         subcollection: "classroomMonitor",
//         ...d.data(),
//         role: normalizeInchargeRole(d.data()?.role, "classroomMonitor"),
//       }));

//       const assignedSnap = await firestoreHelpers.getDocs(
//         firestoreHelpers.collection(db, "assignedClasses")
//       );
//       const assignmentsByInchargeId = new Map();
//       const assignmentsByEmail = new Map();

//       assignedSnap.docs.forEach((d) => {
//         const row = d.data() || {};
//         const classId = row.classId || d.id;
//         const className = row.className || "Unnamed Class";
//         const section = row.section ? ` - ${row.section}` : "";
//         const label = `${className}${section}`;
//         const assignment = { classId, label };

//         if (row.inchargeId) {
//           const current = assignmentsByInchargeId.get(row.inchargeId) || [];
//           if (!current.some((x) => x.classId === classId)) {
//             assignmentsByInchargeId.set(row.inchargeId, [...current, assignment]);
//           }
//         }
//         if (row.inchargeEmail) {
//           const emailKey = String(row.inchargeEmail).toLowerCase();
//           const current = assignmentsByEmail.get(emailKey) || [];
//           if (!current.some((x) => x.classId === classId)) {
//             assignmentsByEmail.set(emailKey, [...current, assignment]);
//           }
//         }
//       });

//       const list = [...assignmentList, ...classroomList].sort((a, b) =>
//         (a.name || "").localeCompare(b.name || "")
//       );
//       const enriched = list.map((row) => {
//         const byId = row.userId ? assignmentsByInchargeId.get(row.userId) || [] : [];
//         const byEmail = row.email
//           ? assignmentsByEmail.get(String(row.email).toLowerCase()) || []
//           : [];
//         const assignedClasses = [...byId];
//         byEmail.forEach((entry) => {
//           if (!assignedClasses.some((x) => x.classId === entry.classId)) {
//             assignedClasses.push(entry);
//           }
//         });
//         return { ...row, assignedClasses };
//       });

//       setIncharges(enriched);
//     } catch (err) {
//       console.error(err);
//       alert("Failed to load active incharges.");
//     } finally {
//       setLoadingIncharges(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (user && isAdmin && isFirebaseConfigured) {
//       fetchIncharges();
//       fetchClasses();
//     }
//   }, [user, isAdmin, fetchIncharges, fetchClasses]);

//   const openCreateModal = () => {
//     setCreateForm({
//       empId: "",
//       name: "",
//       email: "",
//       phone: "",
//       departmentName: "",
//       departmentId: "",
//       isClassRoomMonitor: false,
//       assignedClassIds: [],
//     });
//     setShowCreateModal(true);
//   };

//   const closeCreateModal = () => {
//     setShowCreateModal(false);
//   };

//   const openEditModal = (u) => {
//     const role = normalizeInchargeRole(u.role, u.subcollection);
//     setEditingIncharge(u);
//     setEditForm({
//       empId: u.empId || "",
//       name: u.name || "",
//       email: u.email || "",
//       phone: u.phone || "",
//       departmentName: u.departmentName || "",
//       departmentId: u.departmentId || "",
//       isClassRoomMonitor: role === "classroomMonitor",
//       assignedClassIds: Array.isArray(u.assignedClasses)
//         ? u.assignedClasses.map((x) => x.classId).filter(Boolean)
//         : [],
//     });
//   };

//   const closeEditModal = () => {
//     setEditingIncharge(null);
//     setEditForm({
//       empId: "",
//       name: "",
//       email: "",
//       phone: "",
//       departmentName: "",
//       departmentId: "",
//       isClassRoomMonitor: false,
//       assignedClassIds: [],
//     });
//   };

//   const handleCreateIncharge = async (e) => {
//     e.preventDefault();
//     const name = createForm.name.trim();
//     const email = createForm.email.trim();
//     const phone = createForm.phone.trim();

//     if (!name || !email || !phone) {
//       alert("Name, Email, and Mobile Number are required.");
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const res = await fetch("/api/create-incharge", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           empId: createForm.empId || "",
//           name,
//           email,
//           phone,
//           departmentName: createForm.departmentName || "",
//           departmentId: createForm.departmentId || "",
//           isClassRoomMonitor: createForm.isClassRoomMonitor,
//         }),
//       });

//       const data = await res.json();
//       if (!res.ok || !data.ok) {
//         throw new Error(data.error || "Failed to create incharge");
//       }

//       // Store in the correct subcollection: activeIncharge OR classroomMonitor
//       if (db) {
//         const subcollectionName = createForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge";
//         const centralCol = firestoreHelpers.collection(
//           db,
//           "users",
//           "crtActiveIncharge",
//           subcollectionName
//         );
//         await firestoreHelpers.addDoc(centralCol, {
//           userId: data.uid || null,
//           empId: createForm.empId || "",
//           name,
//           email,
//           phone,
//           departmentName: createForm.departmentName || "",
//           departmentId: createForm.departmentId || "",
//           role: createForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge",
//           isIncharge: true,
//           createdAt: new Date().toISOString(),
//         });

//         await syncAssignedClasses({
//           inchargeId: data.uid || null,
//           inchargeEmail: email,
//           inchargeName: name,
//           isClassRoomMonitor: createForm.isClassRoomMonitor,
//           selectedClassIds: createForm.assignedClassIds,
//         });
//       }

//       setShowCreateModal(false);
//       setCreateForm({
//         empId: "",
//         name: "",
//         email: "",
//         phone: "",
//         departmentName: "",
//         departmentId: "",
//         isClassRoomMonitor: false,
//         assignedClassIds: [],
//       });
//       await fetchIncharges();
//       alert("Incharge saved successfully. Default password: VaweIncharge@2025");
//     } catch (err) {
//       console.error(err);
//       alert(err?.message || "Failed to save incharge. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleUpdateIncharge = async (e) => {
//     e.preventDefault();
//     if (!db || !editingIncharge) {
//       alert("Something went wrong. Please try again.");
//       return;
//     }

//     const name = editForm.name.trim();
//     const email = editForm.email.trim();
//     const phone = editForm.phone.trim();

//     if (!name || !email || !phone) {
//       alert("Name, Email, and Mobile Number are required.");
//       return;
//     }

//     const role = editForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge";
//     const newSubcollection = editForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge";
//     const oldSubcollection = editingIncharge.subcollection || "activeIncharge";

//     const payload = {
//       userId: editingIncharge.userId || null,
//       empId: editForm.empId || "",
//       name,
//       email,
//       phone,
//       departmentName: editForm.departmentName || "",
//       departmentId: editForm.departmentId || "",
//       role,
//       isIncharge: true,
//     };

//     setUpdating(true);
//     try {
//       if (newSubcollection === oldSubcollection) {
//         const docRef = firestoreHelpers.doc(
//           db,
//           "users",
//           "crtActiveIncharge",
//           oldSubcollection,
//           editingIncharge.id
//         );
//         await firestoreHelpers.updateDoc(docRef, payload);
//       } else {
//         const oldRef = firestoreHelpers.doc(
//           db,
//           "users",
//           "crtActiveIncharge",
//           oldSubcollection,
//           editingIncharge.id
//         );
//         await firestoreHelpers.deleteDoc(oldRef);

//         const newCol = firestoreHelpers.collection(
//           db,
//           "users",
//           "crtActiveIncharge",
//           newSubcollection
//         );
//         await firestoreHelpers.addDoc(newCol, {
//           ...payload,
//           createdAt: new Date().toISOString(),
//         });
//       }

//       if (editingIncharge.userId) {
//         const userDoc = firestoreHelpers.doc(db, "users", editingIncharge.userId);
//         const perUserInchargeDoc = firestoreHelpers.doc(
//           db,
//           "users",
//           editingIncharge.userId,
//           "incharges",
//           "primary"
//         );
//         await Promise.all([
//           firestoreHelpers.updateDoc(userDoc, payload).catch(() => {}),
//           firestoreHelpers.updateDoc(perUserInchargeDoc, payload).catch(() => {}),
//         ]);
//       }

//       await syncAssignedClasses({
//         inchargeId: editingIncharge.userId || null,
//         inchargeEmail: email || editingIncharge.email || "",
//         inchargeName: name,
//         isClassRoomMonitor: editForm.isClassRoomMonitor,
//         selectedClassIds: editForm.assignedClassIds,
//       });

//       await fetchIncharges();
//       closeEditModal();
//       alert("Incharge updated successfully.");
//     } catch (err) {
//       console.error(err);
//       alert("Failed to update incharge. Please try again.");
//     } finally {
//       setUpdating(false);
//     }
//   };

//   const handleDeleteIncharge = async (u) => {
//     if (!db) return;
//     const confirmed = window.confirm(
//       `Are you sure you want to delete incharge "${u.name || u.email || u.id}"?`
//     );
//     if (!confirmed) return;

//     try {
//       // Delete from the correct subcollection (activeIncharge or classroomMonitor)
//       const subcollection = u.subcollection || "activeIncharge";
//       const centralDoc = firestoreHelpers.doc(
//         db,
//         "users",
//         "crtActiveIncharge",
//         subcollection,
//         u.id
//       );

//       const ops = [firestoreHelpers.deleteDoc(centralDoc)];

//       if (u.userId) {
//         const userDoc = firestoreHelpers.doc(db, "users", u.userId);
//         const perUserInchargeDoc = firestoreHelpers.doc(
//           db,
//           "users",
//           u.userId,
//           "incharges",
//           "primary"
//         );
//         ops.push(
//           firestoreHelpers.deleteDoc(perUserInchargeDoc).catch(() => {}),
//           firestoreHelpers.deleteDoc(userDoc).catch(() => {})
//         );
//       }

//       ops.push(clearAssignedClasses({ inchargeId: u.userId || null, inchargeEmail: u.email || "" }));

//       await Promise.all(ops);
//       await fetchIncharges();
//       alert("Incharge deleted.");
//     } catch (err) {
//       console.error(err);
//       alert("Failed to delete incharge. Please try again.");
//     }
//   };

//   const filtered = incharges.filter(
//     (u) =>
//       !search.trim() ||
//       (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
//       (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
//       (u.phone || "").includes(search)
//   );

//   const toggleCreateClassAssignment = (classId, checked) => {
//     setCreateForm((prev) => {
//       const current = new Set(prev.assignedClassIds || []);
//       if (checked) current.add(classId);
//       else current.delete(classId);
//       return { ...prev, assignedClassIds: Array.from(current) };
//     });
//   };

//   const toggleEditClassAssignment = (classId, checked) => {
//     setEditForm((prev) => {
//       const current = new Set(prev.assignedClassIds || []);
//       if (checked) current.add(classId);
//       else current.delete(classId);
//       return { ...prev, assignedClassIds: Array.from(current) };
//     });
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50">
//         <div className="flex flex-col items-center gap-5">
//           <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
//           <p className="text-sm text-slate-500 font-medium">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!user || !isAdmin) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
//         <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
//           <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
//           <p className="text-slate-600 mb-8">Admin access required.</p>
//           <button
//             onClick={() => router.push("/")}
//             className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
//           >
//             Go to Home
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="mx-auto px-4 py-10 w-full">
//         <div className="mb-8 flex flex-col gap-4">
//           <div className="flex items-center gap-3">
//             <Link
//               href="/Admin/crt"
//               className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors w-fit"
//             >
//               <ArrowLeft className="w-4 h-4" />
//               Back to CRT Admin
//             </Link>
//           </div>
//           <div>
//             <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
//               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
//                 <UserCheck className="w-6 h-6 text-white" />
//               </div>
//               Active Incharge
//             </h1>
//             <p className="text-slate-600 mt-1">
//               View and manage active incharge users for CRT programs.
//             </p>
//           </div>
//         </div>

//         <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
//           <div className="relative flex-1 max-w-sm">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//             <input
//               type="text"
//               placeholder="Search by name, email, or phone..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//             />
//           </div>
//           <div className="flex items-center gap-2">
//             <button
//               onClick={fetchIncharges}
//               disabled={loadingIncharges}
//               className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50"
//             >
//               <RefreshCw className={`w-4 h-4 ${loadingIncharges ? "animate-spin" : ""}`} />
//               Refresh
//             </button>
//             <button
//               type="button"
//               onClick={openCreateModal}
//               className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-medium transition-colors"
//             >
//               + Create Incharge
//             </button>
//           </div>
//         </div>

//         <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
//           {loadingIncharges ? (
//             <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
//               <div className="w-10 h-10 rounded-lg border-2 border-[#00448a] border-t-transparent animate-spin" />
//               <p className="text-sm font-medium">Loading incharges...</p>
//             </div>
//           ) : filtered.length === 0 ? (
//             <div className="p-12 text-center text-slate-500">
//               <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
//               <p className="font-medium">
//                 {incharges.length === 0
//                   ? "No active incharges found."
//                   : "No matching incharges for your search."}
//               </p>
//               <p className="text-sm mt-1">
//                 Active incharges are stored in{" "}
//                 <code className="bg-slate-100 px-1 rounded">activeIncharge</code>; class room
//                 monitors in <code className="bg-slate-100 px-1 rounded">classroomMonitor</code>.
//               </p>
//             </div>
//           ) : (
//             <div className="p-4">
//               <table className="w-full table-auto text-sm">
//                 <thead className="bg-slate-50 border-b border-slate-200">
//                   <tr>
//                     <th className="px-3 py-2 text-center font-semibold text-slate-600 text-xs uppercase tracking-wide w-12">
//                       S.No
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
//                       Employee ID
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
//                       Name
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
//                       Email
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
//                       Mobile Number
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
//                       Department
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
//                       Department ID
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
//                       Job Role
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
//                       Assigned Classes
//                     </th>
//                     <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {filtered.map((u, i) => (
//                     <motion.tr
//                       key={u.id}
//                       initial={{ opacity: 0, y: 6 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       transition={{ delay: i * 0.02 }}
//                       className="hover:bg-slate-50"
//                     >
//                       <td className="px-3 py-2 text-slate-700 text-center">{i + 1}</td>
//                       <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
//                         {u.empId || "\u2014"}
//                       </td>
//                       <td className="px-3 py-2 text-slate-900 font-medium">
//                         {u.name || "\u2014"}
//                       </td>
//                       <td className="px-3 py-2 text-slate-700">
//                         <div className="flex items-center gap-1.5 min-w-[160px]">
//                           <Mail className="w-3.5 h-3.5 text-slate-400" />
//                           <span>{u.email || "\u2014"}</span>
//                         </div>
//                       </td>
//                       <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
//                         {u.phone ? (
//                           <div className="flex items-center gap-1.5">
//                             <Phone className="w-3.5 h-3.5 text-slate-400" />
//                             <span>{u.phone}</span>
//                           </div>
//                         ) : (
//                           "\u2014"
//                         )}
//                       </td>
//                       <td className="px-3 py-2 text-slate-700">
//                         {u.departmentName || "\u2014"}
//                       </td>
//                       <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
//                         {u.departmentId || "\u2014"}
//                       </td>
//                       <td className="px-3 py-3">
//                         <span
//                           className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
//                             normalizeInchargeRole(u.role, u.subcollection) === "classroomMonitor"
//                               ? "bg-emerald-100 text-emerald-700"
//                               : normalizeInchargeRole(u.role, u.subcollection) === "activeIncharge"
//                               ? "bg-sky-100 text-sky-700"
//                               : "bg-slate-100 text-slate-700"
//                           }`}
//                         >
//                           {inchargeRoleLabel(u.role)}
//                         </span>
//                       </td>
//                       <td className="px-3 py-2 text-slate-700 min-w-[220px]">
//                         {Array.isArray(u.assignedClasses) && u.assignedClasses.length > 0 ? (
//                           <div className="flex flex-wrap gap-1.5">
//                             {u.assignedClasses.map((cls) => (
//                               <span
//                                 key={`${u.id}-${cls.classId}`}
//                                 className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
//                               >
//                                 {cls.label}
//                               </span>
//                             ))}
//                           </div>
//                         ) : (
//                           <span className="text-slate-400">No classes assigned</span>
//                         )}
//                       </td>
//                       <td className="px-3 py-2 text-slate-700">
//                         <div className="flex items-center gap-2">
//                           <button
//                             type="button"
//                             onClick={() => openEditModal(u)}
//                             className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
//                           >
//                             Edit
//                           </button>
//                           <button
//                             type="button"
//                             onClick={() => handleDeleteIncharge(u)}
//                             className="px-3 py-1 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50"
//                           >
//                             Delete
//                           </button>
//                         </div>
//                       </td>
//                     </motion.tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>

//         {showCreateModal && (
//           <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
//             <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl">
//               <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
//                 <h2 className="text-lg font-semibold text-slate-900">Create Active Incharge</h2>
//                 <button
//                   type="button"
//                   onClick={closeCreateModal}
//                   className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
//                 >
//                   <X className="w-4 h-4" />
//                 </button>
//               </div>
//               <form onSubmit={handleCreateIncharge} className="px-6 py-5 space-y-4">
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Employee ID
//                     </label>
//                     <input
//                       type="text"
//                       value={createForm.empId}
//                       onChange={(e) => updateForm("empId", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="EMP001"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Name *
//                     </label>
//                     <input
//                       type="text"
//                       value={createForm.name}
//                       onChange={(e) => updateForm("name", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="Full name"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Email *
//                     </label>
//                     <input
//                       type="email"
//                       value={createForm.email}
//                       onChange={(e) => updateForm("email", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="name@example.com"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Mobile Number *
//                     </label>
//                     <input
//                       type="tel"
//                       value={createForm.phone}
//                       onChange={(e) => updateForm("phone", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="10-digit number"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Department Name
//                     </label>
//                     <input
//                       type="text"
//                       value={createForm.departmentName}
//                       onChange={(e) => updateForm("departmentName", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="Department name"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Department ID (optional)
//                     </label>
//                     <input
//                       type="text"
//                       value={createForm.departmentId}
//                       onChange={(e) => updateForm("departmentId", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="Dept ID"
//                     />
//                   </div>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <input
//                     id="class-room-monitor"
//                     type="checkbox"
//                     checked={createForm.isClassRoomMonitor}
//                     onChange={(e) => updateForm("isClassRoomMonitor", e.target.checked)}
//                     className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
//                   />
//                   <label
//                     htmlFor="class-room-monitor"
//                     className="text-sm text-slate-700 select-none"
//                   >
//                     Job Role: <span className="font-semibold">Class room monitor</span> (optional)
//                   </label>
//                 </div>
//                 <p className="text-xs text-slate-500">
//                   If not checked, job role will be saved as{" "}
//                   <span className="font-semibold">activeIncharge</span>.
//                 </p>

//                 <div>
//                   <p className="text-sm font-medium text-slate-700 mb-2">
//                     Assign Classes ({createForm.isClassRoomMonitor ? "Class Room Monitor" : "Active Incharge"})
//                   </p>
//                   {loadingClasses ? (
//                     <p className="text-xs text-slate-500">Loading classes...</p>
//                   ) : classes.length === 0 ? (
//                     <p className="text-xs text-slate-500">No classes found.</p>
//                   ) : (
//                     <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
//                       {classes.map((cls) => (
//                         <label key={cls.id} className="flex items-center gap-2 text-sm text-slate-700">
//                           <input
//                             type="checkbox"
//                             checked={(createForm.assignedClassIds || []).includes(cls.id)}
//                             onChange={(e) => toggleCreateClassAssignment(cls.id, e.target.checked)}
//                             className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
//                           />
//                           <span>{classLabel(cls)}</span>
//                         </label>
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 <div className="flex justify-end gap-3 pt-2">
//                   <button
//                     type="button"
//                     onClick={closeCreateModal}
//                     className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={submitting}
//                     className="px-5 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60"
//                   >
//                     {submitting ? "Saving..." : "Save Incharge"}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         )}

//         {editingIncharge && (
//           <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
//             <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl">
//               <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
//                 <h2 className="text-lg font-semibold text-slate-900">Edit Incharge</h2>
//                 <button
//                   type="button"
//                   onClick={closeEditModal}
//                   className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
//                 >
//                   <X className="w-4 h-4" />
//                 </button>
//               </div>
//               <form onSubmit={handleUpdateIncharge} className="px-6 py-5 space-y-4">
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Employee ID
//                     </label>
//                     <input
//                       type="text"
//                       value={editForm.empId}
//                       onChange={(e) => updateEditForm("empId", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="EMP001"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Name *
//                     </label>
//                     <input
//                       type="text"
//                       value={editForm.name}
//                       onChange={(e) => updateEditForm("name", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="Full name"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Email *
//                     </label>
//                     <input
//                       type="email"
//                       value={editForm.email}
//                       onChange={(e) => updateEditForm("email", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="name@example.com"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Mobile Number *
//                     </label>
//                     <input
//                       type="tel"
//                       value={editForm.phone}
//                       onChange={(e) => updateEditForm("phone", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="10-digit number"
//                       required
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Department Name
//                     </label>
//                     <input
//                       type="text"
//                       value={editForm.departmentName}
//                       onChange={(e) => updateEditForm("departmentName", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="Department name"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-slate-600 mb-1">
//                       Department ID (optional)
//                     </label>
//                     <input
//                       type="text"
//                       value={editForm.departmentId}
//                       onChange={(e) => updateEditForm("departmentId", e.target.value)}
//                       className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
//                       placeholder="Dept ID"
//                     />
//                   </div>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <input
//                     id="edit-class-room-monitor"
//                     type="checkbox"
//                     checked={editForm.isClassRoomMonitor}
//                     onChange={(e) => updateEditForm("isClassRoomMonitor", e.target.checked)}
//                     className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
//                   />
//                   <label
//                     htmlFor="edit-class-room-monitor"
//                     className="text-sm text-slate-700 select-none"
//                   >
//                     Job Role: <span className="font-semibold">Class room monitor</span> (optional)
//                   </label>
//                 </div>
//                 <p className="text-xs text-slate-500">
//                   If not checked, job role will be saved as{" "}
//                   <span className="font-semibold">activeIncharge</span>.
//                 </p>

//                 <div>
//                   <p className="text-sm font-medium text-slate-700 mb-2">
//                     Assign Classes ({editForm.isClassRoomMonitor ? "Class Room Monitor" : "Active Incharge"})
//                   </p>
//                   {loadingClasses ? (
//                     <p className="text-xs text-slate-500">Loading classes...</p>
//                   ) : classes.length === 0 ? (
//                     <p className="text-xs text-slate-500">No classes found.</p>
//                   ) : (
//                     <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
//                       {classes.map((cls) => (
//                         <label key={cls.id} className="flex items-center gap-2 text-sm text-slate-700">
//                           <input
//                             type="checkbox"
//                             checked={(editForm.assignedClassIds || []).includes(cls.id)}
//                             onChange={(e) => toggleEditClassAssignment(cls.id, e.target.checked)}
//                             className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
//                           />
//                           <span>{classLabel(cls)}</span>
//                         </label>
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 <div className="flex justify-end gap-3 pt-2">
//                   <button
//                     type="button"
//                     onClick={closeEditModal}
//                     className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={updating}
//                     className="px-5 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60"
//                   >
//                     {updating ? "Updating..." : "Update Incharge"}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }




"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { db, firestoreHelpers, isFirebaseConfigured } from "../../../../lib/firebase";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "../../AdminAccessContext";
import { motion } from "framer-motion";
import { ArrowLeft, UserCheck, Search, RefreshCw, Mail, Phone, X } from "lucide-react";
import {
  crtInchargeAssignedClassesCollectionSegments,
  crtInchargeDocSegments,
  crtInchargeSubcollectionSegments,
} from "@/lib/collegeTenantFirestore";

const DEFAULT_INCHARGE_PASSWORD = "VaweIncharge@2025";

function isIncharge(u) {
  const role = (u.role || "").toLowerCase();
  return (
    role === "crtincharge" ||
    role === "incharge" ||
    role === "classroommonitor" ||
    role === "activeincharge" ||
    role === "class room monitor" ||
    role === "assignment incharge" ||
    u.isIncharge === true
  );
}

function normalizeInchargeRole(role, subcollection) {
  const value = (role || "").toLowerCase().trim();
  if (
    value === "classroommonitor" ||
    value === "class room monitor" ||
    subcollection === "classroomMonitor"
  ) {
    return "classroomMonitor";
  }
  return "activeIncharge";
}

function inchargeRoleLabel(role) {
  return normalizeInchargeRole(role) === "classroomMonitor"
    ? "Class Room Monitor"
    : "Activity Incharge";
}

export default function ActiveInchargePage() {
  const router = useRouter();
  const { user, loading, hasCrtManagerAccess: isAdmin, collegeSubdomain } = useAdminAccess();
  const [incharges, setIncharges] = useState([]);

  // 🔥 Changed from classes -> batches
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [loadingIncharges, setLoadingIncharges] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingIncharge, setEditingIncharge] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [createForm, setCreateForm] = useState({
    empId: "",
    name: "",
    email: "",
    phone: "",
    departmentName: "",
    departmentId: "",
    isClassRoomMonitor: false,
    assignedBatchIds: [],
  });

  const [editForm, setEditForm] = useState({
    empId: "",
    name: "",
    email: "",
    phone: "",
    departmentName: "",
    departmentId: "",
    isClassRoomMonitor: false,
    assignedBatchIds: [],
  });

  const updateForm = (key, value) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateEditForm = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  // 🔥 Batch label
  const batchLabel = (batch) => {
    const name =
      batch?.name ||
      batch?.names ||
      batch?.batchName ||
      batch?.className ||
      batch?.title ||
      "Unnamed Batch";
    const section = batch?.section ? ` - ${batch.section}` : "";
    return `${name}${section}`;
  };

  const getInchargeRoleValue = (isClassRoomMonitor) =>
    isClassRoomMonitor ? "class room monitor" : "assignment incharge";

  const buildAssignedBatchRefs = (batchIds = []) => {
    const batchMap = new Map(batches.map((b) => [b.id, b]));
    return Array.from(new Set((batchIds || []).filter(Boolean))).map((batchId) => {
      const batch = batchMap.get(batchId) || {};
      const crtId = batch.crtId || "";
      const parentBathesId = batch.parentBathesId || "";
      const bathesPath = parentBathesId
        ? `crt/${crtId}/bathes/${parentBathesId}/baths/${batchId}`
        : `crt/${crtId}/batches/${batchId}`;
      return {
        crtId,
        batchId,
        batchPath: bathesPath,
        studentsPath: `${bathesPath}/students`,
      };
    });
  };

  // 🔥 Fetch from all CRT IDs:
  // crt/{crtId}/batches
  // crt/{crtId}/bathes/{bathesId}/baths
  const fetchBatches = useCallback(async () => {
    if (!db) return;
    setLoadingBatches(true);
    try {
      const crtSnap = await firestoreHelpers.getDocs(firestoreHelpers.collection(db, "crt"));
      const all = [];

      for (const crtDoc of crtSnap.docs) {
        const crtId = crtDoc.id;

        const directBatchesSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "crt", crtId, "batches")
        );
        directBatchesSnap.docs.forEach((d) => {
          all.push({
            id: d.id,
            crtId,
            source: "batches",
            ...d.data(),
          });
        });

        const bathesSnap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "crt", crtId, "bathes")
        );
        for (const bathesDoc of bathesSnap.docs) {
          const bathesId = bathesDoc.id;
          const bathsSnap = await firestoreHelpers.getDocs(
            firestoreHelpers.collection(db, "crt", crtId, "bathes", bathesId, "baths")
          );
          bathsSnap.docs.forEach((d) => {
            all.push({
              id: d.id,
              crtId,
              parentBathesId: bathesId,
              source: "bathes/baths",
              ...d.data(),
            });
          });
        }
      }

      const unique = [];
      const seen = new Set();
      for (const row of all) {
        const key = `${row.crtId}::${row.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(row);
        }
      }

      const list = unique.sort((a, b) => batchLabel(a).localeCompare(batchLabel(b)));

      setBatches(list);
    } catch (err) {
      console.error(err);
      alert("Failed to load batches.");
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  // 🔥 Sync assigned batches into top-level assignedClasses collection
  const syncAssignedBatches = useCallback(
    async ({
      inchargeId,
      inchargeEmail,
      inchargeName,
      isClassRoomMonitor,
      selectedBatchIds,
    }) => {
      if (!db) return;
      if (!inchargeId && !inchargeEmail) return;

      const safeEmail = (inchargeEmail || "").toLowerCase().trim();
      const batchMap = new Map(batches.map((b) => [b.id, b]));
      const selectedIds = Array.isArray(selectedBatchIds)
        ? Array.from(new Set(selectedBatchIds.filter(Boolean)))
        : [];

      const queries = [];

      if (inchargeId) {
        queries.push(
          firestoreHelpers.getDocs(
            collegeSubdomain
              ? firestoreHelpers.query(
                  firestoreHelpers.collection(db, "assignedClasses"),
                  firestoreHelpers.where("collegeSubdomain", "==", collegeSubdomain),
                  firestoreHelpers.where("inchargeId", "==", inchargeId)
                )
              : firestoreHelpers.query(
                  firestoreHelpers.collection(db, "assignedClasses"),
                  firestoreHelpers.where("inchargeId", "==", inchargeId)
                )
          )
        );
      }

      if (safeEmail) {
        queries.push(
          firestoreHelpers.getDocs(
            collegeSubdomain
              ? firestoreHelpers.query(
                  firestoreHelpers.collection(db, "assignedClasses"),
                  firestoreHelpers.where("collegeSubdomain", "==", collegeSubdomain),
                  firestoreHelpers.where("inchargeEmail", "==", safeEmail)
                )
              : firestoreHelpers.query(
                  firestoreHelpers.collection(db, "assignedClasses"),
                  firestoreHelpers.where("inchargeEmail", "==", safeEmail)
                )
          )
        );
      }

      const snapshots = await Promise.all(queries);

      const existingDocs = [];
      snapshots.forEach((snap) => {
        snap.docs.forEach((docSnap) => {
          if (!existingDocs.find((x) => x.id === docSnap.id)) {
            existingDocs.push(docSnap);
          }
        });
      });

      const existingByBatchId = new Map(
        existingDocs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((row) => row.batchId || row.classId)
          .map((row) => [row.batchId || row.classId, row])
      );

      const role = getInchargeRoleValue(isClassRoomMonitor);
      const now = new Date().toISOString();

      // Create / Update selected batch assignments
      for (const batchId of selectedIds) {
        const b = batchMap.get(batchId) || {};

        const payload = {
          inchargeId: inchargeId || null,
          inchargeEmail: safeEmail,
          inchargeName: inchargeName || "",
          role,

          // 🔥 keep backward compatibility
          classId: batchId,
          className: b.name || b.batchName || b.className || b.title || batchId,

          // 🔥 proper batch fields
          batchId,
          batchName: b.name || b.batchName || b.className || b.title || batchId,
          crtId: b.crtId || "",

          section: b.section || "",
          departmentName: b.departmentName || b.department || "",
          departmentId: b.departmentId || "",
          updatedAt: now,
          ...(collegeSubdomain ? { collegeSubdomain } : {}),
        };

        const existing = existingByBatchId.get(batchId);

        if (existing?.id) {
          const docRef = firestoreHelpers.doc(db, "assignedClasses", existing.id);
          await firestoreHelpers.updateDoc(docRef, payload);
        } else {
          const colRef = firestoreHelpers.collection(db, "assignedClasses");
          await firestoreHelpers.addDoc(colRef, {
            ...payload,
            createdAt: now,
          });
        }
      }

      // Delete removed batch assignments
      for (const existing of existingByBatchId.values()) {
        const existingBatchId = existing.batchId || existing.classId;
        if (!selectedIds.includes(existingBatchId)) {
          const docRef = firestoreHelpers.doc(db, "assignedClasses", existing.id);
          await firestoreHelpers.deleteDoc(docRef);
        }
      }
    },
    [batches, collegeSubdomain]
  );

  const syncAssignedBatchesInInchargeDoc = useCallback(
    async ({
      subcollectionName,
      inchargeDocId,
      inchargeId,
      inchargeEmail,
      inchargeName,
      isClassRoomMonitor,
      selectedBatchIds,
    }) => {
      if (!db || !subcollectionName || !inchargeDocId) return;

      const safeEmail = (inchargeEmail || "").toLowerCase().trim();
      const batchMap = new Map(batches.map((b) => [b.id, b]));
      const selectedIds = Array.isArray(selectedBatchIds)
        ? Array.from(new Set(selectedBatchIds.filter(Boolean)))
        : [];

      const assignedCol = firestoreHelpers.collection(
        db,
        ...crtInchargeAssignedClassesCollectionSegments(
          collegeSubdomain,
          subcollectionName,
          inchargeDocId
        )
      );
      const existingSnap = await firestoreHelpers.getDocs(assignedCol);
      const existingByBatchId = new Map(
        existingSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((row) => row.batchId || row.classId)
          .map((row) => [row.batchId || row.classId, row])
      );

      const role = getInchargeRoleValue(isClassRoomMonitor);
      const now = new Date().toISOString();

      for (const batchId of selectedIds) {
        const b = batchMap.get(batchId) || {};
        const payload = {
          inchargeId: inchargeId || null,
          inchargeEmail: safeEmail,
          inchargeName: inchargeName || "",
          role,
          classId: batchId,
          className: b.name || b.names || b.batchName || b.className || b.title || batchId,
          batchId,
          batchName: b.name || b.names || b.batchName || b.className || b.title || batchId,
          crtId: b.crtId || "",
          section: b.section || "",
          departmentName: b.departmentName || b.department || "",
          departmentId: b.departmentId || "",
          updatedAt: now,
        };

        const existing = existingByBatchId.get(batchId);
        if (existing?.id) {
          await firestoreHelpers.updateDoc(
            firestoreHelpers.doc(
              db,
              ...crtInchargeAssignedClassesCollectionSegments(
                collegeSubdomain,
                subcollectionName,
                inchargeDocId
              ),
              existing.id
            ),
            payload
          );
        } else {
          await firestoreHelpers.addDoc(assignedCol, {
            ...payload,
            createdAt: now,
          });
        }
      }

      for (const existing of existingByBatchId.values()) {
        const existingBatchId = existing.batchId || existing.classId;
        if (!selectedIds.includes(existingBatchId)) {
          await firestoreHelpers.deleteDoc(
            firestoreHelpers.doc(
              db,
              ...crtInchargeAssignedClassesCollectionSegments(
                collegeSubdomain,
                subcollectionName,
                inchargeDocId
              ),
              existing.id
            )
          );
        }
      }
    },
    [batches, collegeSubdomain]
  );

  const clearAssignedBatchesInInchargeDoc = useCallback(
    async ({ subcollectionName, inchargeDocId }) => {
      if (!db || !subcollectionName || !inchargeDocId) return;
      const assignedCol = firestoreHelpers.collection(
        db,
        ...crtInchargeAssignedClassesCollectionSegments(
          collegeSubdomain,
          subcollectionName,
          inchargeDocId
        )
      );
      const snap = await firestoreHelpers.getDocs(assignedCol);
      await Promise.all(
        snap.docs.map((d) =>
          firestoreHelpers.deleteDoc(
            firestoreHelpers.doc(
              db,
              ...crtInchargeAssignedClassesCollectionSegments(
                collegeSubdomain,
                subcollectionName,
                inchargeDocId
              ),
              d.id
            )
          )
        )
      );
    },
    [collegeSubdomain]
  );

  const clearAssignedBatches = useCallback(async ({ inchargeId, inchargeEmail }) => {
    if (!db) return;
    if (!inchargeId && !inchargeEmail) return;

    const safeEmail = (inchargeEmail || "").toLowerCase().trim();
    const queries = [];

    if (inchargeId) {
      queries.push(
        firestoreHelpers.getDocs(
          collegeSubdomain
            ? firestoreHelpers.query(
                firestoreHelpers.collection(db, "assignedClasses"),
                firestoreHelpers.where("collegeSubdomain", "==", collegeSubdomain),
                firestoreHelpers.where("inchargeId", "==", inchargeId)
              )
            : firestoreHelpers.query(
                firestoreHelpers.collection(db, "assignedClasses"),
                firestoreHelpers.where("inchargeId", "==", inchargeId)
              )
        )
      );
    }

    if (safeEmail) {
      queries.push(
        firestoreHelpers.getDocs(
          collegeSubdomain
            ? firestoreHelpers.query(
                firestoreHelpers.collection(db, "assignedClasses"),
                firestoreHelpers.where("collegeSubdomain", "==", collegeSubdomain),
                firestoreHelpers.where("inchargeEmail", "==", safeEmail)
              )
            : firestoreHelpers.query(
                firestoreHelpers.collection(db, "assignedClasses"),
                firestoreHelpers.where("inchargeEmail", "==", safeEmail)
              )
        )
      );
    }

    const snapshots = await Promise.all(queries);
    const ids = new Set();

    snapshots.forEach((snap) => snap.docs.forEach((d) => ids.add(d.id)));

    await Promise.all(
      Array.from(ids).map((id) =>
        firestoreHelpers.deleteDoc(firestoreHelpers.doc(db, "assignedClasses", id))
      )
    );
  }, [collegeSubdomain]);

  const fetchIncharges = useCallback(async () => {
    if (!db) return;
    setLoadingIncharges(true);
    try {
      // 1. activeIncharge subcollection
      const activeSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...crtInchargeSubcollectionSegments(collegeSubdomain, "activeIncharge")
        )
      );
      const assignmentList = activeSnap.docs.map((d) => ({
        id: d.id,
        subcollection: "activeIncharge",
        ...d.data(),
        role: normalizeInchargeRole(d.data()?.role, "activeIncharge"),
      }));

      // 2. classroomMonitor subcollection
      const classroomSnap = await firestoreHelpers.getDocs(
        firestoreHelpers.collection(
          db,
          ...crtInchargeSubcollectionSegments(collegeSubdomain, "classroomMonitor")
        )
      );
      const classroomList = classroomSnap.docs.map((d) => ({
        id: d.id,
        subcollection: "classroomMonitor",
        ...d.data(),
        role: normalizeInchargeRole(d.data()?.role, "classroomMonitor"),
      }));

      // 3. Fetch assigned batches from top-level assignedClasses
      const assignedSnap = await firestoreHelpers.getDocs(
        collegeSubdomain
          ? firestoreHelpers.query(
              firestoreHelpers.collection(db, "assignedClasses"),
              firestoreHelpers.where("collegeSubdomain", "==", collegeSubdomain)
            )
          : firestoreHelpers.collection(db, "assignedClasses")
      );

      const assignmentsByInchargeId = new Map();
      const assignmentsByEmail = new Map();

      assignedSnap.docs.forEach((d) => {
        const row = d.data() || {};

        const batchId = row.batchId || row.classId || d.id;
        const batchName = row.batchName || row.className || "Unnamed Batch";
        const section = row.section ? ` - ${row.section}` : "";
        const label = `${batchName}${section}`;

        const assignment = { batchId, label };

        if (row.inchargeId) {
          const current = assignmentsByInchargeId.get(row.inchargeId) || [];
          if (!current.some((x) => x.batchId === batchId)) {
            assignmentsByInchargeId.set(row.inchargeId, [...current, assignment]);
          }
        }

        if (row.inchargeEmail) {
          const emailKey = String(row.inchargeEmail).toLowerCase();
          const current = assignmentsByEmail.get(emailKey) || [];
          if (!current.some((x) => x.batchId === batchId)) {
            assignmentsByEmail.set(emailKey, [...current, assignment]);
          }
        }
      });

      const list = [...assignmentList, ...classroomList].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );

      const enriched = list.map((row) => {
        const byId = row.userId ? assignmentsByInchargeId.get(row.userId) || [] : [];
        const byEmail = row.email
          ? assignmentsByEmail.get(String(row.email).toLowerCase()) || []
          : [];

        const assignedBatches = [...byId];
        byEmail.forEach((entry) => {
          if (!assignedBatches.some((x) => x.batchId === entry.batchId)) {
            assignedBatches.push(entry);
          }
        });

        return { ...row, assignedBatches };
      });

      setIncharges(enriched);
    } catch (err) {
      console.error(err);
      alert("Failed to load activity incharges.");
    } finally {
      setLoadingIncharges(false);
    }
  }, [collegeSubdomain]);

  useEffect(() => {
    if (user && isAdmin && isFirebaseConfigured) {
      fetchIncharges();
      fetchBatches();
    }
  }, [user, isAdmin, fetchIncharges, fetchBatches]);

  const openCreateModal = () => {
    setCreateForm({
      empId: "",
      name: "",
      email: "",
      phone: "",
      departmentName: "",
      departmentId: "",
      isClassRoomMonitor: false,
      assignedBatchIds: [],
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const openEditModal = (u) => {
    const role = normalizeInchargeRole(u.role, u.subcollection);
    const assignedBatchIds = Array.isArray(u.assignedBatchIds)
      ? u.assignedBatchIds.filter(Boolean)
      : Array.isArray(u.assignedBatchRefs)
      ? u.assignedBatchRefs.map((x) => x?.batchId).filter(Boolean)
      : Array.isArray(u.assignedBatches)
      ? u.assignedBatches.map((x) => x.batchId).filter(Boolean)
      : [];
    setEditingIncharge(u);
    setEditForm({
      empId: u.empId || "",
      name: u.name || "",
      email: u.email || "",
      phone: u.phone || "",
      departmentName: u.departmentName || "",
      departmentId: u.departmentId || "",
      isClassRoomMonitor: role === "classroomMonitor",
      assignedBatchIds,
    });
  };

  const closeEditModal = () => {
    setEditingIncharge(null);
    setEditForm({
      empId: "",
      name: "",
      email: "",
      phone: "",
      departmentName: "",
      departmentId: "",
      isClassRoomMonitor: false,
      assignedBatchIds: [],
    });
  };

  const handleCreateIncharge = async (e) => {
    e.preventDefault();

    const name = createForm.name.trim();
    const email = createForm.email.trim();
    const phone = createForm.phone.trim();

    if (!name || !email || !phone) {
      alert("Name, Email, and Mobile Number are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/create-incharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: createForm.empId || "",
          name,
          email,
          phone,
          departmentName: createForm.departmentName || "",
          departmentId: createForm.departmentId || "",
          isClassRoomMonitor: createForm.isClassRoomMonitor,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create incharge");
      }

      if (db) {
        const subcollectionName = createForm.isClassRoomMonitor
          ? "classroomMonitor"
          : "activeIncharge";

        const centralCol = firestoreHelpers.collection(
          db,
          ...crtInchargeSubcollectionSegments(collegeSubdomain, subcollectionName)
        );

        const centralDocRef = await firestoreHelpers.addDoc(centralCol, {
          userId: data.uid || null,
          empId: createForm.empId || "",
          name,
          email,
          phone,
          departmentName: createForm.departmentName || "",
          departmentId: createForm.departmentId || "",
          role: createForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge",
          assignedBatchIds: createForm.assignedBatchIds || [],
          assignedBatchRefs: buildAssignedBatchRefs(createForm.assignedBatchIds),
          isIncharge: true,
          createdAt: new Date().toISOString(),
        });

        if (collegeSubdomain && data.uid) {
          await firestoreHelpers.setDoc(
            firestoreHelpers.doc(db, "users", data.uid),
            { collegeSubdomain },
            { merge: true }
          );
        }

        await syncAssignedBatches({
          inchargeId: data.uid || null,
          inchargeEmail: email,
          inchargeName: name,
          isClassRoomMonitor: createForm.isClassRoomMonitor,
          selectedBatchIds: createForm.assignedBatchIds,
        });

        await syncAssignedBatchesInInchargeDoc({
          subcollectionName,
          inchargeDocId: centralDocRef.id,
          inchargeId: data.uid || null,
          inchargeEmail: email,
          inchargeName: name,
          isClassRoomMonitor: createForm.isClassRoomMonitor,
          selectedBatchIds: createForm.assignedBatchIds,
        });
      }

      setShowCreateModal(false);
      setCreateForm({
        empId: "",
        name: "",
        email: "",
        phone: "",
        departmentName: "",
        departmentId: "",
        isClassRoomMonitor: false,
        assignedBatchIds: [],
      });

      await fetchIncharges();
      alert(`Incharge saved successfully. Default password: ${DEFAULT_INCHARGE_PASSWORD}`);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save incharge. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateIncharge = async (e) => {
    e.preventDefault();

    if (!db || !editingIncharge) {
      alert("Something went wrong. Please try again.");
      return;
    }

    const name = editForm.name.trim();
    const email = editForm.email.trim();
    const phone = editForm.phone.trim();

    if (!name || !email || !phone) {
      alert("Name, Email, and Mobile Number are required.");
      return;
    }

    const role = editForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge";
    const newSubcollection = editForm.isClassRoomMonitor ? "classroomMonitor" : "activeIncharge";
    const oldSubcollection = editingIncharge.subcollection || "activeIncharge";

    const payload = {
      userId: editingIncharge.userId || null,
      empId: editForm.empId || "",
      name,
      email,
      phone,
      departmentName: editForm.departmentName || "",
      departmentId: editForm.departmentId || "",
      role,
      assignedBatchIds: editForm.assignedBatchIds || [],
      assignedBatchRefs: buildAssignedBatchRefs(editForm.assignedBatchIds),
      isIncharge: true,
    };

    setUpdating(true);
    try {
      let targetSubcollectionName = newSubcollection;
      let targetInchargeDocId = editingIncharge.id;

      if (newSubcollection === oldSubcollection) {
        const docRef = firestoreHelpers.doc(
          db,
          ...crtInchargeDocSegments(collegeSubdomain, oldSubcollection, editingIncharge.id)
        );
        await firestoreHelpers.updateDoc(docRef, payload);
      } else {
        await clearAssignedBatchesInInchargeDoc({
          subcollectionName: oldSubcollection,
          inchargeDocId: editingIncharge.id,
        });

        const oldRef = firestoreHelpers.doc(
          db,
          ...crtInchargeDocSegments(collegeSubdomain, oldSubcollection, editingIncharge.id)
        );
        await firestoreHelpers.deleteDoc(oldRef);

        const newCol = firestoreHelpers.collection(
          db,
          ...crtInchargeSubcollectionSegments(collegeSubdomain, newSubcollection)
        );

        const newDocRef = await firestoreHelpers.addDoc(newCol, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        targetInchargeDocId = newDocRef.id;
        targetSubcollectionName = newSubcollection;
      }

      if (editingIncharge.userId) {
        const userDoc = firestoreHelpers.doc(db, "users", editingIncharge.userId);
        const perUserInchargeDoc = firestoreHelpers.doc(
          db,
          "users",
          editingIncharge.userId,
          "incharges",
          "primary"
        );

        await Promise.all([
          firestoreHelpers.updateDoc(userDoc, payload).catch(() => {}),
          firestoreHelpers.updateDoc(perUserInchargeDoc, payload).catch(() => {}),
        ]);
      }

      await syncAssignedBatches({
        inchargeId: editingIncharge.userId || null,
        inchargeEmail: email || editingIncharge.email || "",
        inchargeName: name,
        isClassRoomMonitor: editForm.isClassRoomMonitor,
        selectedBatchIds: editForm.assignedBatchIds,
      });

      await syncAssignedBatchesInInchargeDoc({
        subcollectionName: targetSubcollectionName,
        inchargeDocId: targetInchargeDocId,
        inchargeId: editingIncharge.userId || null,
        inchargeEmail: email || editingIncharge.email || "",
        inchargeName: name,
        isClassRoomMonitor: editForm.isClassRoomMonitor,
        selectedBatchIds: editForm.assignedBatchIds,
      });

      await fetchIncharges();
      closeEditModal();
      alert("Incharge updated successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to update incharge. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteIncharge = async (u) => {
    if (!db) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete incharge "${u.name || u.email || u.id}"?`
    );
    if (!confirmed) return;

    try {
      const subcollection = u.subcollection || "activeIncharge";
      const centralDoc = firestoreHelpers.doc(
        db,
        ...crtInchargeDocSegments(collegeSubdomain, subcollection, u.id)
      );

      const ops = [firestoreHelpers.deleteDoc(centralDoc)];

      ops.push(
        clearAssignedBatchesInInchargeDoc({
          subcollectionName: subcollection,
          inchargeDocId: u.id,
        })
      );

      if (u.userId) {
        const userDoc = firestoreHelpers.doc(db, "users", u.userId);
        const perUserInchargeDoc = firestoreHelpers.doc(
          db,
          "users",
          u.userId,
          "incharges",
          "primary"
        );

        ops.push(
          firestoreHelpers.deleteDoc(perUserInchargeDoc).catch(() => {}),
          firestoreHelpers.deleteDoc(userDoc).catch(() => {})
        );
      }

      ops.push(
        clearAssignedBatches({
          inchargeId: u.userId || null,
          inchargeEmail: u.email || "",
        })
      );

      await Promise.all(ops);
      await fetchIncharges();
      alert("Incharge deleted.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete incharge. Please try again.");
    }
  };

  const filtered = incharges.filter(
    (u) =>
      !search.trim() ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || "").includes(search)
  );

  const toggleCreateBatchAssignment = (batchId, checked) => {
    setCreateForm((prev) => {
      const current = new Set(prev.assignedBatchIds || []);
      if (checked) current.add(batchId);
      else current.delete(batchId);
      return { ...prev, assignedBatchIds: Array.from(current) };
    });
  };

  const toggleEditBatchAssignment = (batchId, checked) => {
    setEditForm((prev) => {
      const current = new Set(prev.assignedBatchIds || []);
      if (checked) current.add(batchId);
      else current.delete(batchId);
      return { ...prev, assignedBatchIds: Array.from(current) };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-8">Admin access required.</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-xl hover:bg-[#003a76] transition-colors font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4 py-10 w-full">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/Admin/crt"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to CRT Admin
            </Link>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              Activity Incharge
            </h1>
            <p className="text-slate-600 mt-1">
              View and manage activity incharge users for CRT programs.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchIncharges}
              disabled={loadingIncharges}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingIncharges ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00448a] hover:bg-[#003a76] text-white font-medium transition-colors"
            >
              + Create Incharge
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loadingIncharges ? (
            <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
              <div className="w-10 h-10 rounded-lg border-2 border-[#00448a] border-t-transparent animate-spin" />
              <p className="text-sm font-medium">Loading incharges...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">
                {incharges.length === 0
                  ? "No active incharges found."
                  : "No matching incharges for your search."}
              </p>
              <p className="text-sm mt-1">
                Activity incharges are stored in{" "}
                <code className="bg-slate-100 px-1 rounded">activeIncharge</code>; class room
                monitors in <code className="bg-slate-100 px-1 rounded">classroomMonitor</code>.
              </p>
            </div>
          ) : (
            <div className="p-4 overflow-x-auto">
              <table className="w-full table-auto text-sm min-w-[1200px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600 text-xs uppercase tracking-wide w-12">
                      S.No
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                      Employee ID
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                      Mobile Number
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                      Password
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Department
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                      Department ID
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Job Role
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Assigned Batches
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 text-slate-700 text-center">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {u.empId || "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-medium">
                        {u.name || "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="flex items-center gap-1.5 min-w-[160px]">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email || "\u2014"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {u.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.phone}</span>
                          </div>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs">
                          {u.inchargePassword || DEFAULT_INCHARGE_PASSWORD}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {u.departmentName || "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {u.departmentId || "\u2014"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            normalizeInchargeRole(u.role, u.subcollection) === "classroomMonitor"
                              ? "bg-emerald-100 text-emerald-700"
                              : normalizeInchargeRole(u.role, u.subcollection) === "activeIncharge"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {inchargeRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 min-w-[220px]">
                        {Array.isArray(u.assignedBatches) && u.assignedBatches.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {u.assignedBatches.map((batch) => (
                              <span
                                key={`${u.id}-${batch.batchId}`}
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                              >
                                {batch.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">No batches assigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteIncharge(u)}
                            className="px-3 py-1 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Create Activity Incharge</h2>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateIncharge} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={createForm.empId}
                      onChange={(e) => updateForm("empId", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="EMP001"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="Full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="name@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      value={createForm.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="10-digit number"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Department Name
                    </label>
                    <input
                      type="text"
                      value={createForm.departmentName}
                      onChange={(e) => updateForm("departmentName", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="Department name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Department ID (optional)
                    </label>
                    <input
                      type="text"
                      value={createForm.departmentId}
                      onChange={(e) => updateForm("departmentId", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="Dept ID"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="class-room-monitor"
                    type="checkbox"
                    checked={createForm.isClassRoomMonitor}
                    onChange={(e) => updateForm("isClassRoomMonitor", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
                  />
                  <label htmlFor="class-room-monitor" className="text-sm text-slate-700 select-none">
                    Job Role: <span className="font-semibold">Class room monitor</span> (optional)
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  If not checked, job role will be saved as{" "}
                  <span className="font-semibold">activeIncharge</span>.
                </p>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Assign Batches ({createForm.isClassRoomMonitor ? "Class Room Monitor" : "Activity Incharge"})
                  </p>

                  {loadingBatches ? (
                    <p className="text-xs text-slate-500">Loading batches...</p>
                  ) : batches.length === 0 ? (
                    <p className="text-xs text-slate-500">No batches found.</p>
                  ) : (
                    <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {batches.map((batch) => (
                        <label key={batch.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={(createForm.assignedBatchIds || []).includes(batch.id)}
                            onChange={(e) =>
                              toggleCreateBatchAssignment(batch.id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
                          />
                          <span>{batchLabel(batch)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Save Incharge"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingIncharge && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Edit Incharge</h2>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateIncharge} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={editForm.empId}
                      onChange={(e) => updateEditForm("empId", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="EMP001"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => updateEditForm("name", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="Full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => updateEditForm("email", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="name@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => updateEditForm("phone", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="10-digit number"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Department Name
                    </label>
                    <input
                      type="text"
                      value={editForm.departmentName}
                      onChange={(e) => updateEditForm("departmentName", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="Department name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Department ID (optional)
                    </label>
                    <input
                      type="text"
                      value={editForm.departmentId}
                      onChange={(e) => updateEditForm("departmentId", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]"
                      placeholder="Dept ID"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="edit-class-room-monitor"
                    type="checkbox"
                    checked={editForm.isClassRoomMonitor}
                    onChange={(e) => updateEditForm("isClassRoomMonitor", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
                  />
                  <label
                    htmlFor="edit-class-room-monitor"
                    className="text-sm text-slate-700 select-none"
                  >
                    Job Role: <span className="font-semibold">Class room monitor</span> (optional)
                  </label>
                </div>

                <p className="text-xs text-slate-500">
                  If not checked, job role will be saved as{" "}
                  <span className="font-semibold">activeIncharge</span>.
                </p>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Assign Batches ({editForm.isClassRoomMonitor ? "Class Room Monitor" : "Activity Incharge"})
                  </p>

                  {loadingBatches ? (
                    <p className="text-xs text-slate-500">Loading batches...</p>
                  ) : batches.length === 0 ? (
                    <p className="text-xs text-slate-500">No batches found.</p>
                  ) : (
                    <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {batches.map((batch) => (
                        <label key={batch.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={(editForm.assignedBatchIds || []).includes(batch.id)}
                            onChange={(e) =>
                              toggleEditBatchAssignment(batch.id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-[#00448a] focus:ring-[#00448a]"
                          />
                          <span>{batchLabel(batch)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-5 py-2 rounded-xl bg-[#00448a] text-white text-sm font-medium hover:bg-[#003a76] disabled:opacity-60"
                  >
                    {updating ? "Updating..." : "Update Incharge"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}