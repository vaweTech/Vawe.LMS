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

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  FlagIcon,
  ChartBarIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function SingleCollegePlacementERP() {
  const COLLEGE_NAME = "ABC Engineering College";
  const today = new Date().toISOString().split("T")[0];

  const [placements, setPlacements] = useState([
    {
      id: 1,
      companyName: "Infosys",
      role: "Software Engineer",
      package: "6 LPA",
      driveDate: "2026-04-10",
      department: "CSE",
      openings: 50,
      rounds: 4,
      selectedStudents: 2,
    },
    {
      id: 2,
      companyName: "TCS",
      role: "Developer",
      package: "7 LPA",
      driveDate: "2026-04-03",
      department: "ECE",
      openings: 40,
      rounds: 3,
      selectedStudents: 1,
    },
    {
      id: 3,
      companyName: "Wipro",
      role: "Analyst",
      package: "4.5 LPA",
      driveDate: "2026-04-01",
      department: "IT",
      openings: 30,
      rounds: 5,
      selectedStudents: 2,
    },
  ]);

  const [students, setStudents] = useState([
    { id: 1, name: "Rahul", department: "CSE", companyName: "Infosys", placed: true, roundsCleared: 4, finalRoundPlaced: true },
    { id: 2, name: "Priya", department: "CSE", companyName: "Infosys", placed: false, roundsCleared: 2, finalRoundPlaced: false },
    { id: 3, name: "Akhil", department: "ECE", companyName: "Infosys", placed: true, roundsCleared: 3, finalRoundPlaced: true },
    { id: 4, name: "Sneha", department: "ECE", companyName: "Infosys", placed: false, roundsCleared: 1, finalRoundPlaced: false },
    { id: 5, name: "Kiran", department: "EEE", companyName: "TCS", placed: true, roundsCleared: 3, finalRoundPlaced: true },
    { id: 6, name: "Harsha", department: "MECH", companyName: "TCS", placed: false, roundsCleared: 1, finalRoundPlaced: false },
    { id: 7, name: "Divya", department: "CSE", companyName: "TCS", placed: false, roundsCleared: 2, finalRoundPlaced: false },
    { id: 8, name: "Nikhil", department: "IT", companyName: "Wipro", placed: false, roundsCleared: 3, finalRoundPlaced: false },
    { id: 9, name: "Anjali", department: "IT", companyName: "Wipro", placed: true, roundsCleared: 5, finalRoundPlaced: true },
    { id: 10, name: "Vamsi", department: "CSE", companyName: "Wipro", placed: true, roundsCleared: 4, finalRoundPlaced: true },
  ]);

  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingPlacementId, setEditingPlacementId] = useState(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);

  const [placementSearch, setPlacementSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const dashboardRef = useRef(null);
  const placementsRef = useRef(null);
  const studentsRef = useRef(null);
  const analyticsRef = useRef(null);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [placementForm, setPlacementForm] = useState({
    companyName: "",
    role: "",
    package: "",
    driveDate: "",
    department: "",
    openings: "",
    rounds: "",
    backlogs: "",
    selectedStudents: "",
  });

  const [studentForm, setStudentForm] = useState({
    name: "",
    department: "",
    companyName: "",
    placed: "false",
    roundsCleared: "",
    backlogs: "",
    finalRoundPlaced: "false",
  });

  const getPlacementStatus = useCallback((date) => {
    if (date > today) return "Upcoming";
    if (date === today) return "Current";
    return "Past";
  }, [today]);

  const getStatusBadge = (status) => {
    if (status === "Upcoming") return "bg-sky-100 text-sky-700 border border-sky-200";
    if (status === "Current") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  const resetPlacementForm = () =>
    setPlacementForm({
      companyName: "",
      role: "",
      package: "",
      driveDate: "",
      department: "",
      openings: "",
      rounds: "",
      backlogs: "",
      selectedStudents: "",
    });

  const resetStudentForm = () =>
    setStudentForm({
      name: "",
      department: "",
      companyName: "",
      placed: "false",
      roundsCleared: "",
      backlogs: "",
      finalRoundPlaced: "false",
    });

  const stats = useMemo(() => {
    const totalStudents = students.length;
    const placedStudents = students.filter((s) => s.placed).length;
    const unplacedStudents = totalStudents - placedStudents;
    const finalRoundPlaced = students.filter((s) => s.finalRoundPlaced).length;
    const totalRoundsCleared = students.reduce((sum, s) => sum + Number(s.roundsCleared || 0), 0);

    return {
      totalStudents,
      placedStudents,
      unplacedStudents,
      finalRoundPlaced,
      totalRoundsCleared,
      totalPlacements: placements.length,
    };
  }, [students, placements]);

  const placementRate = stats.totalStudents
    ? ((stats.placedStudents / stats.totalStudents) * 100).toFixed(1)
    : 0;

  const pieData = [
    { name: "Placed", value: stats.placedStudents },
    { name: "Unplaced", value: stats.unplacedStudents },
  ];

  const PIE_COLORS = ["#10b981", "#ef4444"];

  const filteredPlacements = useMemo(() => {
    const q = placementSearch.toLowerCase();
    return placements.filter((p) =>
      `${p.companyName} ${p.role} ${p.department} ${p.package}`.toLowerCase().includes(q)
    );
  }, [placements, placementSearch]);

  const companyProgressList = useMemo(() => {
    return filteredPlacements.map((placement) => {
      const companyStudents = students.filter(
        (student) =>
          (student.companyName || "").trim().toLowerCase() ===
          (placement.companyName || "").trim().toLowerCase()
      );

      const status = getPlacementStatus(placement.driveDate);
      const totalRounds = Math.max(Number(placement.rounds || 0), 0);
      const maxRoundsCleared = companyStudents.reduce(
        (max, student) => Math.max(max, Number(student.roundsCleared || 0)),
        0
      );
      const inferredRound =
        status === "Upcoming"
          ? 1
          : status === "Past"
            ? totalRounds
            : Math.min(Math.max(maxRoundsCleared + 1, 1), Math.max(totalRounds, 1));
      const currentRound = Math.max(inferredRound, 1);

      const currentRoundStudents =
        status === "Past"
          ? 0
          : status === "Upcoming"
            ? companyStudents.filter((student) => Number(student.roundsCleared || 0) === 0).length
            : companyStudents.filter(
                (student) =>
                  Number(student.roundsCleared || 0) === currentRound - 1 &&
                  !student.finalRoundPlaced
              ).length;

      const phaseLabel =
        status === "Upcoming"
          ? "Yet to Start"
          : status === "Current"
            ? `Round ${currentRound} In Progress`
            : "Completed";

      const branchNames = [
        ...new Set(companyStudents.map((s) => (s.department || "Unknown").trim() || "Unknown")),
      ].sort((a, b) => a.localeCompare(b));

      const branchBreakdown = branchNames.map((branch) => {
        const branchStudents = companyStudents.filter(
          (s) => ((s.department || "Unknown").trim() || "Unknown") === branch
        );
        const brMax = branchStudents.reduce(
          (max, student) => Math.max(max, Number(student.roundsCleared || 0)),
          0
        );
        const brCurrentRound = Math.max(
          status === "Upcoming"
            ? 1
            : status === "Past"
              ? totalRounds
              : Math.min(Math.max(brMax + 1, 1), Math.max(totalRounds, 1)),
          1
        );
        const brPhaseLabel =
          status === "Upcoming"
            ? "Yet to Start"
            : status === "Current"
              ? `Round ${brCurrentRound} In Progress`
              : "Completed";
        const brCurrentRoundStudents =
          status === "Past"
            ? 0
            : status === "Upcoming"
              ? branchStudents.filter((student) => Number(student.roundsCleared || 0) === 0).length
              : branchStudents.filter(
                  (student) =>
                    Number(student.roundsCleared || 0) === brCurrentRound - 1 &&
                    !student.finalRoundPlaced
                ).length;

        return {
          branch,
          totalStudents: branchStudents.length,
          currentRound: status === "Past" ? null : brCurrentRound,
          phaseLabel: brPhaseLabel,
          driveStatus: status,
          currentRoundStudents: brCurrentRoundStudents,
        };
      });

      return {
        ...placement,
        status,
        phaseLabel,
        totalRounds,
        currentRound,
        currentRoundStudents,
        totalStudents: companyStudents.length,
        branchBreakdown,
      };
    });
  }, [filteredPlacements, students, getPlacementStatus]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return students.filter((s) =>
      `${s.name} ${s.department} ${s.companyName}`.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const sortRoundStats = (roundStats) => {
    const entries = Object.entries(roundStats);
    entries.sort(([a], [b]) => {
      if (a === "Final Round") return 1;
      if (b === "Final Round") return -1;
      const aNum = Number(a.replace("Round ", ""));
      const bNum = Number(b.replace("Round ", ""));
      return aNum - bNum;
    });
    return Object.fromEntries(entries);
  };

  // Company-wise analytics with department-wise counts per round
  const companyAnalytics = useMemo(() => {
    const map = {};

    students.forEach((student) => {
      const companyName = student.companyName || "Unassigned";

      if (!map[companyName]) {
        map[companyName] = {
          companyName,
          total: 0,
          placed: 0,
          unplaced: 0,
          roundsCleared: 0,
          finalRoundPlaced: 0,
          roundStats: {},
        };
      }

      const company = map[companyName];
      const dept = student.department || "Unknown";
      const cleared = Number(student.roundsCleared || 0);

      company.total += 1;
      company.roundsCleared += cleared;

      if (student.placed) company.placed += 1;
      else company.unplaced += 1;

      if (student.finalRoundPlaced) company.finalRoundPlaced += 1;

      for (let r = 1; r <= cleared; r++) {
        const roundKey = `Round ${r}`;
        if (!company.roundStats[roundKey]) company.roundStats[roundKey] = {};
        if (!company.roundStats[roundKey][dept]) company.roundStats[roundKey][dept] = 0;
        company.roundStats[roundKey][dept] += 1;
      }

      if (student.finalRoundPlaced) {
        const finalKey = "Final Round";
        if (!company.roundStats[finalKey]) company.roundStats[finalKey] = {};
        if (!company.roundStats[finalKey][dept]) company.roundStats[finalKey][dept] = 0;
        company.roundStats[finalKey][dept] += 1;
      }
    });

    return Object.values(map)
      .map((company) => ({
        ...company,
        roundStats: sortRoundStats(company.roundStats),
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [students]);

  // Department-wise analytics with company-wise counts per round (mirror of company analytics)
  const departmentAnalytics = useMemo(() => {
    const map = {};

    students.forEach((student) => {
      const departmentName = student.department || "Unknown";
      const companyName = student.companyName || "Unassigned";
      const cleared = Number(student.roundsCleared || 0);

      if (!map[departmentName]) {
        map[departmentName] = {
          departmentName,
          total: 0,
          placed: 0,
          unplaced: 0,
          roundsCleared: 0,
          finalRoundPlaced: 0,
          roundStats: {},
        };
      }

      const deptRow = map[departmentName];

      deptRow.total += 1;
      deptRow.roundsCleared += cleared;

      if (student.placed) deptRow.placed += 1;
      else deptRow.unplaced += 1;

      if (student.finalRoundPlaced) deptRow.finalRoundPlaced += 1;

      for (let r = 1; r <= cleared; r++) {
        const roundKey = `Round ${r}`;
        if (!deptRow.roundStats[roundKey]) deptRow.roundStats[roundKey] = {};
        if (!deptRow.roundStats[roundKey][companyName]) deptRow.roundStats[roundKey][companyName] = 0;
        deptRow.roundStats[roundKey][companyName] += 1;
      }

      if (student.finalRoundPlaced) {
        const finalKey = "Final Round";
        if (!deptRow.roundStats[finalKey]) deptRow.roundStats[finalKey] = {};
        if (!deptRow.roundStats[finalKey][companyName]) deptRow.roundStats[finalKey][companyName] = 0;
        deptRow.roundStats[finalKey][companyName] += 1;
      }
    });

    return Object.values(map)
      .map((row) => ({
        ...row,
        roundStats: sortRoundStats(row.roundStats),
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }, [students]);

  const handlePlacementChange = (e) => {
    setPlacementForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleStudentChange = (e) => {
    setStudentForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddPlacement = (e) => {
    e.preventDefault();

    if (!placementForm.companyName || !placementForm.role || !placementForm.driveDate || !placementForm.department) {
      alert("Please fill Company Name, Role, Drive Date, and Department");
      return;
    }

    const placementPayload = {
      companyName: placementForm.companyName,
      role: placementForm.role,
      package: placementForm.package,
      driveDate: placementForm.driveDate,
      department: placementForm.department,
      openings: Number(placementForm.openings || 0),
      rounds: Number(placementForm.rounds || 0),
      backlogs: Number(placementForm.backlogs || 0),
      selectedStudents: Number(placementForm.selectedStudents || 0),
    };

    if (editingPlacementId) {
      setPlacements((prev) =>
        prev.map((placement) =>
          placement.id === editingPlacementId
            ? { ...placementPayload, id: editingPlacementId }
            : placement
        )
      );
    } else {
      setPlacements((prev) => [{ ...placementPayload, id: Date.now() }, ...prev]);
    }

    setEditingPlacementId(null);
    resetPlacementForm();
    setShowPlacementModal(false);
  };

  const handleEditPlacement = (placement) => {
    setEditingPlacementId(placement.id);
    setPlacementForm({
      companyName: placement.companyName || "",
      role: placement.role || "",
      package: placement.package || "",
      driveDate: placement.driveDate || "",
      department: placement.department || "",
      openings: String(placement.openings ?? ""),
      rounds: String(placement.rounds ?? ""),
      backlogs: String(placement.backlogs ?? ""),
      selectedStudents: String(placement.selectedStudents ?? ""),
    });
    setShowPlacementModal(true);
  };

  const closePlacementModal = () => {
    setShowPlacementModal(false);
    setEditingPlacementId(null);
    resetPlacementForm();
  };

  const handleAddStudent = (e) => {
    e.preventDefault();

    if (!studentForm.name || !studentForm.department) {
      alert("Please fill Student Name and Department");
      return;
    }

    const newStudent = {
      id: Date.now(),
      name: studentForm.name,
      department: studentForm.department,
      companyName: studentForm.companyName || "",
      placed: studentForm.placed === "true",
      roundsCleared: Number(studentForm.roundsCleared || 0),
      backlogs: Number(studentForm.backlogs || 0),
      finalRoundPlaced: studentForm.finalRoundPlaced === "true",
    };

    setStudents((prev) => [newStudent, ...prev]);
    resetStudentForm();
    setShowStudentModal(false);
  };

  const deletePlacement = (id) => {
    if (!window.confirm("Delete this placement drive?")) return;
    setPlacements((prev) => prev.filter((p) => p.id !== id));
  };

  const deleteStudent = (id) => {
    if (!window.confirm("Delete this student?")) return;
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const StatCard = ({ title, value, color, Icon, iconBg }) => (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <h2 className={`text-3xl font-bold mt-2 ${color}`}>{value}</h2>
        </div>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ring-1 ring-black/[0.04] ${iconBg}`}
        >
          <Icon className={`h-6 w-6 ${color}`} aria-hidden />
        </div>
      </div>
    </div>
  );

  const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );

  const SectionHeader = ({ title, subtitle, action }) => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );

  const QuickButton = ({ label, onClick }) => (
    <button
      onClick={onClick}
      className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold shadow-sm hover:shadow transition-all"
    >
      {label}
    </button>
  );

  const formatRoundBreakdown = (breakdown) =>
    Object.entries(breakdown || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => `${label}-${count}`)
      .join(", ");

  const RoundStatsCell = ({ row }) => {
    const entries = Object.entries(row.roundStats || {});
    if (entries.length === 0) {
      return <span className="text-slate-400">No data</span>;
    }
    return (
      <div className="space-y-1.5 text-xs text-slate-700 max-h-40 overflow-y-auto pr-1">
        {entries.map(([round, breakdown]) => (
          <div key={round} className="leading-snug">
            <span className="font-semibold text-slate-800">{round}</span>
            <span className="text-slate-600"> {" --> "} </span>
            <span>{formatRoundBreakdown(breakdown)}</span>
          </div>
        ))}
      </div>
    );
  };

  const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  const inputClass =
    "w-full border border-slate-200 p-3 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-10">

        {/* HERO */}
        <section className="rounded-[2rem] overflow-hidden bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-500 text-white shadow-2xl">
          <div className="p-6 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <p className="uppercase tracking-[0.25em] text-xs md:text-sm text-blue-100 font-semibold">
                  Placement ERP Dashboard
                </p>
                <h1 className="text-3xl md:text-5xl font-extrabold mt-3">{COLLEGE_NAME}</h1>
                <p className="mt-3 text-blue-100 max-w-2xl">
                  Manage placement drives, student records, and department analytics with a modern, professional dashboard.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 min-w-[280px]">
                <div className="bg-white/15 backdrop-blur rounded-3xl p-5 border border-black/20">
                  <p className="text-sm text-black/80 font-semibold">Placement Rate</p>
                  <p className="text-3xl text-black/80 font-bold mt-2">{placementRate}%</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-3xl p-5 border border-white/20">
                  <p className="text-sm text-black/80 font-semibold">Total Drives</p>
                  <p className="text-3xl text-black/80 font-bold mt-2">{stats.totalPlacements}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUICK NAV */}
        <section className="sticky top-3 z-30">
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-lg p-3">
            <div className="flex flex-wrap gap-3">
              <QuickButton label="Dashboard" onClick={() => scrollToSection(dashboardRef)} />
              <QuickButton label="Placements" onClick={() => scrollToSection(placementsRef)} />
              <QuickButton label="Analytics" onClick={() => scrollToSection(analyticsRef)} />
            </div>
          </div>
        </section>

        {/* DASHBOARD */}
        <section ref={dashboardRef} className="scroll-mt-28">
          <SectionHeader title="Dashboard Overview" subtitle="Quick insights of placement performance" />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              color="text-indigo-600"
              iconBg="bg-indigo-50"
              Icon={AcademicCapIcon}
            />
            <StatCard
              title="Placed"
              value={stats.placedStudents}
              color="text-emerald-600"
              iconBg="bg-emerald-50"
              Icon={CheckCircleIcon}
            />
            <StatCard
              title="Unplaced"
              value={stats.unplacedStudents}
              color="text-rose-600"
              iconBg="bg-rose-50"
              Icon={XCircleIcon}
            />
            <StatCard
              title="Final Round"
              value={stats.finalRoundPlaced}
              color="text-blue-600"
              iconBg="bg-blue-50"
              Icon={FlagIcon}
            />
            <StatCard
              title="Rounds Cleared"
              value={stats.totalRoundsCleared}
              color="text-violet-600"
              iconBg="bg-violet-50"
              Icon={ChartBarIcon}
            />
            <StatCard
              title="Drives"
              value={stats.totalPlacements}
              color="text-orange-600"
              iconBg="bg-orange-50"
              Icon={BriefcaseIcon}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
            <Card className="p-6 xl:col-span-2">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Placed vs Unplaced</h3>
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
            </Card>

          </div>
        </section>

        {/* PLACEMENTS */}
        <section ref={placementsRef} className="scroll-mt-28">
          <Card className="p-5 mb-5">
            <h3 className="text-xl font-bold text-slate-800">Current Companies Tracker</h3>
            <p className="text-sm text-slate-500 mt-1">
              Click a company to view rounds, current phase, and current round student count.
            </p>

            <div className="mt-4 space-y-3">
              {companyProgressList.map((company) => (
                <div key={company.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCompanyId((prev) => (prev === company.id ? null : company.id))
                    }
                    className="w-full px-4 py-3 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{company.companyName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{company.role}</p>
                      {company.department && (
                        <p className="text-xs text-slate-400 mt-0.5">Drive department: {company.department}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(company.status)}`}>
                      {company.status}
                    </span>
                  </button>

                  {expandedCompanyId === company.id && (
                    <div className="px-4 py-4 bg-slate-50 border-t border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-xl bg-white border border-slate-200 p-3">
                          <p className="text-slate-500">Total Rounds</p>
                          <p className="font-bold text-slate-800">{company.totalRounds}</p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-3">
                          <p className="text-slate-500">Current Phase</p>
                          <p className="font-bold text-slate-800">{company.phaseLabel}</p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-3">
                          <p className="text-slate-500">Current Round</p>
                          <p className="font-bold text-slate-800">
                            {company.status === "Past" ? "-" : `Round ${company.currentRound}`}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-3">
                          <p className="text-slate-500">Current Round Students</p>
                          <p className="font-bold text-slate-800">{company.currentRoundStudents}</p>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        Total assigned students:{" "}
                        <span className="font-semibold text-slate-700">{company.totalStudents}</span>
                      </div>

                      <div className="mt-5">
                        <h4 className="text-sm font-semibold text-slate-800 mb-2">Branch-wise breakdown</h4>
                        {company.branchBreakdown.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full min-w-[640px] text-sm text-left">
                              <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                                <tr>
                                  <th className="p-3 font-semibold">Branch</th>
                                  <th className="p-3 font-semibold">Students</th>
                                  <th className="p-3 font-semibold">Drive status</th>
                                  <th className="p-3 font-semibold">Phase</th>
                                  <th className="p-3 font-semibold">Current round</th>
                                  <th className="p-3 font-semibold">In current round</th>
                                </tr>
                              </thead>
                              <tbody>
                                {company.branchBreakdown.map((row) => (
                                  <tr
                                    key={`${company.id}-${row.branch}`}
                                    className="border-t border-slate-100 hover:bg-slate-50/80"
                                  >
                                    <td className="p-3 font-medium text-slate-800">{row.branch}</td>
                                    <td className="p-3 text-slate-700">{row.totalStudents}</td>
                                    <td className="p-3">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(row.driveStatus)}`}
                                      >
                                        {row.driveStatus}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-700">{row.phaseLabel}</td>
                                    <td className="p-3 text-slate-700">
                                      {row.driveStatus === "Past" || row.currentRound == null
                                        ? "—"
                                        : `Round ${row.currentRound}`}
                                    </td>
                                    <td className="p-3 font-semibold text-slate-800">{row.currentRoundStudents}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2">
                            No students linked to this company yet. Assign students with a matching company name to see branch-wise counts and phases.
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditPlacement(company)}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePlacement(company.id)}
                          className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {companyProgressList.length === 0 && (
                <p className="text-sm text-slate-500">No companies found for the current search.</p>
              )}
            </div>
          </Card>
          <SectionHeader
            title="Placements"
            subtitle="Manage company drives, roles, packages, and statuses"
            action={
              <button
                onClick={() => {
                  setEditingPlacementId(null);
                  resetPlacementForm();
                  setShowPlacementModal(true);
                }}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:shadow-xl transition"
              >
                + Add Placement
              </button>
            }
          />
          <Card className="p-5 mb-5">
            <input
              type="text"
              placeholder="Search placements..."
              value={placementSearch}
              onChange={(e) => setPlacementSearch(e.target.value)}
              className={inputClass}
            />
          </Card>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    {["Company", "Role", "Package", "Date", "Department", "Openings", "Rounds", "Selected", "Status", "Action"].map((h) => (
                      <th key={h} className="p-4 text-slate-600 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlacements.map((p) => {
                    const status = getPlacementStatus(p.driveDate);
                    return (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                        <td className="p-4 font-semibold text-slate-800">{p.companyName}</td>
                        <td className="p-4 text-slate-700">{p.role}</td>
                        <td className="p-4 text-slate-700">{p.package}</td>
                        <td className="p-4 text-slate-700">{p.driveDate}</td>
                        <td className="p-4 text-slate-700">{p.department}</td>
                        <td className="p-4 text-slate-700">{p.openings}</td>
                        <td className="p-4 text-slate-700">{p.rounds}</td>
                        <td className="p-4 text-slate-700">{p.selectedStudents}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleEditPlacement(p)}
                            className="px-3 py-2 mr-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deletePlacement(p.id)}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
        {/* ANALYTICS */}
        <section ref={analyticsRef} className="scroll-mt-28 space-y-10">
          <div>
            <SectionHeader
              title="Company Analytics"
              subtitle="Company-wise performance with department-wise round stats"
            />

            <Card className="overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800">Company Wise Analytics</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Department-wise headcount per round appears in the last column (format: Round N {" --> "}
                  DEPT-count, …). Final Round lists students who cleared the final round.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Company Name",
                        "Total Attended",
                        "Placed",
                        "Unplaced",
                        "Rounds Cleared",
                        "Final Round Placed",
                        "Round Stats",
                      ].map((h) => (
                        <th key={h} className="p-4 text-left text-slate-600 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {companyAnalytics.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-slate-100 hover:bg-slate-50/70 transition"
                      >
                        <td className="p-4 font-semibold text-slate-800">{row.companyName}</td>
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

                    {companyAnalytics.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No analytics data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div>
            <SectionHeader
              title="Department Analytics"
              subtitle="Department-wise performance with company-wise round stats"
            />

            <Card className="overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800">Department Wise Analytics</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Same columns as company analytics; round breakdowns are by company (e.g. Round 1 {" --> "}
                  TCS-5, Infosys-3). Final Round lists students who cleared the final round.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Department Name",
                        "Total Attended",
                        "Placed",
                        "Unplaced",
                        "Rounds Cleared",
                        "Final Round Placed",
                        "Round Stats",
                      ].map((h) => (
                        <th key={h} className="p-4 text-left text-slate-600 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departmentAnalytics.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-slate-100 hover:bg-slate-50/70 transition"
                      >
                        <td className="p-4 font-semibold text-slate-800">{row.departmentName}</td>
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

                    {departmentAnalytics.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No analytics data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* MODALS */}
      {showPlacementModal && (
        <Modal
          title={editingPlacementId ? "Edit Placement" : "Add New Placement"}
          onClose={closePlacementModal}
        >
          <form onSubmit={handleAddPlacement} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input name="companyName" placeholder="Company Name" value={placementForm.companyName} onChange={handlePlacementChange} className={inputClass} />
              <input name="role" placeholder="Role" value={placementForm.role} onChange={handlePlacementChange} className={inputClass} />
              <input name="package" placeholder="Package (e.g. 6 LPA)" value={placementForm.package} onChange={handlePlacementChange} className={inputClass} />
              <input type="date" name="driveDate" value={placementForm.driveDate} onChange={handlePlacementChange} className={inputClass} />
              <input name="department" placeholder="Department" value={placementForm.department} onChange={handlePlacementChange} className={inputClass} />
              <input name="openings" placeholder="Openings" value={placementForm.openings} onChange={handlePlacementChange} className={inputClass} />
              <input name="rounds" placeholder="Number of Rounds" value={placementForm.rounds} onChange={handlePlacementChange} className={inputClass} />
              <input
                type="number"
                min="0"
                name="backlogs"
                placeholder="Number of Backlogs"
                value={placementForm.backlogs}
                onChange={handlePlacementChange}
                className={inputClass}
              />
              <input name="selectedStudents" placeholder="Selected Students" value={placementForm.selectedStudents} onChange={handlePlacementChange} className={inputClass} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-2xl font-semibold">
                {editingPlacementId ? "Update Placement" : "Save Placement"}
              </button>
              <button type="button" onClick={closePlacementModal} className="bg-slate-200 hover:bg-slate-300 px-5 py-3 rounded-2xl font-semibold text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showStudentModal && (
        <Modal
          title="Add New Student"
          onClose={() => {
            setShowStudentModal(false);
            resetStudentForm();
          }}
        >
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input name="name" placeholder="Student Name" value={studentForm.name} onChange={handleStudentChange} className={inputClass} />
              <input name="department" placeholder="Department" value={studentForm.department} onChange={handleStudentChange} className={inputClass} />

              <select name="companyName" value={studentForm.companyName} onChange={handleStudentChange} className={inputClass}>
                <option value="">Select Company (optional)</option>
                {placements.map((p) => (
                  <option key={p.id} value={p.companyName}>{p.companyName}</option>
                ))}
              </select>

              <input name="roundsCleared" placeholder="Rounds Cleared" value={studentForm.roundsCleared} onChange={handleStudentChange} className={inputClass} />
              <input
                type="number"
                min="0"
                name="backlogs"
                placeholder="Number of Backlogs"
                value={studentForm.backlogs}
                onChange={handleStudentChange}
                className={inputClass}
              />

              <select name="placed" value={studentForm.placed} onChange={handleStudentChange} className={inputClass}>
                <option value="false">Unplaced</option>
                <option value="true">Placed</option>
              </select>

              <select name="finalRoundPlaced" value={studentForm.finalRoundPlaced} onChange={handleStudentChange} className={inputClass}>
                <option value="false">Final Round Not Cleared</option>
                <option value="true">Final Round Placed</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3 rounded-2xl font-semibold">
                Save Student
              </button>
              <button type="button" onClick={() => { setShowStudentModal(false); resetStudentForm(); }} className="bg-slate-200 hover:bg-slate-300 px-5 py-3 rounded-2xl font-semibold text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}