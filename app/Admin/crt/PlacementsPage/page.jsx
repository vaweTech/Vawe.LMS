// // "use client";
// // // // "use client";

// // // // import { useState } from "react";

// // // // const branchesList = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "MCA", "MBA"];

// // // // const studentsData = [
// // // //   {
// // // //     id: 1,
// // // //     name: "Rahul",
// // // //     branch: "CSE",
// // // //     year: "4",
// // // //     tenth: 85,
// // // //     inter: 88,
// // // //     bachelors: 8.2,
// // // //     masters: null,
// // // //     backlogs: 0,
// // // //   },
// // // //   {
// // // //     id: 2,
// // // //     name: "Priya",
// // // //     branch: "MBA",
// // // //     year: "2",
// // // //     tenth: 90,
// // // //     inter: 87,
// // // //     bachelors: 7.5,
// // // //     masters: 8.1,
// // // //     backlogs: 0,
// // // //   },
// // // //   {
// // // //     id: 3,
// // // //     name: "Kiran",
// // // //     branch: "ECE",
// // // //     year: "4",
// // // //     tenth: 70,
// // // //     inter: 75,
// // // //     bachelors: 6.5,
// // // //     masters: null,
// // // //     backlogs: 1,
// // // //   },
// // // // ];

// // // // export default function PlacementsDashboard() {
// // // //   const [companies, setCompanies] = useState([]);
// // // //   const [editIndex, setEditIndex] = useState(null);

// // // //   const [form, setForm] = useState({
// // // //     name: "",
// // // //     type: "oncampus",
// // // //     tenth: "",
// // // //     inter: "",
// // // //     bachelors: "",
// // // //     masters: "",
// // // //     backlogs: "",
// // // //     openings: "",
// // // //     branches: [],
// // // //     year: "4",
// // // //   });

// // // //   const handleChange = (e) => {
// // // //     setForm({ ...form, [e.target.name]: e.target.value });
// // // //   };

// // // //   const toggleBranch = (branch) => {
// // // //     setForm((prev) => ({
// // // //       ...prev,
// // // //       branches: prev.branches.includes(branch)
// // // //         ? prev.branches.filter((b) => b !== branch)
// // // //         : [...prev.branches, branch],
// // // //     }));
// // // //   };

// // // //   const getEligibleStudents = (company) => {
// // // //     return studentsData.filter(
// // // //       (s) =>
// // // //         company.branches.includes(s.branch) &&
// // // //         s.year === company.year &&
// // // //         s.backlogs <= company.backlogs &&
// // // //         s.tenth >= company.tenth &&
// // // //         s.inter >= company.inter &&
// // // //         s.bachelors >= company.bachelors &&
// // // //         (company.masters ? s.masters >= company.masters : true)
// // // //     );
// // // //   };

// // // //   const handleSubmit = (e) => {
// // // //     e.preventDefault();

// // // //     const newCompany = {
// // // //       ...form,
// // // //       tenth: Number(form.tenth),
// // // //       inter: Number(form.inter),
// // // //       bachelors: Number(form.bachelors),
// // // //       masters: form.masters ? Number(form.masters) : null,
// // // //       openings: Number(form.openings),
// // // //     };

// // // //     if (editIndex !== null) {
// // // //       const updated = [...companies];
// // // //       updated[editIndex] = newCompany;
// // // //       setCompanies(updated);
// // // //       setEditIndex(null);
// // // //     } else {
// // // //       setCompanies([...companies, newCompany]);
// // // //     }

// // // //     setForm({
// // // //       name: "",
// // // //       type: "oncampus",
// // // //       tenth: "",
// // // //       inter: "",
// // // //       bachelors: "",
// // // //       masters: "",
// // // //       backlogs: "0",
// // // //       openings: "",
// // // //       branches: [],
// // // //       year: "4",
// // // //     });
// // // //   };

// // // //   const handleEdit = (index) => {
// // // //     setForm(companies[index]);
// // // //     setEditIndex(index);
// // // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // // //   };

// // // //   // 🔹 Dashboard stats
// // // //   const totalStudents = studentsData.length;
// // // //   const totalCompanies = companies.length;

// // // //   return (
// // // //     <div className="min-h-screen bg-gray-100 p-4 md:p-6">
// // // //       {/* 🔹 HEADER */}
// // // //       <h1 className="text-2xl md:text-3xl font-bold mb-4">
// // // //         🎓 Placements Dashboard
// // // //       </h1>

// // // //       {/* 🔹 STATS */}
// // // //       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
// // // //         <div className="bg-white p-4 rounded-xl shadow">
// // // //           <p className="text-gray-500 text-sm">Total Students</p>
// // // //           <h2 className="text-xl font-bold">{totalStudents}</h2>
// // // //         </div>
// // // //         <div className="bg-white p-4 rounded-xl shadow">
// // // //           <p className="text-gray-500 text-sm">Companies</p>
// // // //           <h2 className="text-xl font-bold">{totalCompanies}</h2>
// // // //         </div>
// // // //       </div>

// // // //       <div className="grid lg:grid-cols-3 gap-6">
// // // //         {/* 🔹 FORM */}
// // // //         <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow h-fit sticky top-4">
// // // //           <h2 className="text-lg font-semibold mb-3">
// // // //             {editIndex !== null ? "✏️ Edit Company" : "➕ Add Company"}
// // // //           </h2>

// // // //           <form onSubmit={handleSubmit} className="space-y-3">
// // // //             <input
// // // //               name="name"
// // // //               placeholder="Company Name"
// // // //               value={form.name}
// // // //               onChange={handleChange}
// // // //               className="w-full border p-2 rounded"
// // // //               required
// // // //             />

// // // //             {/* Type */}
// // // //             <div className="flex gap-4 text-sm">
// // // //               <label>
// // // //                 <input
// // // //                   type="radio"
// // // //                   name="type"
// // // //                   value="oncampus"
// // // //                   checked={form.type === "oncampus"}
// // // //                   onChange={handleChange}
// // // //                 />{" "}
// // // //                 On-Campus
// // // //               </label>
// // // //               <label>
// // // //                 <input
// // // //                   type="radio"
// // // //                   name="type"
// // // //                   value="offcampus"
// // // //                   checked={form.type === "offcampus"}
// // // //                   onChange={handleChange}
// // // //                 />{" "}
// // // //                 Off-Campus
// // // //               </label>
// // // //             </div>

// // // //             {/* Academic */}
// // // //             <div className="grid grid-cols-2 gap-2">
// // // //               <input name="tenth" placeholder="10th %" onChange={handleChange} value={form.tenth} className="border p-2 rounded" />
// // // //               <input name="inter" placeholder="Inter %" onChange={handleChange} value={form.inter} className="border p-2 rounded" />
// // // //               <input name="bachelors" placeholder="Bachelors CGPA" onChange={handleChange} value={form.bachelors} className="border p-2 rounded" />
// // // //               <input name="masters" placeholder="Masters CGPA" onChange={handleChange} value={form.masters} className="border p-2 rounded" />
// // // //             </div>

// // // //             {/* Other */}
// // // //             <div className="grid grid-cols-2 gap-2">
// // // //               <input name="backlogs" placeholder="Backlogs" type="number" onChange={handleChange} value={form.backlogs} className="border p-2 rounded" />
// // // //               <input name="openings" placeholder="Openings" type="number" onChange={handleChange} value={form.openings} className="border p-2 rounded" />
// // // //             </div>

// // // //             <select
// // // //               name="year"
// // // //               value={form.year}
// // // //               onChange={handleChange}
// // // //               className="w-full border p-2 rounded"
// // // //             >
// // // //               <option value="4">4th Year</option>
// // // //               <option value="3">3rd Year</option>
// // // //               <option value="2">2nd Year</option>
// // // //             </select>

// // // //             {/* Branch */}
// // // //             <div className="flex flex-wrap gap-2">
// // // //               {branchesList.map((b) => (
// // // //                 <button
// // // //                   type="button"
// // // //                   key={b}
// // // //                   onClick={() => toggleBranch(b)}
// // // //                   className={`px-2 py-1 rounded text-sm border ${
// // // //                     form.branches.includes(b)
// // // //                       ? "bg-blue-600 text-white"
// // // //                       : "bg-gray-100"
// // // //                   }`}
// // // //                 >
// // // //                   {b}
// // // //                 </button>
// // // //               ))}
// // // //             </div>

// // // //             <button className="w-full bg-blue-600 text-white py-2 rounded">
// // // //               {editIndex !== null ? "Update" : "Create"}
// // // //             </button>
// // // //           </form>
// // // //         </div>

// // // //         {/* 🔹 COMPANY LIST */}
// // // //         <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
// // // //           {companies.map((company, index) => {
// // // //             const eligible = getEligibleStudents(company);

// // // //             return (
// // // //               <div
// // // //                 key={index}
// // // //                 className="bg-white p-4 rounded-xl shadow hover:shadow-lg transition"
// // // //               >
// // // //                 <div className="flex justify-between items-center">
// // // //                   <h3 className="font-semibold text-lg">{company.name}</h3>
// // // //                   <span
// // // //                     className={`text-xs px-2 py-1 rounded ${
// // // //                       company.type === "oncampus"
// // // //                         ? "bg-green-100 text-green-700"
// // // //                         : "bg-yellow-100 text-yellow-700"
// // // //                     }`}
// // // //                   >
// // // //                     {company.type}
// // // //                   </span>
// // // //                 </div>

// // // //                 <p className="text-sm text-gray-500">
// // // //                   Openings: {company.openings}
// // // //                 </p>

// // // //                 <p className="mt-2 font-medium">
// // // //                   Eligible: {eligible.length}
// // // //                 </p>

// // // //                 {/* Branch breakdown */}
// // // //                 <div className="text-sm mt-2 space-y-1">
// // // //                   {company.branches.map((b) => {
// // // //                     const count = eligible.filter(
// // // //                       (s) => s.branch === b
// // // //                     ).length;
// // // //                     return (
// // // //                       <div key={b} className="flex justify-between">
// // // //                         <span>{b}</span>
// // // //                         <span>{count}</span>
// // // //                       </div>
// // // //                     );
// // // //                   })}
// // // //                 </div>

// // // //                 <button
// // // //                   onClick={() => handleEdit(index)}
// // // //                   className="mt-3 text-blue-600 text-sm"
// // // //                 >
// // // //                   ✏️ Edit
// // // //                 </button>
// // // //               </div>
// // // //             );
// // // //           })}
// // // //         </div>
// // // //       </div>
// // // //     </div>
// // // //   );
// // // // }




// // // "use client";

// // // import { useState, useMemo } from "react";
// // // import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

// // // const branchesList = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "MCA", "MBA"];
// // // const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

// // // const studentsData = [
// // //   { id: 1, name: "Rahul", branch: "CSE", year: "4", tenth: 85, inter: 88, bachelors: 8.2, masters: null, backlogs: 0 },
// // //   { id: 2, name: "Priya", branch: "MBA", year: "2", tenth: 90, inter: 87, bachelors: 7.5, masters: 8.1, backlogs: 0 },
// // //   { id: 3, name: "Kiran", branch: "ECE", year: "4", tenth: 70, inter: 75, bachelors: 6.5, masters: null, backlogs: 1 },
// // // ];

// // // export default function PlacementsDashboard() {
// // //   const [companies, setCompanies] = useState([]);
// // //   const [editIndex, setEditIndex] = useState(null);

// // //   const [form, setForm] = useState({
// // //     name: "",
// // //     type: "oncampus",
// // //     tenth: "",
// // //     inter: "",
// // //     bachelors: "",
// // //     masters: "",
// // //     backlogs: "",
// // //     openings: "",
// // //     branches: [],
// // //     year: "4",
// // //   });

// // //   const handleChange = (e) => {
// // //     setForm({ ...form, [e.target.name]: e.target.value });
// // //   };

// // //   const toggleBranch = (branch) => {
// // //     setForm((prev) => ({
// // //       ...prev,
// // //       branches: prev.branches.includes(branch)
// // //         ? prev.branches.filter((b) => b !== branch)
// // //         : [...prev.branches, branch],
// // //     }));
// // //   };

// // //   const getEligibleStudents = (company) => {
// // //     return studentsData.filter(
// // //       (s) =>
// // //         company.branches.includes(s.branch) &&
// // //         s.year === company.year &&
// // //         s.backlogs <= company.backlogs &&
// // //         s.tenth >= company.tenth &&
// // //         s.inter >= company.inter &&
// // //         s.bachelors >= company.bachelors &&
// // //         (company.masters ? s.masters >= company.masters : true)
// // //     );
// // //   };
// // //   const departmentData = branchesList.map((branch) => {
// // //     const count = studentsData.filter(
// // //       (s) => s.branch === branch && s.backlogs === 0
// // //     ).length;
  
// // //     return {
// // //       name: branch,
// // //       value: count,
// // //     };
// // //   });

// // //   const handleSubmit = (e) => {
// // //     e.preventDefault();

// // //     const newCompany = {
// // //       ...form,
// // //       tenth: Number(form.tenth),
// // //       inter: Number(form.inter),
// // //       bachelors: Number(form.bachelors),
// // //       masters: form.masters ? Number(form.masters) : null,
// // //       backlogs: Number(form.backlogs),
// // //       openings: Number(form.openings),
// // //     };

// // //     if (editIndex !== null) {
// // //       const updated = [...companies];
// // //       updated[editIndex] = newCompany;
// // //       setCompanies(updated);
// // //       setEditIndex(null);
// // //     } else {
// // //       setCompanies([...companies, newCompany]);
// // //     }

// // //     setForm({
// // //       name: "",
// // //       type: "oncampus",
// // //       tenth: "",
// // //       inter: "",
// // //       bachelors: "",
// // //       masters: "",
// // //       backlogs: "",
// // //       openings: "",
// // //       branches: [],
// // //       year: "4",
// // //     });
// // //   };

// // //   // 🔹 KPI CALCULATIONS
// // //   const totalStudents = studentsData.length;

// // //   const placedStudents = useMemo(
// // //     () => studentsData.filter((s) => s.backlogs === 0),
// // //     []
// // //   );

// // //   const unplacedStudents = useMemo(
// // //     () => studentsData.filter((s) => s.backlogs > 0),
// // //     []
// // //   );

// // //   const placementRate = totalStudents
// // //     ? Math.round((placedStudents.length / totalStudents) * 100)
// // //     : 0;

// // //   return (
// // //     <div className="min-h-screen bg-gray-100 p-4 md:p-6">
// // //       {/* 🔹 HEADER */}
// // //       <h1 className="text-2xl md:text-3xl font-bold mb-4">
// // //         🎓 Placements Dashboard
// // //       </h1>

// // //       {/* 🔹 KPI CARDS */}
// // //       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
// // //         <div className="bg-white p-4 rounded-xl shadow">
// // //           <p className="text-gray-500 text-sm">Total Students</p>
// // //           <h2 className="text-xl font-bold">{totalStudents}</h2>
// // //         </div>

// // //         <div className="bg-white p-4 rounded-xl shadow">
// // //           <p className="text-gray-500 text-sm">Placed</p>
// // //           <h2 className="text-xl font-bold text-green-600">
// // //             {placedStudents.length}
// // //           </h2>
// // //         </div>

// // //         <div className="bg-white p-4 rounded-xl shadow">
// // //           <p className="text-gray-500 text-sm">Unplaced</p>
// // //           <h2 className="text-xl font-bold text-red-600">
// // //             {unplacedStudents.length}
// // //           </h2>
// // //         </div>

// // //         <div className="bg-white p-4 rounded-xl shadow">
// // //           <p className="text-gray-500 text-sm">Placement Rate</p>
// // //           <h2 className="text-xl font-bold">{placementRate}%</h2>
// // //         </div>
// // //       </div>

// // //       <div className="grid lg:grid-cols-3 gap-6">
// // //         {/* 🔹 FORM */}
// // //         <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow h-fit sticky top-4">
// // //           <h2 className="text-lg font-semibold mb-3">
// // //             {editIndex !== null ? "✏️ Edit Company" : "➕ Add Company"}
// // //           </h2>

// // //           <form onSubmit={handleSubmit} className="space-y-3">
// // //             <input
// // //               name="name"
// // //               placeholder="Company Name"
// // //               value={form.name}
// // //               onChange={handleChange}
// // //               className="w-full border p-2 rounded"
// // //               required
// // //             />

// // //             <div className="grid grid-cols-2 gap-2">
// // //               <input name="tenth" placeholder="10th %" onChange={handleChange} className="border p-2 rounded" />
// // //               <input name="inter" placeholder="Inter %" onChange={handleChange} className="border p-2 rounded" />
// // //               <input name="bachelors" placeholder="Bachelors CGPA" onChange={handleChange} className="border p-2 rounded" />
// // //               <input name="masters" placeholder="Masters CGPA" onChange={handleChange} className="border p-2 rounded" />
// // //             </div>

// // //             <div className="grid grid-cols-2 gap-2">
// // //               <input name="backlogs" type="number" placeholder="Backlogs" onChange={handleChange} className="border p-2 rounded" />
// // //               <input name="openings" type="number" placeholder="Openings" onChange={handleChange} className="border p-2 rounded" />
// // //             </div>

// // //             <select name="year" onChange={handleChange} className="w-full border p-2 rounded">
// // //               <option value="4">4th Year</option>
// // //               <option value="3">3rd Year</option>
// // //               <option value="2">2nd Year</option>
// // //             </select>

// // //             <div className="flex flex-wrap gap-2">
// // //               {branchesList.map((b) => (
// // //                 <button
// // //                   type="button"
// // //                   key={b}
// // //                   onClick={() => toggleBranch(b)}
// // //                   className={`px-2 py-1 rounded text-sm border ${
// // //                     form.branches.includes(b)
// // //                       ? "bg-blue-600 text-white"
// // //                       : "bg-gray-100"
// // //                   }`}
// // //                 >
// // //                   {b}
// // //                 </button>
// // //               ))}
// // //             </div>

// // //             <button className="w-full bg-blue-600 text-white py-2 rounded">
// // //               Create
// // //             </button>
// // //           </form>
// // //         </div>

// // //         {/* 🔹 COMPANY CARDS */}
// // //         <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
// // //           {companies.map((company, index) => {
// // //             const eligible = getEligibleStudents(company);

// // //             return (
// // //               <div key={index} className="bg-white p-4 rounded-xl shadow">
// // //                 <h3 className="font-semibold text-lg">{company.name}</h3>

// // //                 <p className="text-sm text-gray-500">
// // //                   Openings: {company.openings}
// // //                 </p>

// // //                 <p className="mt-2 font-medium">
// // //                   Eligible Students: {eligible.length}
// // //                 </p>
// // //               </div>
// // //             );
// // //           })}
// // //         </div>
// // //         <div className="bg-white p-5 rounded-xl shadow mt-6">
// // //           <h2 className="text-lg font-semibold mb-4">
// // //             Department-wise Campus Placements
// // //           </h2>

// // //           <div className="w-full h-[300px]">
// // //             <ResponsiveContainer>
// // //               <PieChart>
// // //                 <Pie
// // //                   data={departmentData}
// // //                   dataKey="value"
// // //                   nameKey="name"
// // //                   cx="50%"
// // //                   cy="50%"
// // //                   outerRadius={100}
// // //                   label
// // //                 >
// // //                   {departmentData.map((entry, index) => (
// // //                     <Cell key={index} fill={COLORS[index % COLORS.length]} />
// // //                   ))}
// // //                 </Pie>

// // //                 <Tooltip />
// // //                 <Legend />
// // //               </PieChart>
// // //             </ResponsiveContainer>
// // //           </div>
// // //         </div>
// // //       </div>
// // //     </div>
// // //   );
// // // }




// // import React, { useEffect, useMemo, useState } from "react";

// // export default function PlacementAdminPanel() {
// //   const defaultForm = {
// //     companyName: "",
// //     role: "",
// //     package: "",
// //     driveDate: "",
// //     driveTime: "",
// //     location: "",
// //     eligibility: "",
// //     backlogs: "",
// //     openings: "",
// //     jobType: "",
// //     mode: "",
// //     description: "",
// //   };

// //   const seedPlacements = [
// //     {
// //       id: 1,
// //       companyName: "Infosys",
// //       role: "Software Engineer",
// //       package: "6 LPA",
// //       driveDate: "2026-04-08",
// //       driveTime: "10:00",
// //       location: "Vijayawada",
// //       eligibility: "B.Tech CSE / IT",
// //       backlogs: "0",
// //       openings: "50",
// //       jobType: "Full Time",
// //       mode: "Offline",
// //       description: "Campus drive for 2026 batch graduates.",
// //     },
// //     {
// //       id: 2,
// //       companyName: "Wipro",
// //       role: "Project Engineer",
// //       package: "4.5 LPA",
// //       driveDate: "2026-04-03",
// //       driveTime: "09:30",
// //       location: "Hyderabad",
// //       eligibility: "All Branches",
// //       backlogs: "1",
// //       openings: "30",
// //       jobType: "Full Time",
// //       mode: "Online",
// //       description: "Assessment + interview process.",
// //     },
// //     {
// //       id: 3,
// //       companyName: "TCS",
// //       role: "Developer",
// //       package: "7 LPA",
// //       driveDate: "2026-04-01",
// //       driveTime: "11:00",
// //       location: "Chennai",
// //       eligibility: "B.Tech / MCA",
// //       backlogs: "0",
// //       openings: "100",
// //       jobType: "Full Time",
// //       mode: "Offline",
// //       description: "Ninja / Digital role hiring.",
// //     },
// //   ];

// //   const [form, setForm] = useState(defaultForm);
// //   const [placements, setPlacements] = useState([]);
// //   const [activeTab, setActiveTab] = useState("all");
// //   const [search, setSearch] = useState("");
// //   const [editId, setEditId] = useState(null);
// //   const [sortBy, setSortBy] = useState("nearest");
// //   const [showForm, setShowForm] = useState(false);

// //   // Load from localStorage
// //   useEffect(() => {
// //     const saved = localStorage.getItem("placement_admin_data");
// //     if (saved) {
// //       setPlacements(JSON.parse(saved));
// //     } else {
// //       setPlacements(seedPlacements);
// //     }
// //   }, []);

// //   // Save to localStorage
// //   useEffect(() => {
// //     localStorage.setItem("placement_admin_data", JSON.stringify(placements));
// //   }, [placements]);

// //   const today = new Date().toISOString().split("T")[0];

// //   const getPlacementStatus = (driveDate) => {
// //     if (!driveDate) return "upcoming";
// //     if (driveDate > today) return "upcoming";
// //     if (driveDate === today) return "current";
// //     return "past";
// //   };

// //   const getStatusClasses = (status) => {
// //     switch (status) {
// //       case "upcoming":
// //         return "bg-blue-100 text-blue-700 border-blue-200";
// //       case "current":
// //         return "bg-green-100 text-green-700 border-green-200";
// //       case "past":
// //         return "bg-gray-100 text-gray-700 border-gray-200";
// //       default:
// //         return "bg-gray-100 text-gray-700 border-gray-200";
// //     }
// //   };

// //   const handleChange = (e) => {
// //     setForm((prev) => ({
// //       ...prev,
// //       [e.target.name]: e.target.value,
// //     }));
// //   };

// //   const resetForm = () => {
// //     setForm(defaultForm);
// //     setEditId(null);
// //     setShowForm(false);
// //   };

// //   const handleSubmit = (e) => {
// //     e.preventDefault();

// //     if (!form.companyName || !form.role || !form.driveDate) {
// //       alert("Please fill Company Name, Role, and Drive Date");
// //       return;
// //     }

// //     if (editId) {
// //       setPlacements((prev) =>
// //         prev.map((item) =>
// //           item.id === editId ? { ...form, id: editId } : item
// //         )
// //       );
// //     } else {
// //       const newPlacement = {
// //         ...form,
// //         id: Date.now(),
// //       };
// //       setPlacements((prev) => [newPlacement, ...prev]);
// //     }

// //     resetForm();
// //   };

// //   const handleEdit = (placement) => {
// //     setForm({
// //       companyName: placement.companyName || "",
// //       role: placement.role || "",
// //       package: placement.package || "",
// //       driveDate: placement.driveDate || "",
// //       driveTime: placement.driveTime || "",
// //       location: placement.location || "",
// //       eligibility: placement.eligibility || "",
// //       backlogs: placement.backlogs || "",
// //       openings: placement.openings || "",
// //       jobType: placement.jobType || "",
// //       mode: placement.mode || "",
// //       description: placement.description || "",
// //     });
// //     setEditId(placement.id);
// //     setShowForm(true);
// //     window.scrollTo({ top: 0, behavior: "smooth" });
// //   };

// //   const handleDelete = (id) => {
// //     const ok = window.confirm("Are you sure you want to delete this placement?");
// //     if (!ok) return;

// //     setPlacements((prev) => prev.filter((item) => item.id !== id));

// //     if (editId === id) {
// //       resetForm();
// //     }
// //   };

// //   const stats = useMemo(() => {
// //     const upcoming = placements.filter(
// //       (p) => getPlacementStatus(p.driveDate) === "upcoming"
// //     ).length;
// //     const current = placements.filter(
// //       (p) => getPlacementStatus(p.driveDate) === "current"
// //     ).length;
// //     const past = placements.filter(
// //       (p) => getPlacementStatus(p.driveDate) === "past"
// //     ).length;

// //     return {
// //       total: placements.length,
// //       upcoming,
// //       current,
// //       past,
// //     };
// //   }, [placements]);

// //   const filteredPlacements = useMemo(() => {
// //     let data = [...placements];

// //     // Search filter
// //     if (search.trim()) {
// //       const keyword = search.toLowerCase();
// //       data = data.filter((item) => {
// //         const text = `
// //           ${item.companyName}
// //           ${item.role}
// //           ${item.location}
// //           ${item.eligibility}
// //           ${item.jobType}
// //           ${item.mode}
// //         `
// //           .toLowerCase()
// //           .replace(/\s+/g, " ");

// //         return text.includes(keyword);
// //       });
// //     }

// //     // Tab filter
// //     if (activeTab !== "all") {
// //       data = data.filter(
// //         (item) => getPlacementStatus(item.driveDate) === activeTab
// //       );
// //     }

// //     // Sort
// //     if (sortBy === "nearest") {
// //       data.sort((a, b) => new Date(a.driveDate) - new Date(b.driveDate));
// //     } else if (sortBy === "latest") {
// //       data.sort((a, b) => new Date(b.driveDate) - new Date(a.driveDate));
// //     } else if (sortBy === "company") {
// //       data.sort((a, b) => a.companyName.localeCompare(b.companyName));
// //     }

// //     return data;
// //   }, [placements, search, activeTab, sortBy]);

// //   const renderPlacementCard = (placement) => {
// //     const status = getPlacementStatus(placement.driveDate);

// //     return (
// //       <div
// //         key={placement.id}
// //         className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition"
// //       >
// //         <div className="flex flex-col gap-3">
// //           <div className="flex items-start justify-between gap-3">
// //             <div>
// //               <h3 className="text-xl font-bold text-gray-800">
// //                 {placement.companyName}
// //               </h3>
// //               <p className="text-sm text-gray-500">{placement.role}</p>
// //             </div>

// //             <span
// //               className={`text-xs font-semibold px-3 py-1 rounded-full border ${getStatusClasses(
// //                 status
// //               )}`}
// //             >
// //               {status.toUpperCase()}
// //             </span>
// //           </div>

// //           <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
// //             <p><span className="font-semibold">Package:</span> {placement.package || "-"}</p>
// //             <p><span className="font-semibold">Date:</span> {placement.driveDate || "-"}</p>
// //             <p><span className="font-semibold">Time:</span> {placement.driveTime || "-"}</p>
// //             <p><span className="font-semibold">Location:</span> {placement.location || "-"}</p>
// //             <p><span className="font-semibold">Eligibility:</span> {placement.eligibility || "-"}</p>
// //             <p><span className="font-semibold">Backlogs:</span> {placement.backlogs || "0"}</p>
// //             <p><span className="font-semibold">Openings:</span> {placement.openings || "-"}</p>
// //             <p><span className="font-semibold">Mode:</span> {placement.mode || "-"}</p>
// //             <p><span className="font-semibold">Job Type:</span> {placement.jobType || "-"}</p>
// //           </div>

// //           {placement.description && (
// //             <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
// //               {placement.description}
// //             </div>
// //           )}

// //           <div className="flex flex-wrap gap-2 pt-2">
// //             <button
// //               onClick={() => handleEdit(placement)}
// //               className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium"
// //             >
// //               Edit
// //             </button>

// //             <button
// //               onClick={() => handleDelete(placement.id)}
// //               className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
// //             >
// //               Delete
// //             </button>
// //           </div>
// //         </div>
// //       </div>
// //     );
// //   };

// //   return (
// //     <div className="min-h-screen bg-gray-100 w-full">
// //       {/* Top Bar */}
// //       <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
// //         <div className="w-full mx-auto px-4 md:px-8 py-6">
// //           <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
// //             <div>
// //               <h1 className="text-3xl md:text-4xl font-bold">
// //                 Placement Admin Panel
// //               </h1>
// //               <p className="text-blue-100 mt-1">
// //                 Manage all campus drives in one place
// //               </p>
// //             </div>

// //             <button
// //               onClick={() => {
// //                 setShowForm((prev) => !prev);
// //                 if (showForm) {
// //                   resetForm();
// //                 }
// //               }}
// //               className="bg-white text-blue-700 font-semibold px-5 py-3 rounded-xl shadow hover:bg-blue-50"
// //             >
// //               {showForm ? "Close Form" : "+ Add Placement"}
// //             </button>
// //           </div>
// //         </div>
// //       </div>

// //       <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
// //         {/* Stats */}
// //         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
// //           <div className="bg-white rounded-2xl p-5 shadow-sm border">
// //             <p className="text-sm text-gray-500">Total Placements</p>
// //             <h2 className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</h2>
// //           </div>

// //           <div className="bg-white rounded-2xl p-5 shadow-sm border">
// //             <p className="text-sm text-gray-500">Upcoming</p>
// //             <h2 className="text-3xl font-bold text-blue-600 mt-1">{stats.upcoming}</h2>
// //           </div>

// //           <div className="bg-white rounded-2xl p-5 shadow-sm border">
// //             <p className="text-sm text-gray-500">Current</p>
// //             <h2 className="text-3xl font-bold text-green-600 mt-1">{stats.current}</h2>
// //           </div>

// //           <div className="bg-white rounded-2xl p-5 shadow-sm border">
// //             <p className="text-sm text-gray-500">Past</p>
// //             <h2 className="text-3xl font-bold text-gray-700 mt-1">{stats.past}</h2>
// //           </div>
// //         </div>

// //         {/* Form */}
// //         {showForm && (
// //           <div className="bg-white rounded-2xl shadow-sm border p-6">
// //             <div className="flex items-center justify-between mb-5">
// //               <h2 className="text-2xl font-bold text-gray-800">
// //                 {editId ? "Edit Placement" : "Create New Placement"}
// //               </h2>
// //             </div>

// //             <form onSubmit={handleSubmit} className="space-y-5">
// //               <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
// //                 <input
// //                   name="companyName"
// //                   placeholder="Company Name"
// //                   value={form.companyName}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   name="role"
// //                   placeholder="Role"
// //                   value={form.role}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   name="package"
// //                   placeholder="Package (e.g. 6 LPA)"
// //                   value={form.package}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   type="date"
// //                   name="driveDate"
// //                   value={form.driveDate}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   type="time"
// //                   name="driveTime"
// //                   value={form.driveTime}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   name="location"
// //                   placeholder="Location"
// //                   value={form.location}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   name="eligibility"
// //                   placeholder="Eligibility"
// //                   value={form.eligibility}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 />

// //                 <input
// //                   name="backlogs"
// //                   type="text"
// //                   placeholder="Backlogs"
// //                   value={form.backlogs ?? ""}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full placeholder:text-gray-500"
// //                 />

// //                 <input
// //                   name="openings"
// //                   type="text"
// //                   placeholder="Openings"
// //                   value={form.openings ?? ""}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full placeholder:text-gray-500"
// //                 />

// //                 <select
// //                   name="jobType"
// //                   value={form.jobType}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 >
// //                   <option value="">Select Job Type</option>
// //                   <option value="Full Time">Full Time</option>
// //                   <option value="Internship">Internship</option>
// //                   <option value="Internship + FTE">Internship + FTE</option>
// //                   <option value="Contract">Contract</option>
// //                 </select>

// //                 <select
// //                   name="mode"
// //                   value={form.mode}
// //                   onChange={handleChange}
// //                   className="border p-3 rounded-xl w-full"
// //                 >
// //                   <option value="">Select Mode</option>
// //                   <option value="Online">Online</option>
// //                   <option value="Offline">Offline</option>
// //                   <option value="Hybrid">Hybrid</option>
// //                 </select>
// //               </div>

// //               <textarea
// //                 name="description"
// //                 placeholder="Placement Description / Process Details"
// //                 value={form.description}
// //                 onChange={handleChange}
// //                 rows={4}
// //                 className="border p-3 rounded-xl w-full"
// //               />

// //               <div className="flex flex-wrap gap-3">
// //                 <button
// //                   type="submit"
// //                   className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-semibold"
// //                 >
// //                   {editId ? "Update Placement" : "Create Placement"}
// //                 </button>

// //                 <button
// //                   type="button"
// //                   onClick={resetForm}
// //                   className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-xl font-semibold"
// //                 >
// //                   Cancel
// //                 </button>
// //               </div>
// //             </form>
// //           </div>
// //         )}

// //         {/* Filters */}
// //         <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
// //           <div className="grid md:grid-cols-2 gap-4">
// //             <input
// //               type="text"
// //               placeholder="Search by company, role, location, eligibility..."
// //               value={search}
// //               onChange={(e) => setSearch(e.target.value)}
// //               className="border p-3 rounded-xl w-full"
// //             />

// //             <select
// //               value={sortBy}
// //               onChange={(e) => setSortBy(e.target.value)}
// //               className="border p-3 rounded-xl w-full"
// //             >
// //               <option value="nearest">Sort by Nearest Date</option>
// //               <option value="latest">Sort by Latest Date</option>
// //               <option value="company">Sort by Company Name</option>
// //             </select>
// //           </div>

// //           <div className="flex flex-wrap gap-2">
// //             {["all", "upcoming", "current", "past"].map((tab) => (
// //               <button
// //                 key={tab}
// //                 onClick={() => setActiveTab(tab)}
// //                 className={`px-4 py-2 rounded-xl font-medium capitalize transition ${
// //                   activeTab === tab
// //                     ? tab === "upcoming"
// //                       ? "bg-blue-600 text-white"
// //                       : tab === "current"
// //                       ? "bg-green-600 text-white"
// //                       : tab === "past"
// //                       ? "bg-gray-700 text-white"
// //                       : "bg-indigo-600 text-white"
// //                     : "bg-gray-100 text-gray-700 hover:bg-gray-200"
// //                 }`}
// //               >
// //                 {tab}
// //               </button>
// //             ))}
// //           </div>
// //         </div>

// //         {/* Placement List */}
// //         <div className="space-y-4">
// //           <div className="flex items-center justify-between">
// //             <h2 className="text-2xl font-bold text-gray-800 capitalize">
// //               {activeTab} Placements
// //             </h2>
// //             <p className="text-sm text-gray-500">
// //               Showing {filteredPlacements.length} result(s)
// //             </p>
// //           </div>

// //           {filteredPlacements.length > 0 ? (
// //             <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
// //               {filteredPlacements.map((placement) => renderPlacementCard(placement))}
// //             </div>
// //           ) : (
// //             <div className="bg-white rounded-2xl shadow-sm border p-10 text-center text-gray-500">
// //               No placements found for current filters
// //             </div>
// //           )}
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }





// "use client";

// import React, { useMemo, useRef, useState } from "react";
// import {
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip,
//   ResponsiveContainer,
//   Legend,
// } from "recharts";

// export default function SingleCollegePlacementERP() {
//   // ---------------- CONFIG ----------------
//   const COLLEGE_NAME = "ABC Engineering College";
//   const today = new Date().toISOString().split("T")[0];

//   // ---------------- SAMPLE DATA ----------------
//   const [placements, setPlacements] = useState([
//     {
//       id: 1,
//       companyName: "Infosys",
//       role: "Software Engineer",
//       package: "6 LPA",
//       driveDate: "2026-04-10",
//       department: "CSE",
//       openings: 50,
//       rounds: 4,
//       selectedStudents: 2,
//     },
//     {
//       id: 2,
//       companyName: "TCS",
//       role: "Developer",
//       package: "7 LPA",
//       driveDate: "2026-04-03",
//       department: "ECE",
//       openings: 40,
//       rounds: 3,
//       selectedStudents: 1,
//     },
//     {
//       id: 3,
//       companyName: "Wipro",
//       role: "Analyst",
//       package: "4.5 LPA",
//       driveDate: "2026-04-01",
//       department: "IT",
//       openings: 30,
//       rounds: 5,
//       selectedStudents: 2,
//     },
//   ]);

//   const [students, setStudents] = useState([
//     { id: 1, name: "Rahul", department: "CSE", companyName: "Infosys", placed: true, roundsCleared: 4, finalRoundPlaced: true },
//     { id: 2, name: "Priya", department: "CSE", companyName: "Infosys", placed: false, roundsCleared: 2, finalRoundPlaced: false },
//     { id: 3, name: "Akhil", department: "ECE", companyName: "Infosys", placed: true, roundsCleared: 3, finalRoundPlaced: true },
//     { id: 4, name: "Sneha", department: "ECE", companyName: "Infosys", placed: false, roundsCleared: 1, finalRoundPlaced: false },

//     { id: 5, name: "Kiran", department: "EEE", companyName: "TCS", placed: true, roundsCleared: 3, finalRoundPlaced: true },
//     { id: 6, name: "Harsha", department: "MECH", companyName: "TCS", placed: false, roundsCleared: 1, finalRoundPlaced: false },
//     { id: 7, name: "Divya", department: "CSE", companyName: "TCS", placed: false, roundsCleared: 2, finalRoundPlaced: false },

//     { id: 8, name: "Nikhil", department: "IT", companyName: "Wipro", placed: false, roundsCleared: 3, finalRoundPlaced: false },
//     { id: 9, name: "Anjali", department: "IT", companyName: "Wipro", placed: true, roundsCleared: 5, finalRoundPlaced: true },
//     { id: 10, name: "Vamsi", department: "CSE", companyName: "Wipro", placed: true, roundsCleared: 4, finalRoundPlaced: true },
//   ]);

//   // ---------------- UI STATE ----------------
//   const [showPlacementModal, setShowPlacementModal] = useState(false);
//   const [showStudentModal, setShowStudentModal] = useState(false);

//   const [placementSearch, setPlacementSearch] = useState("");
//   const [studentSearch, setStudentSearch] = useState("");

//   // ---------------- SECTION REFS (smooth scroll) ----------------
//   const dashboardRef = useRef(null);
//   const placementsRef = useRef(null);
//   const studentsRef = useRef(null);
//   const analyticsRef = useRef(null);

//   const scrollToSection = (ref) => {
//     ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
//   };

//   // ---------------- FORMS ----------------
//   const [placementForm, setPlacementForm] = useState({
//     companyName: "",
//     role: "",
//     package: "",
//     driveDate: "",
//     department: "",
//     openings: "",
//     rounds: "",
//     selectedStudents: "",
//   });

//   const [studentForm, setStudentForm] = useState({
//     name: "",
//     department: "",
//     companyName: "",
//     placed: "false",
//     roundsCleared: "",
//     finalRoundPlaced: "false",
//   });

//   // ---------------- HELPERS ----------------
//   const getPlacementStatus = (date) => {
//     if (date > today) return "Upcoming";
//     if (date === today) return "Current";
//     return "Past";
//   };

//   const getStatusBadge = (status) => {
//     if (status === "Upcoming") return "bg-sky-100 text-sky-700 border border-sky-200";
//     if (status === "Current") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
//     return "bg-slate-100 text-slate-700 border border-slate-200";
//   };

//   const resetPlacementForm = () =>
//     setPlacementForm({
//       companyName: "",
//       role: "",
//       package: "",
//       driveDate: "",
//       department: "",
//       openings: "",
//       rounds: "",
//       selectedStudents: "",
//     });

//   const resetStudentForm = () =>
//     setStudentForm({
//       name: "",
//       department: "",
//       companyName: "",
//       placed: "false",
//       roundsCleared: "",
//       finalRoundPlaced: "false",
//     });

//   // ---------------- DERIVED STATS ----------------
//   const stats = useMemo(() => {
//     const totalStudents = students.length;
//     const placedStudents = students.filter((s) => s.placed).length;
//     const unplacedStudents = totalStudents - placedStudents;
//     const finalRoundPlaced = students.filter((s) => s.finalRoundPlaced).length;
//     const totalRoundsCleared = students.reduce((sum, s) => sum + Number(s.roundsCleared || 0), 0);

//     return {
//       totalStudents,
//       placedStudents,
//       unplacedStudents,
//       finalRoundPlaced,
//       totalRoundsCleared,
//       totalPlacements: placements.length,
//     };
//   }, [students, placements]);

//   const placementRate = stats.totalStudents
//     ? ((stats.placedStudents / stats.totalStudents) * 100).toFixed(1)
//     : 0;

//   const pieData = [
//     { name: "Placed", value: stats.placedStudents },
//     { name: "Unplaced", value: stats.unplacedStudents },
//   ];

//   const PIE_COLORS = ["#10b981", "#ef4444"];

//   // ---------------- FILTERED TABLES ----------------
//   const filteredPlacements = useMemo(() => {
//     const q = placementSearch.toLowerCase();
//     return placements.filter((p) => {
//       const text = `${p.companyName} ${p.role} ${p.department} ${p.package}`.toLowerCase();
//       return text.includes(q);
//     });
//   }, [placements, placementSearch]);

//   const filteredStudents = useMemo(() => {
//     const q = studentSearch.toLowerCase();
//     return students.filter((s) => {
//       const text = `${s.name} ${s.department} ${s.companyName}`.toLowerCase();
//       return text.includes(q);
//     });
//   }, [students, studentSearch]);

//   // ---------------- ANALYTICS ----------------
//   const departmentAnalytics = useMemo(() => {
//     const map = {};

//     students.forEach((student) => {
//       const key = `${student.companyName || "Unassigned"}-${student.department}`;

//       if (!map[key]) {
//         map[key] = {
//           companyName: student.companyName || "Unassigned",
//           department: student.department,
//           total: 0,
//           placed: 0,
//           unplaced: 0,
//           roundsCleared: 0,
//           finalRoundPlaced: 0,
//           students: [],
//         };
//       }

//       map[key].total += 1;
//       map[key].roundsCleared += Number(student.roundsCleared || 0);

//       if (student.placed) map[key].placed += 1;
//       else map[key].unplaced += 1;

//       if (student.finalRoundPlaced) map[key].finalRoundPlaced += 1;

//       map[key].students.push(student);
//     });

//     return Object.values(map).sort((a, b) => {
//       if (a.companyName === b.companyName) {
//         return a.department.localeCompare(b.department);
//       }
//       return a.companyName.localeCompare(b.companyName);
//     });
//   }, [students]);

//   // ---------------- HANDLERS ----------------
//   const handlePlacementChange = (e) => {
//     setPlacementForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
//   };

//   const handleStudentChange = (e) => {
//     setStudentForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
//   };

//   const handleAddPlacement = (e) => {
//     e.preventDefault();

//     if (!placementForm.companyName || !placementForm.role || !placementForm.driveDate || !placementForm.department) {
//       alert("Please fill Company Name, Role, Drive Date, and Department");
//       return;
//     }

//     const newPlacement = {
//       id: Date.now(),
//       companyName: placementForm.companyName,
//       role: placementForm.role,
//       package: placementForm.package,
//       driveDate: placementForm.driveDate,
//       department: placementForm.department,
//       openings: Number(placementForm.openings || 0),
//       rounds: Number(placementForm.rounds || 0),
//       selectedStudents: Number(placementForm.selectedStudents || 0),
//     };

//     setPlacements((prev) => [newPlacement, ...prev]);
//     resetPlacementForm();
//     setShowPlacementModal(false);
//   };

//   const handleAddStudent = (e) => {
//     e.preventDefault();

//     if (!studentForm.name || !studentForm.department) {
//       alert("Please fill Student Name and Department");
//       return;
//     }

//     const newStudent = {
//       id: Date.now(),
//       name: studentForm.name,
//       department: studentForm.department,
//       companyName: studentForm.companyName || "",
//       placed: studentForm.placed === "true",
//       roundsCleared: Number(studentForm.roundsCleared || 0),
//       finalRoundPlaced: studentForm.finalRoundPlaced === "true",
//     };

//     setStudents((prev) => [newStudent, ...prev]);
//     resetStudentForm();
//     setShowStudentModal(false);
//   };

//   const deletePlacement = (id) => {
//     if (!window.confirm("Delete this placement drive?")) return;
//     setPlacements((prev) => prev.filter((p) => p.id !== id));
//   };

//   const deleteStudent = (id) => {
//     if (!window.confirm("Delete this student?")) return;
//     setStudents((prev) => prev.filter((s) => s.id !== id));
//   };

//   // ---------------- REUSABLE UI ----------------
//   const StatCard = ({ title, value, sub, color, icon }) => (
//     <div className="rounded-3xl bg-white/90 backdrop-blur border border-white/60 shadow-sm p-5 hover:shadow-lg transition-all duration-300">
//       <div className="flex items-start justify-between">
//         <div>
//           <p className="text-sm text-slate-500 font-medium">{title}</p>
//           <h2 className={`text-3xl font-bold mt-2 ${color}`}>{value}</h2>
//           {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
//         </div>
//         <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl">
//           {icon}
//         </div>
//       </div>
//     </div>
//   );

//   const SectionHeader = ({ title, subtitle, action }) => (
//     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
//       <div>
//         <h2 className="text-2xl md:text-3xl font-bold text-slate-800">{title}</h2>
//         {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
//       </div>
//       {action}
//     </div>
//   );

//   const Card = ({ children, className = "" }) => (
//     <div className={`bg-white/90 backdrop-blur rounded-3xl border border-white/60 shadow-sm ${className}`}>
//       {children}
//     </div>
//   );

//   const QuickButton = ({ label, onClick }) => (
//     <button
//       onClick={onClick}
//       className="px-4 py-2.5 rounded-2xl bg-white/80 hover:bg-white border border-white/60 text-slate-700 font-semibold shadow-sm transition-all duration-200"
//     >
//       {label}
//     </button>
//   );

//   const RowInfoTooltip = ({ row }) => {
//     return (
//       <div className="relative group inline-block">
//         <span className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer border border-indigo-200">
//           i
//         </span>

//         <div className="absolute z-50 hidden group-hover:block top-10 right-0 md:left-0 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 min-w-[300px] max-w-[360px]">
//           <p className="font-semibold text-sm text-slate-800 mb-2">
//             {row.companyName} - {row.department}
//           </p>

//           <div className="grid grid-cols-2 gap-2 text-sm mb-3">
//             <p className="text-slate-600">
//               Student Count: <span className="font-semibold text-slate-800">{row.total}</span>
//             </p>
//             <p className="text-slate-600">
//               Placed: <span className="font-semibold text-emerald-600">{row.placed}</span>
//             </p>
//             <p className="text-slate-600">
//               Unplaced: <span className="font-semibold text-rose-600">{row.unplaced}</span>
//             </p>
//             <p className="text-slate-600">
//               Final Placed: <span className="font-semibold text-blue-600">{row.finalRoundPlaced}</span>
//             </p>
//           </div>

//           <div className="border-t border-slate-100 pt-3">
//             <p className="text-xs font-semibold text-slate-500 mb-2">Students</p>
//             <div className="max-h-48 overflow-y-auto space-y-2">
//               {row.students.map((s) => (
//                 <div
//                   key={s.id}
//                   className="rounded-xl border border-slate-100 p-2 text-xs flex items-center justify-between gap-2"
//                 >
//                   <div>
//                     <p className="font-semibold text-slate-800">{s.name}</p>
//                     <p className="text-slate-500">Rounds Cleared: {s.roundsCleared}</p>
//                   </div>

//                   <span
//                     className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
//                       s.placed
//                         ? "bg-emerald-100 text-emerald-700"
//                         : "bg-rose-100 text-rose-700"
//                     }`}
//                   >
//                     {s.placed ? "Placed" : "Unplaced"}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   };

//   // ---------------- PAGE ----------------
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
//       <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-10">
//         {/* HERO HEADER */}
//         <section className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-2xl">
//           <div className="p-6 md:p-10">
//             <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
//               <div>
//                 <p className="uppercase tracking-[0.2em] text-xs md:text-sm text-blue-100 font-semibold">
//                   Placement ERP
//                 </p>
//                 <h1 className="text-3xl md:text-5xl font-extrabold mt-3 leading-tight">
//                   {COLLEGE_NAME}
//                 </h1>
//                 <p className="mt-3 text-blue-100 max-w-2xl">
//                   Manage placement drives, student records, and analytics in one
//                   clean professional dashboard — section by section, without sidebar.
//                 </p>
//               </div>

//               <div className="grid grid-cols-2 gap-4 min-w-[280px]">
//                 <div className="bg-white/15 backdrop-blur rounded-3xl p-4 border border-white/20">
//                   <p className="text-sm text-black text-bold">Placement Rate</p>
//                   <p className="text-3xl font-bold text-black mt-2">{placementRate}%</p>
//                 </div>
//                 <div className="bg-white/15 backdrop-blur rounded-3xl p-4 border border-white/20">
//                   <p className="text-sm text-black text-bold">Drives</p>
//                   <p className="text-3xl font-bold text-black mt-2">{stats.totalPlacements}</p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </section>

//         {/* STICKY QUICK NAV */}
//         <section className="sticky top-3 z-30">
//           <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-lg p-3">
//             <div className="flex flex-wrap gap-3">
//               <QuickButton label="Dashboard" onClick={() => scrollToSection(dashboardRef)} />
//               <QuickButton label="Placements" onClick={() => scrollToSection(placementsRef)} />
//               <QuickButton label="Students" onClick={() => scrollToSection(studentsRef)} />
//               <QuickButton label="Analytics" onClick={() => scrollToSection(analyticsRef)} />
//             </div>
//           </div>
//         </section>

//         {/* DASHBOARD */}
//         <section ref={dashboardRef} className="scroll-mt-28">
//           <SectionHeader
//             title="Dashboard Overview"
//             subtitle="Quick insights of placement performance"
//           />

//           <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
//             <StatCard title="Total Students" value={stats.totalStudents} color="text-indigo-600" icon="🎓" />
//             <StatCard title="Placed" value={stats.placedStudents} color="text-emerald-600" icon="✅" />
//             <StatCard title="Unplaced" value={stats.unplacedStudents} color="text-rose-600" icon="❌" />
//             <StatCard title="Final Round Placed" value={stats.finalRoundPlaced} color="text-blue-600" icon="🏁" />
//             <StatCard title="Rounds Cleared" value={stats.totalRoundsCleared} color="text-violet-600" icon="📈" />
//             <StatCard title="Placement Drives" value={stats.totalPlacements} color="text-orange-600" icon="🏢" />
//           </div>

//           <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
//             <Card className="p-6 xl:col-span-2">
//               <h3 className="text-xl font-bold text-slate-800 mb-4">Placed vs Unplaced</h3>
//               <div className="h-80">
//                 <ResponsiveContainer width="100%" height="100%">
//                   <PieChart>
//                     <Pie
//                       data={pieData}
//                       cx="50%"
//                       cy="50%"
//                       outerRadius={110}
//                       dataKey="value"
//                       label
//                     >
//                       {pieData.map((entry, index) => (
//                         <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
//                       ))}
//                     </Pie>
//                     <Tooltip />
//                     <Legend />
//                   </PieChart>
//                 </ResponsiveContainer>
//               </div>
//             </Card>

//             <Card className="p-6">
//               <h3 className="text-xl font-bold text-slate-800 mb-4">College Details</h3>
//               <div className="space-y-4">
//                 <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
//                   <p className="text-sm text-slate-500">College Name</p>
//                   <p className="font-bold text-slate-800 mt-1">{COLLEGE_NAME}</p>
//                 </div>

//                 <div className="rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm p-5 hover:shadow-lg transition-all duration-300">
//                   <p className="text-sm text-black text-bold">Placement Rate</p>
//                   <p className="font-bold text-black mt-1">{placementRate}%</p>
//                 </div>

//                 <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
//                   <p className="text-sm text-slate-500">Current Date</p>
//                   <p className="font-bold text-slate-800 mt-1">{today}</p>
//                 </div>
//               </div>
//             </Card>
//           </div>
//         </section>

//         {/* PLACEMENTS */}
//         <section ref={placementsRef} className="scroll-mt-28">
//           <SectionHeader
//             title="Placements Section"
//             subtitle="Manage company drives, roles, packages, and statuses"
//             action={
//               <button
//                 onClick={() => setShowPlacementModal(true)}
//                 className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:shadow-xl transition"
//               >
//                 + Add Placement
//               </button>
//             }
//           />

//           <Card className="p-5 mb-5">
//             <input
//               type="text"
//               placeholder="Search placements by company, role, department, package..."
//               value={placementSearch}
//               onChange={(e) => setPlacementSearch(e.target.value)}
//               className="w-full md:w-[420px] border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-200 px-4 py-3 rounded-2xl"
//             />
//           </Card>

//           <Card className="overflow-hidden">
//             <div className="p-5 border-b border-slate-100">
//               <h3 className="text-xl font-bold text-slate-800">Placement Drives</h3>
//             </div>

//             <div className="overflow-x-auto">
//               <table className="w-full min-w-[1100px]">
//                 <thead className="bg-slate-50 text-left">
//                   <tr>
//                     <th className="p-4 text-slate-600">Company</th>
//                     <th className="p-4 text-slate-600">Role</th>
//                     <th className="p-4 text-slate-600">Package</th>
//                     <th className="p-4 text-slate-600">Date</th>
//                     <th className="p-4 text-slate-600">Department</th>
//                     <th className="p-4 text-slate-600">Openings</th>
//                     <th className="p-4 text-slate-600">Rounds</th>
//                     <th className="p-4 text-slate-600">Selected</th>
//                     <th className="p-4 text-slate-600">Status</th>
//                     <th className="p-4 text-slate-600">Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filteredPlacements.map((p) => {
//                     const status = getPlacementStatus(p.driveDate);
//                     return (
//                       <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
//                         <td className="p-4 font-semibold text-slate-800">{p.companyName}</td>
//                         <td className="p-4 text-slate-700">{p.role}</td>
//                         <td className="p-4 text-slate-700">{p.package}</td>
//                         <td className="p-4 text-slate-700">{p.driveDate}</td>
//                         <td className="p-4 text-slate-700">{p.department}</td>
//                         <td className="p-4 text-slate-700">{p.openings}</td>
//                         <td className="p-4 text-slate-700">{p.rounds}</td>
//                         <td className="p-4 text-slate-700">{p.selectedStudents}</td>
//                         <td className="p-4">
//                           <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(status)}`}>
//                             {status}
//                           </span>
//                         </td>
//                         <td className="p-4">
//                           <button
//                             onClick={() => deletePlacement(p.id)}
//                             className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
//                           >
//                             Delete
//                           </button>
//                         </td>
//                       </tr>
//                     );
//                   })}

//                   {filteredPlacements.length === 0 && (
//                     <tr>
//                       <td colSpan={10} className="p-8 text-center text-slate-500">
//                         No placements found
//                       </td>
//                     </tr>
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </Card>
//         </section>

//         {/* STUDENTS */}
//         <section ref={studentsRef} className="scroll-mt-28">
//           <SectionHeader
//             title="Students Section"
//             subtitle="Track students, assigned companies, rounds cleared, and final results"
//             action={
//               <button
//                 onClick={() => setShowStudentModal(true)}
//                 className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md hover:shadow-xl transition"
//               >
//                 + Add Student
//               </button>
//             }
//           />

//           <Card className="p-5 mb-5">
//             <input
//               type="text"
//               placeholder="Search students by name, department, company..."
//               value={studentSearch}
//               onChange={(e) => setStudentSearch(e.target.value)}
//               className="w-full md:w-[420px] border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-200 px-4 py-3 rounded-2xl"
//             />
//           </Card>

//           <Card className="overflow-hidden">
//             <div className="p-5 border-b border-slate-100">
//               <h3 className="text-xl font-bold text-slate-800">Students List</h3>
//             </div>

//             <div className="overflow-x-auto">
//               <table className="w-full min-w-[1100px]">
//                 <thead className="bg-slate-50 text-left">
//                   <tr>
//                     <th className="p-4 text-slate-600">Student Name</th>
//                     <th className="p-4 text-slate-600">Department</th>
//                     <th className="p-4 text-slate-600">Company</th>
//                     <th className="p-4 text-slate-600">Rounds Cleared</th>
//                     <th className="p-4 text-slate-600">Placed</th>
//                     <th className="p-4 text-slate-600">Final Round</th>
//                     <th className="p-4 text-slate-600">Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filteredStudents.map((s) => (
//                     <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
//                       <td className="p-4 font-semibold text-slate-800">{s.name}</td>
//                       <td className="p-4 text-slate-700">{s.department}</td>
//                       <td className="p-4 text-slate-700">{s.companyName || "Unassigned"}</td>
//                       <td className="p-4 text-slate-700">{s.roundsCleared}</td>
//                       <td className="p-4">
//                         <span
//                           className={`px-3 py-1 rounded-full text-xs font-semibold ${
//                             s.placed
//                               ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
//                               : "bg-rose-100 text-rose-700 border border-rose-200"
//                           }`}
//                         >
//                           {s.placed ? "Placed" : "Unplaced"}
//                         </span>
//                       </td>
//                       <td className="p-4">
//                         <span
//                           className={`px-3 py-1 rounded-full text-xs font-semibold ${
//                             s.finalRoundPlaced
//                               ? "bg-blue-100 text-blue-700 border border-blue-200"
//                               : "bg-slate-100 text-slate-700 border border-slate-200"
//                           }`}
//                         >
//                           {s.finalRoundPlaced ? "Cleared" : "Not Cleared"}
//                         </span>
//                       </td>
//                       <td className="p-4">
//                         <button
//                           onClick={() => deleteStudent(s.id)}
//                           className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
//                         >
//                           Delete
//                         </button>
//                       </td>
//                     </tr>
//                   ))}

//                   {filteredStudents.length === 0 && (
//                     <tr>
//                       <td colSpan={7} className="p-8 text-center text-slate-500">
//                         No students found
//                       </td>
//                     </tr>
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </Card>
//         </section>

//         {/* ANALYTICS */}
//         <section ref={analyticsRef} className="scroll-mt-28">
//           <SectionHeader
//             title="Department Analytics"
//             subtitle="Each row shows Company + Department performance with detailed student breakdown"
//           />

//           <Card className="overflow-hidden">
//             <div className="p-5 border-b border-slate-100">
//               <h3 className="text-xl font-bold text-slate-800">Department Wise Analytics</h3>
//               <p className="text-sm text-slate-500 mt-1">
//                 Hover the info icon to view student count and row-level student list.
//               </p>
//             </div>

//             <div className="overflow-x-auto">
//   <table className="w-full min-w-[1200px]">
//     <thead className="bg-slate-50">
//       <tr>
//         <th className="p-4 text-left text-slate-600">Company Name</th>
//         <th className="p-4 text-left text-slate-600">Department</th>
//         <th className="p-4 text-left text-slate-600">Total Students</th>
//         <th className="p-4 text-left text-slate-600">Placed</th>
//         <th className="p-4 text-left text-slate-600">Unplaced</th>
//         <th className="p-4 text-left text-slate-600">Rounds Cleared</th>
//         <th className="p-4 text-left text-slate-600">Final Round Placed</th>
//         <th className="p-4 text-left text-slate-600">Round Stats</th>
//       </tr>
//     </thead>
//     <tbody>
//       {departmentAnalytics.map((row, i) => (
//         <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
//           <td className="p-4 font-semibold text-slate-800">{row.companyName}</td>
//           <td className="p-4 text-slate-700">{row.department}</td>
//           <td className="p-4 text-slate-700">{row.total}</td>
//           <td className="p-4 text-emerald-600 font-semibold">{row.placed}</td>
//           <td className="p-4 text-rose-600 font-semibold">{row.unplaced}</td>
//           <td className="p-4 text-slate-700">{row.roundsCleared}</td>
//           <td className="p-4 text-blue-600 font-semibold">{row.finalRoundPlaced}</td>
//           <td className="p-4">
//   <RoundStatsTooltip row={row} />
// </td>
//         </tr>
//       ))}

//       {departmentAnalytics.length === 0 && (
//         <tr>
//           <td colSpan={8} className="p-8 text-center text-slate-500">
//             No analytics data available
//           </td>
//         </tr>
//       )}
//     </tbody>
//   </table>
// </div>
//           </Card>
//         </section>
//       </main>

//       {/* ADD PLACEMENT MODAL */}
//       {showPlacementModal && (
//         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
//             <div className="flex items-center justify-between mb-5">
//               <h3 className="text-2xl font-bold text-slate-800">Add New Placement</h3>
//               <button
//                 onClick={() => {
//                   setShowPlacementModal(false);
//                   resetPlacementForm();
//                 }}
//                 className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
//               >
//                 ✕
//               </button>
//             </div>

//             <form onSubmit={handleAddPlacement} className="space-y-4">
//               <div className="grid md:grid-cols-2 gap-4">
//                 <input name="companyName" placeholder="Company Name" value={placementForm.companyName} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="role" placeholder="Role" value={placementForm.role} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="package" placeholder="Package (e.g. 6 LPA)" value={placementForm.package} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input type="date" name="driveDate" value={placementForm.driveDate} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="department" placeholder="Department (e.g. CSE)" value={placementForm.department} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="openings" placeholder="Openings" value={placementForm.openings} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="rounds" placeholder="Number of Rounds" value={placementForm.rounds} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="selectedStudents" placeholder="Selected Students" value={placementForm.selectedStudents} onChange={handlePlacementChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//               </div>

//               <div className="flex gap-3 pt-2">
//                 <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-2xl font-semibold">
//                   Save Placement
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setShowPlacementModal(false);
//                     resetPlacementForm();
//                   }}
//                   className="bg-slate-200 hover:bg-slate-300 px-5 py-3 rounded-2xl font-semibold text-slate-700"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ADD STUDENT MODAL */}
//       {showStudentModal && (
//         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
//             <div className="flex items-center justify-between mb-5">
//               <h3 className="text-2xl font-bold text-slate-800">Add New Student</h3>
//               <button
//                 onClick={() => {
//                   setShowStudentModal(false);
//                   resetStudentForm();
//                 }}
//                 className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
//               >
//                 ✕
//               </button>
//             </div>

//             <form onSubmit={handleAddStudent} className="space-y-4">
//               <div className="grid md:grid-cols-2 gap-4">
//                 <input name="name" placeholder="Student Name" value={studentForm.name} onChange={handleStudentChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />
//                 <input name="department" placeholder="Department (e.g. CSE)" value={studentForm.department} onChange={handleStudentChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />

//                 <select name="companyName" value={studentForm.companyName} onChange={handleStudentChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none">
//                   <option value="">Select Company (optional)</option>
//                   {placements.map((p) => (
//                     <option key={p.id} value={p.companyName}>
//                       {p.companyName}
//                     </option>
//                   ))}
//                 </select>

//                 <input name="roundsCleared" placeholder="Rounds Cleared" value={studentForm.roundsCleared} onChange={handleStudentChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none" />

//                 <select name="placed" value={studentForm.placed} onChange={handleStudentChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none">
//                   <option value="false">Unplaced</option>
//                   <option value="true">Placed</option>
//                 </select>

//                 <select name="finalRoundPlaced" value={studentForm.finalRoundPlaced} onChange={handleStudentChange} className="border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white outline-none">
//                   <option value="false">Final Round Not Cleared</option>
//                   <option value="true">Final Round Placed</option>
//                 </select>
//               </div>

//               <div className="flex gap-3 pt-2">
//                 <button type="submit" className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3 rounded-2xl font-semibold">
//                   Save Student
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setShowStudentModal(false);
//                     resetStudentForm();
//                   }}
//                   className="bg-slate-200 hover:bg-slate-300 px-5 py-3 rounded-2xl font-semibold text-slate-700"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }




"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  FlagIcon,
  ChartBarIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAdminAccess } from "../../AdminAccessContext";
import {
  ALL_DEPARTMENTS,
  DEFAULT_DEPARTMENTS,
  LIMITS,
  academicYearEnd,
  checkCandidateEligibility,
  companyKey,
  csvEscape,
  deleteDrive,
  driveParticipants,
  maxRoundsClearedForDrive,
  removeCandidate,
  saveDrive,
  setCandidateRounds,
  subscribeCrtStudents,
  subscribeDrives,
  validateDrive,
  validateRoundsCleared,
} from "@/lib/crtPlacementData";

const EMPTY_DRIVE_FORM = {
  companyName: "",
  role: "",
  packageLpa: "",
  driveDate: "",
  departments: [],
  openings: "",
  rounds: "",
  maxBacklogs: "",
};

const PIE_COLORS = ["#10b981", "#ef4444"];

const inputClass =
  "w-full border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition";

function friendlyError(err, fallback) {
  const code = err?.code || "";
  if (code === "permission-denied") return "You do not have permission for this action. Ask the admin to check your role.";
  if (code === "unavailable") return "Network problem. Check your internet connection and try again.";
  return err?.message || fallback;
}

function StatCard({ title, value, color, Icon, iconBg }) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <h2 className={`text-3xl font-bold mt-2 ${color}`}>{value}</h2>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ring-1 ring-black/[0.04] ${iconBg}`}>
          <Icon className={`h-6 w-6 ${color}`} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function QuickButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold shadow-sm hover:shadow transition-all"
    >
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function RoundStatsCell({ row }) {
  const entries = Object.entries(row.roundStats || {});
  if (entries.length === 0) return <span className="text-slate-400">No data</span>;
  return (
    <div className="space-y-1.5 text-xs text-slate-700 max-h-40 overflow-y-auto pr-1">
      {entries.map(([round, breakdown]) => (
        <div key={round} className="leading-snug">
          <span className="font-semibold text-slate-800">{round}</span>
          <span className="text-slate-600"> {" --> "} </span>
          <span>
            {Object.entries(breakdown || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([label, count]) => `${label}-${count}`)
              .join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function sortRoundStats(roundStats) {
  const entries = Object.entries(roundStats);
  entries.sort(([a], [b]) => {
    if (a === "Final Round") return 1;
    if (b === "Final Round") return -1;
    return Number(a.replace("Round ", "")) - Number(b.replace("Round ", ""));
  });
  return Object.fromEntries(entries);
}

function buildAnalytics(rows, groupKey, breakdownKey) {
  const map = {};
  rows.forEach((row) => {
    const name = row[groupKey] || "Unknown";
    const label = row[breakdownKey] || "Unknown";
    if (!map[name]) {
      map[name] = { name, total: 0, placed: 0, unplaced: 0, roundsCleared: 0, finalRoundPlaced: 0, roundStats: {} };
    }
    const item = map[name];
    item.total += 1;
    item.roundsCleared += row.roundsCleared;
    if (row.placed) item.placed += 1;
    else item.unplaced += 1;
    if (row.finalRoundPlaced) item.finalRoundPlaced += 1;
    for (let r = 1; r <= row.roundsCleared; r++) {
      const key = `Round ${r}`;
      item.roundStats[key] = item.roundStats[key] || {};
      item.roundStats[key][label] = (item.roundStats[key][label] || 0) + 1;
    }
    if (row.finalRoundPlaced) {
      item.roundStats["Final Round"] = item.roundStats["Final Round"] || {};
      item.roundStats["Final Round"][label] = (item.roundStats["Final Round"][label] || 0) + 1;
    }
  });
  return Object.values(map)
    .map((item) => ({ ...item, roundStats: sortRoundStats(item.roundStats) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function AnalyticsTable({ title, description, firstColumn, rows }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-slate-50">
            <tr>
              {[firstColumn, "Total Attended", "Placed", "Unplaced", "Rounds Cleared", "Final Round Placed", "Round Stats"].map((h) => (
                <th key={h} className="p-4 text-left text-slate-600 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="p-4 font-semibold text-slate-800">{row.name}</td>
                <td className="p-4 text-slate-700">{row.total}</td>
                <td className="p-4 text-emerald-600 font-semibold">{row.placed}</td>
                <td className="p-4 text-rose-600 font-semibold">{row.unplaced}</td>
                <td className="p-4 text-slate-700">{row.roundsCleared}</td>
                <td className="p-4 text-blue-600 font-semibold">{row.finalRoundPlaced}</td>
                <td className="p-4 align-top">
                  <RoundStatsCell row={row} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  No analytics data for this year yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SingleCollegePlacementERP() {
  const access = useAdminAccess();
  const collegeLabel = access?.collegeSubdomain
    ? String(access.collegeSubdomain).toUpperCase()
    : "CRT Placements";
  const today = new Date().toISOString().split("T")[0];
  const currentYear = String(new Date().getFullYear());

  const [students, setStudents] = useState([]);
  const [drives, setDrives] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [lastSynced, setLastSynced] = useState(null);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [placementSearch, setPlacementSearch] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);

  const [showDriveModal, setShowDriveModal] = useState(false);
  const [editingDriveId, setEditingDriveId] = useState(null);
  const [driveForm, setDriveForm] = useState(EMPTY_DRIVE_FORM);
  const [driveErrors, setDriveErrors] = useState({});
  const [driveSubmitError, setDriveSubmitError] = useState("");
  const [driveSaving, setDriveSaving] = useState(false);

  const [candidateDraft, setCandidateDraft] = useState({ driveId: null, studentId: "", rounds: "0", search: "" });
  const [candidateError, setCandidateError] = useState("");
  const [roundEdits, setRoundEdits] = useState({});
  const [busyKey, setBusyKey] = useState("");

  const dashboardRef = useRef(null);
  const placementsRef = useRef(null);
  const analyticsRef = useRef(null);
  const scrollToSection = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    setStudentsLoading(true);
    setDrivesLoading(true);
    setLoadError("");
    const unsubStudents = subscribeCrtStudents(
      (rows) => {
        setStudents(rows);
        setStudentsLoading(false);
        setLastSynced(new Date());
      },
      (err) => {
        setStudentsLoading(false);
        setLoadError(friendlyError(err, "Could not load CRT students."));
      }
    );
    const unsubDrives = subscribeDrives(
      (rows) => {
        setDrives(rows);
        setDrivesLoading(false);
        setLastSynced(new Date());
      },
      (err) => {
        setDrivesLoading(false);
        setLoadError(friendlyError(err, "Could not load placement drives."));
      }
    );
    return () => {
      unsubStudents();
      unsubDrives();
    };
  }, [reloadKey]);

  const loading = studentsLoading || drivesLoading;

  const getPlacementStatus = useCallback(
    (date) => {
      if (date > today) return "Upcoming";
      if (date === today) return "Current";
      return "Past";
    },
    [today]
  );

  const getStatusBadge = (status) => {
    if (status === "Upcoming") return "bg-sky-100 text-sky-700 border border-sky-200";
    if (status === "Current") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  const departmentOptions = useMemo(() => {
    const set = new Set(DEFAULT_DEPARTMENTS);
    students.forEach((s) => s.department && s.department !== "GENERAL" && set.add(s.department));
    return [...set].sort();
  }, [students]);

  const participantsByDrive = useMemo(() => {
    const map = new Map();
    drives.forEach((d) => map.set(d.id, driveParticipants(d, students)));
    return map;
  }, [drives, students]);

  const yearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    drives.forEach((d) => /^\d{4}/.test(d.driveDate) && years.add(d.driveDate.slice(0, 4)));
    students.forEach((s) => {
      const end = academicYearEnd(s.academicYear);
      if (end) years.add(String(end));
      s.offers.forEach((o) => o.offerDate && years.add(o.offerDate.slice(0, 4)));
    });
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [drives, students, currentYear]);

  const yearDrives = useMemo(
    () => (selectedYear === "all" ? drives : drives.filter((d) => d.driveDate.slice(0, 4) === selectedYear)),
    [drives, selectedYear]
  );

  const yearDriveStudentIds = useMemo(() => {
    const ids = new Set();
    yearDrives.forEach((d) => (participantsByDrive.get(d.id) || []).forEach((p) => ids.add(p.student.id)));
    return ids;
  }, [yearDrives, participantsByDrive]);

  const cohort = useMemo(() => {
    if (selectedYear === "all") return students;
    return students.filter((s) => {
      const end = academicYearEnd(s.academicYear);
      if (end) return String(end) === selectedYear;
      return (
        yearDriveStudentIds.has(s.id) ||
        s.offers.some((o) => o.offerDate && o.offerDate.slice(0, 4) === selectedYear)
      );
    });
  }, [students, selectedYear, yearDriveStudentIds]);

  /** One row per student per company — drive attendance plus PO offers made outside any drive. */
  const participations = useMemo(() => {
    const rows = [];
    const matchedOffers = new Set();
    yearDrives.forEach((drive) => {
      (participantsByDrive.get(drive.id) || []).forEach((p) => {
        if (p.offer) matchedOffers.add(`${p.student.id}|${companyKey(p.offer.company)}|${p.offer.offerDate}`);
        rows.push({
          uid: p.student.id,
          department: p.student.department,
          companyName: drive.companyName,
          placed: p.placed,
          roundsCleared: p.roundsCleared,
          finalRoundPlaced: p.placed,
        });
      });
    });
    const cohortIds = new Set(cohort.map((s) => s.id));
    students.forEach((s) => {
      s.offers.forEach((o) => {
        const inYear =
          selectedYear === "all" ||
          (o.offerDate ? o.offerDate.slice(0, 4) === selectedYear : cohortIds.has(s.id));
        if (!inYear) return;
        if (matchedOffers.has(`${s.id}|${companyKey(o.company)}|${o.offerDate}`)) return;
        rows.push({
          uid: s.id,
          department: s.department,
          companyName: o.company,
          placed: true,
          roundsCleared: 0,
          finalRoundPlaced: true,
        });
      });
    });
    return rows;
  }, [yearDrives, participantsByDrive, students, cohort, selectedYear]);

  const stats = useMemo(() => {
    const placedStudents = cohort.filter((s) => s.status === "Placed").length;
    return {
      totalStudents: cohort.length,
      placedStudents,
      unplacedStudents: cohort.length - placedStudents,
      finalRoundPlaced: participations.filter((p) => p.finalRoundPlaced).length,
      totalRoundsCleared: participations.reduce((sum, p) => sum + p.roundsCleared, 0),
      totalPlacements: yearDrives.length,
    };
  }, [cohort, participations, yearDrives]);

  const placementRate = stats.totalStudents
    ? ((stats.placedStudents / stats.totalStudents) * 100).toFixed(1)
    : "0.0";

  const pieData = [
    { name: "Placed", value: stats.placedStudents },
    { name: "Unplaced", value: stats.unplacedStudents },
  ];

  const filteredDrives = useMemo(() => {
    const q = placementSearch.trim().toLowerCase();
    if (!q) return yearDrives;
    return yearDrives.filter((d) =>
      `${d.companyName} ${d.role} ${d.departments.join(" ")} ${d.packageLpa}`.toLowerCase().includes(q)
    );
  }, [yearDrives, placementSearch]);

  const companyProgressList = useMemo(
    () =>
      filteredDrives.map((drive) => {
        const participants = participantsByDrive.get(drive.id) || [];
        const status = getPlacementStatus(drive.driveDate);
        const totalRounds = drive.rounds;
        const phaseFor = (list) => {
          const maxCleared = list.reduce((m, p) => Math.max(m, p.roundsCleared), 0);
          const currentRound =
            status === "Upcoming" ? 1 : status === "Past" ? totalRounds : Math.min(Math.max(maxCleared + 1, 1), totalRounds);
          const phaseLabel =
            status === "Upcoming" ? "Yet to Start" : status === "Current" ? `Round ${currentRound} In Progress` : "Completed";
          const inCurrent =
            status === "Past"
              ? 0
              : status === "Upcoming"
                ? list.filter((p) => p.roundsCleared === 0).length
                : list.filter((p) => p.roundsCleared === currentRound - 1 && !p.placed).length;
          return { currentRound, phaseLabel, inCurrent };
        };
        const overall = phaseFor(participants);
        const branches = [...new Set(participants.map((p) => p.student.department))].sort();
        return {
          ...drive,
          participants,
          status,
          totalRounds,
          phaseLabel: overall.phaseLabel,
          currentRound: overall.currentRound,
          currentRoundStudents: overall.inCurrent,
          placedCount: participants.filter((p) => p.placed).length,
          branchBreakdown: branches.map((branch) => {
            const list = participants.filter((p) => p.student.department === branch);
            const phase = phaseFor(list);
            return {
              branch,
              totalStudents: list.length,
              currentRound: status === "Past" ? null : phase.currentRound,
              phaseLabel: phase.phaseLabel,
              driveStatus: status,
              currentRoundStudents: phase.inCurrent,
            };
          }),
        };
      }),
    [filteredDrives, participantsByDrive, getPlacementStatus]
  );

  const companyAnalytics = useMemo(() => buildAnalytics(participations, "companyName", "department"), [participations]);
  const departmentAnalytics = useMemo(() => buildAnalytics(participations, "department", "companyName"), [participations]);

  /* ----------------------------- drive form ----------------------------- */

  const openNewDrive = () => {
    setEditingDriveId(null);
    setDriveForm(EMPTY_DRIVE_FORM);
    setDriveErrors({});
    setDriveSubmitError("");
    setShowDriveModal(true);
  };

  const openEditDrive = (drive) => {
    setEditingDriveId(drive.id);
    setDriveForm({
      companyName: drive.companyName,
      role: drive.role,
      packageLpa: String(drive.packageLpa || ""),
      driveDate: drive.driveDate,
      departments: drive.departments,
      openings: String(drive.openings || ""),
      rounds: String(drive.rounds || ""),
      maxBacklogs: drive.maxBacklogs == null ? "" : String(drive.maxBacklogs),
    });
    setDriveErrors({});
    setDriveSubmitError("");
    setShowDriveModal(true);
  };

  const closeDriveModal = () => {
    if (driveSaving) return;
    setShowDriveModal(false);
    setEditingDriveId(null);
  };

  const updateDriveField = (name, value) => {
    setDriveForm((prev) => ({ ...prev, [name]: value }));
    setDriveErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
  };

  const toggleDepartment = (dept) => {
    setDriveForm((prev) => {
      let next;
      if (dept === ALL_DEPARTMENTS) {
        next = prev.departments.includes(ALL_DEPARTMENTS) ? [] : [ALL_DEPARTMENTS];
      } else {
        const base = prev.departments.filter((d) => d !== ALL_DEPARTMENTS);
        next = base.includes(dept) ? base.filter((d) => d !== dept) : [...base, dept];
      }
      return { ...prev, departments: next };
    });
    setDriveErrors((prev) => ({ ...prev, departments: "" }));
  };

  const handleSaveDrive = async (e) => {
    e.preventDefault();
    if (driveSaving) return;
    const editing = drives.find((d) => d.id === editingDriveId);
    const result = validateDrive(driveForm, {
      drives,
      editingId: editingDriveId,
      maxRoundsCleared: editing ? maxRoundsClearedForDrive(editing) : 0,
    });
    if (!result.ok) {
      setDriveErrors(result.errors);
      setDriveSubmitError("Please fix the highlighted fields.");
      return;
    }
    if (editing && companyKey(editing.companyName) !== result.value.companyKey) {
      const linked = (participantsByDrive.get(editing.id) || []).filter((p) => p.fromOffer).length;
      if (
        linked > 0 &&
        !window.confirm(
          `${linked} placed student(s) are linked to "${editing.companyName}" by their PO offer. After renaming, they will only match if their offer uses the new name. Continue?`
        )
      ) {
        return;
      }
    }
    setDriveSaving(true);
    setDriveSubmitError("");
    try {
      await saveDrive(result.value, editingDriveId);
      setShowDriveModal(false);
      setEditingDriveId(null);
      setDriveForm(EMPTY_DRIVE_FORM);
    } catch (err) {
      setDriveSubmitError(friendlyError(err, "Could not save the drive. Try again."));
    } finally {
      setDriveSaving(false);
    }
  };

  const handleDeleteDrive = async (drive) => {
    const participants = participantsByDrive.get(drive.id) || [];
    const added = participants.filter((p) => !p.fromOffer).length;
    const message = added
      ? `Delete the ${drive.companyName} drive on ${drive.driveDate}?\n\nRound progress for ${added} student(s) will be lost. PO offers on student profiles are not affected.`
      : `Delete the ${drive.companyName} drive on ${drive.driveDate}?`;
    if (!window.confirm(message)) return;
    setBusyKey(`delete:${drive.id}`);
    try {
      await deleteDrive(drive.id);
      if (expandedCompanyId === drive.id) setExpandedCompanyId(null);
    } catch (err) {
      alert(friendlyError(err, "Could not delete the drive."));
    } finally {
      setBusyKey("");
    }
  };

  /* ----------------------------- candidates ----------------------------- */

  const handleAddCandidate = async (drive) => {
    setCandidateError("");
    const student = students.find((s) => s.id === candidateDraft.studentId);
    const eligibility = checkCandidateEligibility(student, drive);
    if (eligibility) return setCandidateError(eligibility);
    const roundsErr = validateRoundsCleared(candidateDraft.rounds, drive);
    if (roundsErr) return setCandidateError(roundsErr);
    setBusyKey(`add:${drive.id}`);
    try {
      await setCandidateRounds(drive.id, student.id, Number(candidateDraft.rounds));
      setCandidateDraft({ driveId: drive.id, studentId: "", rounds: "0", search: "" });
    } catch (err) {
      setCandidateError(friendlyError(err, "Could not add the student."));
    } finally {
      setBusyKey("");
    }
  };

  const handleSaveRounds = async (drive, participant) => {
    const key = `${drive.id}:${participant.student.id}`;
    const raw = roundEdits[key] ?? String(participant.roundsCleared);
    const err = validateRoundsCleared(raw, drive);
    if (err) return alert(err);
    setBusyKey(`rounds:${key}`);
    try {
      await setCandidateRounds(drive.id, participant.student.id, Number(raw));
      setRoundEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      alert(friendlyError(error, "Could not save rounds."));
    } finally {
      setBusyKey("");
    }
  };

  const handleRemoveCandidate = async (drive, participant) => {
    if (!window.confirm(`Remove ${participant.student.name} from the ${drive.companyName} drive?`)) return;
    setBusyKey(`remove:${drive.id}:${participant.student.id}`);
    try {
      await removeCandidate(drive.id, participant.student.id);
    } catch (err) {
      alert(friendlyError(err, "Could not remove the student."));
    } finally {
      setBusyKey("");
    }
  };

  const exportDrivesCsv = () => {
    const header = ["Company", "Role", "Package LPA", "Drive Date", "Departments", "Openings", "Rounds", "Candidates", "Selected", "Status"];
    const lines = companyProgressList.map((d) =>
      [d.companyName, d.role, d.packageLpa, d.driveDate, d.departments.join(" "), d.openings, d.rounds, d.participants.length, d.placedCount, d.status]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `placement-drives-${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-10">
        {/* HERO */}
        <section className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-500 text-white shadow-2xl">
          <div className="p-6 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="uppercase tracking-[0.25em] text-xs md:text-sm text-blue-100 font-semibold">
                    Placement ERP Dashboard
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    <span className={`h-1.5 w-1.5 rounded-full ${loadError ? "bg-rose-300" : "bg-emerald-300 animate-pulse"}`} />
                    {loadError ? "Sync error" : "Live"} · {selectedYear === "all" ? "All years" : `Year ${selectedYear}`}
                  </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold mt-3">{collegeLabel}</h1>
                <p className="mt-3 text-blue-100 max-w-2xl">
                  Placement drives, round progress, and analytics. Offers recorded by the PO update this page automatically.
                </p>
                {lastSynced && (
                  <p className="mt-2 text-xs text-blue-100/80">Last synced: {lastSynced.toLocaleTimeString()}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 min-w-[280px]">
                <div className="bg-white/15 backdrop-blur rounded-3xl p-5 border border-white/20">
                  <p className="text-sm text-white/90 font-semibold">Placement Rate</p>
                  <p className="text-3xl text-white font-bold mt-2">{loading ? "…" : `${placementRate}%`}</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-3xl p-5 border border-white/20">
                  <p className="text-sm text-white/90 font-semibold">Total Drives</p>
                  <p className="text-3xl text-white font-bold mt-2">{loading ? "…" : stats.totalPlacements}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm font-medium text-rose-800">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* QUICK NAV */}
        <section className="sticky top-3 z-30">
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-lg p-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <QuickButton label="Dashboard" onClick={() => scrollToSection(dashboardRef)} />
                <QuickButton label="Placements" onClick={() => scrollToSection(placementsRef)} />
                <QuickButton label="Analytics" onClick={() => scrollToSection(analyticsRef)} />
              </div>

              <div className="flex items-center gap-3 md:pl-4 md:border-l md:border-slate-200">
                <label htmlFor="placement-year" className="text-xs font-semibold uppercase tracking-wider text-slate-500 shrink-0">
                  Year
                </label>
                <div className="relative w-full md:w-44">
                  <select
                    id="placement-year"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setExpandedCompanyId(null);
                    }}
                    className="w-full appearance-none cursor-pointer rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 pl-4 pr-10 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                    <option value="all">All years</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-xl border-2 border-indigo-600 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading live placement data…</p>
          </div>
        ) : (
          <>
            {/* DASHBOARD */}
            <section ref={dashboardRef} className="scroll-mt-28">
              <SectionHeader
                title="Dashboard Overview"
                subtitle={
                  selectedYear === "all"
                    ? "All CRT students across every year"
                    : `CRT students graduating in ${selectedYear}, or with drives and offers that year`
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                <StatCard title="Total Students" value={stats.totalStudents} color="text-indigo-600" iconBg="bg-indigo-50" Icon={AcademicCapIcon} />
                <StatCard title="Placed" value={stats.placedStudents} color="text-emerald-600" iconBg="bg-emerald-50" Icon={CheckCircleIcon} />
                <StatCard title="Unplaced" value={stats.unplacedStudents} color="text-rose-600" iconBg="bg-rose-50" Icon={XCircleIcon} />
                <StatCard title="Offers" value={stats.finalRoundPlaced} color="text-blue-600" iconBg="bg-blue-50" Icon={FlagIcon} />
                <StatCard title="Rounds Cleared" value={stats.totalRoundsCleared} color="text-violet-600" iconBg="bg-violet-50" Icon={ChartBarIcon} />
                <StatCard title="Drives" value={stats.totalPlacements} color="text-orange-600" iconBg="bg-orange-50" Icon={BriefcaseIcon} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                <Card className="p-6 xl:col-span-2">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Placed vs Unplaced</h3>
                  {stats.totalStudents === 0 ? (
                    <p className="h-80 flex items-center justify-center text-sm text-slate-500">
                      No CRT students found for this year.
                    </p>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label>
                            {pieData.map((_, index) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </div>
            </section>

            {/* PLACEMENTS */}
            <section ref={placementsRef} className="scroll-mt-28">
              <SectionHeader
                title="Placements"
                subtitle="Company drives, eligibility, rounds and selections"
                action={
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={exportDrivesCsv}
                      disabled={companyProgressList.length === 0}
                      className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold shadow-sm hover:shadow disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={openNewDrive}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:shadow-xl transition"
                    >
                      + Add Drive
                    </button>
                  </div>
                }
              />

              <Card className="p-5 mb-5">
                <input
                  type="search"
                  placeholder="Search by company, role, department or package…"
                  value={placementSearch}
                  onChange={(e) => setPlacementSearch(e.target.value)}
                  maxLength={80}
                  className={inputClass}
                />
              </Card>

              <Card className="p-5">
                <h3 className="text-xl font-bold text-slate-800">Company Drives Tracker</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Open a drive to see rounds, branch-wise progress, and to manage the students attending it.
                </p>

                <div className="mt-4 space-y-3">
                  {companyProgressList.map((company) => {
                    const isOpen = expandedCompanyId === company.id;
                    const draftActive = candidateDraft.driveId === company.id;
                    const participantIds = new Set(company.participants.map((p) => p.student.id));
                    const search = draftActive ? candidateDraft.search.trim().toLowerCase() : "";
                    const addable = students
                      .filter((s) => !participantIds.has(s.id))
                      .filter((s) => !search || `${s.name} ${s.regNo} ${s.department}`.toLowerCase().includes(search))
                      .slice(0, 200);
                    return (
                      <div key={company.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedCompanyId(isOpen ? null : company.id);
                            setCandidateDraft({ driveId: company.id, studentId: "", rounds: "0", search: "" });
                            setCandidateError("");
                          }}
                          className="w-full px-4 py-3 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-3 text-left"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {company.companyName} <span className="text-slate-400 font-normal">· {company.role}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {company.driveDate} · {company.packageLpa} LPA · {company.departments.join(", ")} ·{" "}
                              {company.participants.length} attending · {company.placedCount} selected
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(company.status)}`}>
                            {company.status}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-4 py-4 bg-slate-50 border-t border-slate-200 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                              {[
                                ["Total Rounds", company.totalRounds],
                                ["Current Phase", company.phaseLabel],
                                ["Current Round", company.status === "Past" ? "—" : `Round ${company.currentRound}`],
                                ["Current Round Students", company.currentRoundStudents],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-white border border-slate-200 p-3">
                                  <p className="text-slate-500">{label}</p>
                                  <p className="font-bold text-slate-800">{value}</p>
                                </div>
                              ))}
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 mb-2">Branch-wise breakdown</h4>
                              {company.branchBreakdown.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                  <table className="w-full min-w-[640px] text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                                      <tr>
                                        {["Branch", "Students", "Drive status", "Phase", "Current round", "In current round"].map((h) => (
                                          <th key={h} className="p-3 font-semibold">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {company.branchBreakdown.map((row) => (
                                        <tr key={row.branch} className="border-t border-slate-100 hover:bg-slate-50/80">
                                          <td className="p-3 font-medium text-slate-800">{row.branch}</td>
                                          <td className="p-3 text-slate-700">{row.totalStudents}</td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(row.driveStatus)}`}>
                                              {row.driveStatus}
                                            </span>
                                          </td>
                                          <td className="p-3 text-slate-700">{row.phaseLabel}</td>
                                          <td className="p-3 text-slate-700">
                                            {row.currentRound == null ? "—" : `Round ${row.currentRound}`}
                                          </td>
                                          <td className="p-3 font-semibold text-slate-800">{row.currentRoundStudents}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2">
                                  No students attending yet. Add students below, or record an offer from the PO dashboard.
                                </p>
                              )}
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 mb-2">Students attending</h4>
                              {company.participants.length > 0 && (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white mb-3">
                                  <table className="w-full min-w-[720px] text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                                      <tr>
                                        {["Reg No", "Name", "Dept", "Rounds cleared", "Result", ""].map((h) => (
                                          <th key={h} className="p-3 font-semibold">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {company.participants.map((p) => {
                                        const key = `${company.id}:${p.student.id}`;
                                        const editValue = roundEdits[key] ?? String(p.roundsCleared);
                                        const dirty = editValue !== String(p.roundsCleared);
                                        return (
                                          <tr key={p.student.id} className="border-t border-slate-100">
                                            <td className="p-3 text-slate-600">{p.student.regNo}</td>
                                            <td className="p-3 font-medium text-slate-800">{p.student.name}</td>
                                            <td className="p-3 text-slate-600">{p.student.department}</td>
                                            <td className="p-3">
                                              {p.placed ? (
                                                <span className="text-slate-700">
                                                  {company.rounds}/{company.rounds}
                                                </span>
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={company.rounds}
                                                    step={1}
                                                    value={editValue}
                                                    onChange={(e) => setRoundEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                                                    className="w-20 border border-slate-200 rounded-lg px-2 py-1"
                                                    aria-label={`Rounds cleared by ${p.student.name}`}
                                                  />
                                                  <span className="text-xs text-slate-400">/ {company.rounds}</span>
                                                  {dirty && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleSaveRounds(company, p)}
                                                      disabled={busyKey === `rounds:${key}`}
                                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
                                                    >
                                                      {busyKey === `rounds:${key}` ? "Saving…" : "Save"}
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                            <td className="p-3">
                                              {p.placed ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                  Placed · {p.offer?.packageLpa || company.packageLpa} LPA
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                                  In process
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-3 text-right">
                                              {p.fromOffer ? (
                                                <span className="text-xs text-slate-400" title="Edit offers from the PO dashboard">
                                                  From PO offer
                                                </span>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveCandidate(company, p)}
                                                  disabled={busyKey === `remove:${company.id}:${p.student.id}`}
                                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                                                >
                                                  Remove
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold text-slate-600 mb-2">Add a student to this drive</p>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                  <input
                                    type="search"
                                    placeholder="Filter by name, reg no, dept"
                                    value={draftActive ? candidateDraft.search : ""}
                                    onChange={(e) =>
                                      setCandidateDraft((prev) => ({ ...prev, driveId: company.id, search: e.target.value }))
                                    }
                                    maxLength={60}
                                    className="md:col-span-4 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                  />
                                  <select
                                    value={draftActive ? candidateDraft.studentId : ""}
                                    onChange={(e) =>
                                      setCandidateDraft((prev) => ({ ...prev, driveId: company.id, studentId: e.target.value }))
                                    }
                                    className="md:col-span-4 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  >
                                    <option value="">Select student ({addable.length})</option>
                                    {addable.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name} — {s.regNo} — {s.department}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min={0}
                                    max={company.rounds}
                                    step={1}
                                    value={draftActive ? candidateDraft.rounds : "0"}
                                    onChange={(e) =>
                                      setCandidateDraft((prev) => ({ ...prev, driveId: company.id, rounds: e.target.value }))
                                    }
                                    className="md:col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                    aria-label="Rounds cleared"
                                    title="Rounds cleared"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddCandidate(company)}
                                    disabled={busyKey === `add:${company.id}` || !(draftActive && candidateDraft.studentId)}
                                    className="md:col-span-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2 disabled:opacity-50"
                                  >
                                    {busyKey === `add:${company.id}` ? "Adding…" : "Add"}
                                  </button>
                                </div>
                                {draftActive && candidateError && (
                                  <p className="mt-2 text-xs font-medium text-rose-600">{candidateError}</p>
                                )}
                                <p className="mt-2 text-[11px] text-slate-400">
                                  Students with a PO offer from {company.companyName} in {company.driveDate.slice(0, 4)} appear here automatically as placed.
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditDrive(company)}
                                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
                              >
                                Edit drive
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDrive(company)}
                                disabled={busyKey === `delete:${company.id}`}
                                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50"
                              >
                                {busyKey === `delete:${company.id}` ? "Deleting…" : "Delete drive"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {companyProgressList.length === 0 && (
                    <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                      {placementSearch
                        ? "No drives match your search."
                        : `No drives for ${selectedYear === "all" ? "any year" : selectedYear} yet. Use “+ Add Drive” to create one.`}
                    </p>
                  )}
                </div>
              </Card>
            </section>

            {/* ANALYTICS */}
            <section ref={analyticsRef} className="scroll-mt-28 space-y-10">
              <div>
                <SectionHeader title="Company Analytics" subtitle="Company-wise performance with department-wise round stats" />
                <AnalyticsTable
                  title="Company Wise Analytics"
                  firstColumn="Company Name"
                  rows={companyAnalytics}
                  description="Includes drive attendance and every PO-recorded offer. Round Stats: Round N --> DEPT-count. Off-campus offers count as placed with 0 rounds."
                />
              </div>
              <div>
                <SectionHeader title="Department Analytics" subtitle="Department-wise performance with company-wise round stats" />
                <AnalyticsTable
                  title="Department Wise Analytics"
                  firstColumn="Department Name"
                  rows={departmentAnalytics}
                  description="Same numbers grouped by department; round breakdowns are by company (e.g. Round 1 --> TCS-5)."
                />
              </div>
            </section>
          </>
        )}
      </main>

      {showDriveModal && (
        <Modal title={editingDriveId ? "Edit Placement Drive" : "Add Placement Drive"} onClose={closeDriveModal}>
          <form onSubmit={handleSaveDrive} noValidate className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Company name *" error={driveErrors.companyName}>
                <input
                  value={driveForm.companyName}
                  onChange={(e) => updateDriveField("companyName", e.target.value)}
                  maxLength={LIMITS.nameMax}
                  placeholder="e.g. Infosys"
                  className={inputClass}
                />
              </Field>
              <Field label="Role *" error={driveErrors.role}>
                <input
                  value={driveForm.role}
                  onChange={(e) => updateDriveField("role", e.target.value)}
                  maxLength={LIMITS.nameMax}
                  placeholder="e.g. Systems Engineer"
                  className={inputClass}
                />
              </Field>
              <Field label="Package (LPA) *" error={driveErrors.packageLpa} hint={`${LIMITS.packageMin} – ${LIMITS.packageMax} LPA`}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={LIMITS.packageMin}
                  max={LIMITS.packageMax}
                  value={driveForm.packageLpa}
                  onChange={(e) => updateDriveField("packageLpa", e.target.value)}
                  placeholder="e.g. 6.5"
                  className={inputClass}
                />
              </Field>
              <Field label="Drive date *" error={driveErrors.driveDate}>
                <input
                  type="date"
                  value={driveForm.driveDate}
                  onChange={(e) => updateDriveField("driveDate", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Openings *" error={driveErrors.openings} hint={`1 – ${LIMITS.openingsMax}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITS.openingsMax}
                  step={1}
                  value={driveForm.openings}
                  onChange={(e) => updateDriveField("openings", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Number of rounds *" error={driveErrors.rounds} hint={`1 – ${LIMITS.roundsMax}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITS.roundsMax}
                  step={1}
                  value={driveForm.rounds}
                  onChange={(e) => updateDriveField("rounds", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Max backlogs allowed" error={driveErrors.maxBacklogs} hint="Leave empty for no limit">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={LIMITS.backlogsMax}
                  step={1}
                  value={driveForm.maxBacklogs}
                  onChange={(e) => updateDriveField("maxBacklogs", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Eligible departments *" error={driveErrors.departments}>
              <div className="flex flex-wrap gap-2">
                {[ALL_DEPARTMENTS, ...departmentOptions].map((dept) => {
                  const active = driveForm.departments.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${
                        active
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                      }`}
                    >
                      {dept === ALL_DEPARTMENTS ? "All departments" : dept}
                    </button>
                  );
                })}
              </div>
            </Field>

            {driveSubmitError && (
              <p className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700">
                {driveSubmitError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={driveSaving}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-2xl font-semibold disabled:opacity-60"
              >
                {driveSaving ? "Saving…" : editingDriveId ? "Update Drive" : "Save Drive"}
              </button>
              <button
                type="button"
                onClick={closeDriveModal}
                disabled={driveSaving}
                className="bg-slate-200 hover:bg-slate-300 px-5 py-3 rounded-2xl font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
