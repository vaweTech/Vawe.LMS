// "use client";

// import { useMemo, useState } from "react";

// const Card = ({ children, className = "" }) => (
//   <div className={`bg-white rounded-2xl shadow border border-gray-200 ${className}`}>
//     {children}
//   </div>
// );

// // 🔹 Dummy Data
// const placementData = {
//   upcoming: [
//     {
//       id: 1,
//       name: "Infosys",
//       type: "On-Campus",
//       role: "System Engineer",
//       date: "2026-01-15",
//       openings: 25,
//       branches: ["CSE", "ECE", "EEE"],
//       eligibleStudents: [
//         { id: 1, name: "Rahul", branch: "CSE" },
//         { id: 2, name: "Kiran", branch: "ECE" },
//         { id: 3, name: "Mahesh", branch: "EEE" },
//         { id: 4, name: "Sneha", branch: "CSE" },
//       ],
//     },
//     {
//       id: 2,
//       name: "Wipro",
//       type: "Off-Campus",
//       role: "Project Engineer",
//       date: "2026-01-22",
//       openings: 18,
//       branches: ["CSE", "MECH", "MBA"],
//       eligibleStudents: [
//         { id: 5, name: "Arjun", branch: "CSE" },
//         { id: 6, name: "Divya", branch: "MBA" },
//         { id: 7, name: "Vikas", branch: "MECH" },
//       ],
//     },
//   ],

//   ongoing: [
//     {
//       id: 3,
//       name: "TCS",
//       type: "On-Campus",
//       role: "Ninja / Digital",
//       startDate: "2026-01-05",
//       openings: 40,
//       branches: ["CSE", "ECE", "EEE", "MECH"],
//       totalEligible: 120,
//       attended: 95,
//       currentRound: "Technical Interview",
//       roundsRemaining: 1,
//       status: "Technical Round Ongoing",
//       branchWiseEligible: {
//         CSE: 45,
//         ECE: 30,
//         EEE: 20,
//         MECH: 25,
//       },
//       shortlistedStudents: [
//         { id: 1, name: "Rahul", branch: "CSE", status: "Shortlisted" },
//         { id: 2, name: "Kiran", branch: "ECE", status: "In Progress" },
//         { id: 3, name: "Vamsi", branch: "EEE", status: "Shortlisted" },
//       ],
//     },
//     {
//       id: 4,
//       name: "Accenture",
//       type: "On-Campus",
//       role: "Associate Software Engineer",
//       startDate: "2026-01-08",
//       openings: 30,
//       branches: ["CSE", "ECE", "MCA"],
//       totalEligible: 85,
//       attended: 72,
//       currentRound: "HR Round",
//       roundsRemaining: 0,
//       status: "Final Round Completed, Results Pending",
//       branchWiseEligible: {
//         CSE: 40,
//         ECE: 28,
//         MCA: 17,
//       },
//       shortlistedStudents: [
//         { id: 4, name: "Sneha", branch: "CSE", status: "HR Completed" },
//         { id: 5, name: "Manoj", branch: "ECE", status: "HR Completed" },
//       ],
//     },
//   ],

//   completed: [
//     {
//       id: 5,
//       name: "Capgemini",
//       type: "On-Campus",
//       role: "Analyst",
//       completedDate: "2025-12-20",
//       openings: 20,
//       branches: ["CSE", "ECE", "EEE"],
//       totalEligible: 90,
//       attended: 75,
//       selectedCount: 12,
//       placedStudents: [
//         { id: 1, name: "Rahul", branch: "CSE", package: "4.5 LPA" },
//         { id: 2, name: "Priya", branch: "ECE", package: "4.5 LPA" },
//         { id: 3, name: "Venu", branch: "EEE", package: "4.5 LPA" },
//       ],
//       branchWisePlaced: {
//         CSE: 6,
//         ECE: 4,
//         EEE: 2,
//       },
//       status: "Completed",
//     },
//     {
//       id: 6,
//       name: "Cognizant",
//       type: "Off-Campus",
//       role: "Programmer Analyst",
//       completedDate: "2025-12-10",
//       openings: 15,
//       branches: ["CSE", "MBA", "MCA"],
//       totalEligible: 70,
//       attended: 52,
//       selectedCount: 8,
//       placedStudents: [
//         { id: 4, name: "Divya", branch: "MBA", package: "5.2 LPA" },
//         { id: 5, name: "Karthik", branch: "CSE", package: "5.2 LPA" },
//       ],
//       branchWisePlaced: {
//         CSE: 5,
//         MBA: 2,
//         MCA: 1,
//       },
//       status: "Completed",
//     },
//   ],
// };

// const SectionTitle = ({ title, subtitle }) => (
//   <div className="mb-4">
//     <h2 className="text-xl font-bold text-gray-800">{title}</h2>
//     {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
//   </div>
// );

// export default function PlacementCompanySections() {
//   const [selectedUpcomingId, setSelectedUpcomingId] = useState(
//     placementData.upcoming[0]?.id || null
//   );
//   const [selectedOngoingId, setSelectedOngoingId] = useState(
//     placementData.ongoing[0]?.id || null
//   );
//   const [selectedCompletedId, setSelectedCompletedId] = useState(
//     placementData.completed[0]?.id || null
//   );

//   const selectedUpcoming = useMemo(
//     () => placementData.upcoming.find((c) => c.id === selectedUpcomingId),
//     [selectedUpcomingId]
//   );

//   const selectedOngoing = useMemo(
//     () => placementData.ongoing.find((c) => c.id === selectedOngoingId),
//     [selectedOngoingId]
//   );

//   const selectedCompleted = useMemo(
//     () => placementData.completed.find((c) => c.id === selectedCompletedId),
//     [selectedCompletedId]
//   );

//   const getBranchWiseEligible = (students) => {
//     return students.reduce((acc, s) => {
//       acc[s.branch] = (acc[s.branch] || 0) + 1;
//       return acc;
//     }, {});
//   };

//   const upcomingBranchWise = selectedUpcoming
//     ? getBranchWiseEligible(selectedUpcoming.eligibleStudents)
//     : {};

//   return (
//     <div className="mt-8 space-y-8">

//            {/* ===================== ONGOING ===================== */}
//            <Card className="p-5">
//         <SectionTitle
//           title="🚀 Ongoing / Current Companies"
//           subtitle="Track current drive progress, attendance, remaining rounds, and shortlisted students."
//         />

//         <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
//           {placementData.ongoing.map((company) => (
//             <button
//               key={company.id}
//               onClick={() => setSelectedOngoingId(company.id)}
//               className={`text-left p-4 rounded-xl border transition ${
//                 selectedOngoingId === company.id
//                   ? "border-green-600 bg-green-50"
//                   : "border-gray-200 bg-gray-50 hover:bg-gray-100"
//               }`}
//             >
//               <h3 className="font-semibold text-lg">{company.name}</h3>
//               <p className="text-sm text-gray-500">{company.role}</p>
//               <p className="text-sm mt-1">🟢 {company.status}</p>
//               <p className="text-sm">👥 Eligible: {company.totalEligible}</p>
//               <p className="text-sm">🙋 Attended: {company.attended}</p>
//             </button>
//           ))}
//         </div>

//         {selectedOngoing && (
//           <div className="border rounded-xl p-4 bg-gray-50">
//             <h3 className="text-lg font-bold mb-4">{selectedOngoing.name} - Live Status</h3>

//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Eligible Students</p>
//                 <p className="text-xl font-bold">{selectedOngoing.totalEligible}</p>
//               </div>
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Attended</p>
//                 <p className="text-xl font-bold">{selectedOngoing.attended}</p>
//               </div>
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Current Round</p>
//                 <p className="text-xl font-bold">{selectedOngoing.currentRound}</p>
//               </div>
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Rounds Remaining</p>
//                 <p className="text-xl font-bold">{selectedOngoing.roundsRemaining}</p>
//               </div>
//             </div>

//             <div className="mb-5">
//               <p className="font-semibold mb-2">Branch-wise Eligible Students</p>
//               <div className="grid md:grid-cols-4 gap-3">
//                 {Object.entries(selectedOngoing.branchWiseEligible).map(([branch, count]) => (
//                   <div key={branch} className="bg-white p-3 rounded-lg border">
//                     <p className="text-sm text-gray-500">{branch}</p>
//                     <p className="text-lg font-bold">{count}</p>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div>
//               <p className="font-semibold mb-2">Shortlisted / Progress Students</p>
//               <div className="overflow-x-auto">
//                 <table className="w-full bg-white rounded-lg overflow-hidden">
//                   <thead className="bg-gray-100">
//                     <tr>
//                       <th className="p-2 text-left">ID</th>
//                       <th className="p-2 text-left">Name</th>
//                       <th className="p-2 text-left">Branch</th>
//                       <th className="p-2 text-left">Status</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {selectedOngoing.shortlistedStudents.map((student) => (
//                       <tr key={student.id} className="border-t">
//                         <td className="p-2">{student.id}</td>
//                         <td className="p-2">{student.name}</td>
//                         <td className="p-2">{student.branch}</td>
//                         <td className="p-2">{student.status}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//         )}
//       </Card>

      
//       {/* ===================== UPCOMING ===================== */}
//       <Card className="p-5">
//         <SectionTitle
//           title="📅 Upcoming Companies"
//           subtitle="Click a company to see allowed branches, eligible count, and eligible students list."
//         />

//         <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
//           {placementData.upcoming.map((company) => (
//             <button
//               key={company.id}
//               onClick={() => setSelectedUpcomingId(company.id)}
//               className={`text-left p-4 rounded-xl border transition ${
//                 selectedUpcomingId === company.id
//                   ? "border-blue-600 bg-blue-50"
//                   : "border-gray-200 bg-gray-50 hover:bg-gray-100"
//               }`}
//             >
//               <h3 className="font-semibold text-lg">{company.name}</h3>
//               <p className="text-sm text-gray-500">{company.role}</p>
//               <p className="text-sm mt-1">📍 {company.type}</p>
//               <p className="text-sm">📅 {company.date}</p>
//               <p className="text-sm">👥 Openings: {company.openings}</p>
//             </button>
//           ))}
//         </div>

//         {selectedUpcoming && (
//           <div className="border rounded-xl p-4 bg-gray-50">
//             <h3 className="text-lg font-bold mb-2">{selectedUpcoming.name} - Details</h3>

//             <div className="grid md:grid-cols-2 gap-4 mb-4">
//               <div>
//                 <p><span className="font-semibold">Role:</span> {selectedUpcoming.role}</p>
//                 <p><span className="font-semibold">Date:</span> {selectedUpcoming.date}</p>
//                 <p><span className="font-semibold">Type:</span> {selectedUpcoming.type}</p>
//                 <p><span className="font-semibold">Openings:</span> {selectedUpcoming.openings}</p>
//               </div>
//               <div>
//                 <p className="font-semibold">Allowed Branches:</p>
//                 <div className="flex flex-wrap gap-2 mt-2">
//                   {selectedUpcoming.branches.map((b) => (
//                     <span key={b} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
//                       {b}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             </div>

//             <div className="mb-4">
//               <p className="font-semibold mb-2">
//                 Total Eligible Students: {selectedUpcoming.eligibleStudents.length}
//               </p>
//               <div className="grid md:grid-cols-3 gap-3">
//                 {Object.entries(upcomingBranchWise).map(([branch, count]) => (
//                   <div key={branch} className="bg-white p-3 rounded-lg border">
//                     <p className="text-sm text-gray-500">{branch}</p>
//                     <p className="text-lg font-bold">{count}</p>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div>
//               <p className="font-semibold mb-2">Eligible Students List</p>
//               <div className="overflow-x-auto">
//                 <table className="w-full bg-white rounded-lg overflow-hidden">
//                   <thead className="bg-gray-100">
//                     <tr>
//                       <th className="p-2 text-left">ID</th>
//                       <th className="p-2 text-left">Name</th>
//                       <th className="p-2 text-left">Branch</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {selectedUpcoming.eligibleStudents.map((student) => (
//                       <tr key={student.id} className="border-t">
//                         <td className="p-2">{student.id}</td>
//                         <td className="p-2">{student.name}</td>
//                         <td className="p-2">{student.branch}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//         )}
//       </Card>

//       {/* ===================== COMPLETED ===================== */}
//       <Card className="p-5">
//         <SectionTitle
//           title="✅ Completed / Past Companies"
//           subtitle="View final results, placed count, branch-wise placed stats, and placed students list."
//         />

//         <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
//           {placementData.completed.map((company) => (
//             <button
//               key={company.id}
//               onClick={() => setSelectedCompletedId(company.id)}
//               className={`text-left p-4 rounded-xl border transition ${
//                 selectedCompletedId === company.id
//                   ? "border-purple-600 bg-purple-50"
//                   : "border-gray-200 bg-gray-50 hover:bg-gray-100"
//               }`}
//             >
//               <h3 className="font-semibold text-lg">{company.name}</h3>
//               <p className="text-sm text-gray-500">{company.role}</p>
//               <p className="text-sm mt-1">📅 Completed: {company.completedDate}</p>
//               <p className="text-sm">🎯 Placed: {company.selectedCount}</p>
//             </button>
//           ))}
//         </div>

//         {selectedCompleted && (
//           <div className="border rounded-xl p-4 bg-gray-50">
//             <h3 className="text-lg font-bold mb-4">{selectedCompleted.name} - Final Report</h3>

//             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Eligible</p>
//                 <p className="text-xl font-bold">{selectedCompleted.totalEligible}</p>
//               </div>
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Attended</p>
//                 <p className="text-xl font-bold">{selectedCompleted.attended}</p>
//               </div>
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Placed</p>
//                 <p className="text-xl font-bold text-green-600">{selectedCompleted.selectedCount}</p>
//               </div>
//               <div className="bg-white p-4 rounded-xl border">
//                 <p className="text-sm text-gray-500">Openings</p>
//                 <p className="text-xl font-bold">{selectedCompleted.openings}</p>
//               </div>
//             </div>

//             <div className="mb-5">
//               <p className="font-semibold mb-2">Branch-wise Placed Count</p>
//               <div className="grid md:grid-cols-4 gap-3">
//                 {Object.entries(selectedCompleted.branchWisePlaced).map(([branch, count]) => (
//                   <div key={branch} className="bg-white p-3 rounded-lg border">
//                     <p className="text-sm text-gray-500">{branch}</p>
//                     <p className="text-lg font-bold">{count}</p>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             <div>
//               <p className="font-semibold mb-2">Placed Students List</p>
//               <div className="overflow-x-auto">
//                 <table className="w-full bg-white rounded-lg overflow-hidden">
//                   <thead className="bg-gray-100">
//                     <tr>
//                       <th className="p-2 text-left">ID</th>
//                       <th className="p-2 text-left">Name</th>
//                       <th className="p-2 text-left">Branch</th>
//                       <th className="p-2 text-left">Package</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {selectedCompleted.placedStudents.map((student) => (
//                       <tr key={student.id} className="border-t">
//                         <td className="p-2">{student.id}</td>
//                         <td className="p-2">{student.name}</td>
//                         <td className="p-2">{student.branch}</td>
//                         <td className="p-2">{student.package}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>
//         )}
//       </Card>
//     </div>
//   );
// }



"use client";

import { useMemo, useState } from "react";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow border border-gray-200 ${className}`}>
    {children}
  </div>
);

// 🔹 Dummy Data
const placementData = {
  upcoming: [
    {
      id: 1,
      name: "Infosys",
      type: "On-Campus",
      role: "System Engineer",
      date: "2026-01-15",
      openings: 25,
      branches: ["CSE", "ECE", "EEE"],
      eligibleStudents: [
        { id: 1, name: "Rahul", branch: "CSE" },
        { id: 2, name: "Kiran", branch: "ECE" },
        { id: 3, name: "Mahesh", branch: "EEE" },
        { id: 4, name: "Sneha", branch: "CSE" },
      ],
    },
    {
      id: 2,
      name: "Wipro",
      type: "Off-Campus",
      role: "Project Engineer",
      date: "2026-01-22",
      openings: 18,
      branches: ["CSE", "MECH", "MBA"],
      eligibleStudents: [
        { id: 5, name: "Arjun", branch: "CSE" },
        { id: 6, name: "Divya", branch: "MBA" },
        { id: 7, name: "Vikas", branch: "MECH" },
      ],
    },
  ],

  ongoing: [
    {
      id: 3,
      name: "TCS",
      type: "On-Campus",
      role: "Ninja / Digital",
      startDate: "2026-01-05",
      openings: 40,
      branches: ["CSE", "ECE", "EEE", "MECH"],
      totalEligible: 120,
      attended: 95,
      currentRound: "Technical Interview",
      roundsRemaining: 1,
      status: "Technical Round Ongoing",
      branchWiseEligible: {
        CSE: 45,
        ECE: 30,
        EEE: 20,
        MECH: 25,
      },
      shortlistedStudents: [
        { id: 1, name: "Rahul", branch: "CSE", status: "Shortlisted" },
        { id: 2, name: "Kiran", branch: "ECE", status: "In Progress" },
        { id: 3, name: "Vamsi", branch: "EEE", status: "Shortlisted" },
      ],
    },
    {
      id: 4,
      name: "Accenture",
      type: "On-Campus",
      role: "Associate Software Engineer",
      startDate: "2026-01-08",
      openings: 30,
      branches: ["CSE", "ECE", "MCA"],
      totalEligible: 85,
      attended: 72,
      currentRound: "HR Round",
      roundsRemaining: 0,
      status: "Final Round Completed, Results Pending",
      branchWiseEligible: {
        CSE: 40,
        ECE: 28,
        MCA: 17,
      },
      shortlistedStudents: [
        { id: 4, name: "Sneha", branch: "CSE", status: "HR Completed" },
        { id: 5, name: "Manoj", branch: "ECE", status: "HR Completed" },
      ],
    },
  ],

  completed: [
    {
      id: 5,
      name: "Capgemini",
      type: "On-Campus",
      role: "Analyst",
      completedDate: "2025-12-20",
      openings: 20,
      branches: ["CSE", "ECE", "EEE"],
      totalEligible: 90,
      attended: 75,
      selectedCount: 12,
      placedStudents: [
        { id: 1, name: "Rahul", branch: "CSE", package: "4.5 LPA" },
        { id: 2, name: "Priya", branch: "ECE", package: "4.5 LPA" },
        { id: 3, name: "Venu", branch: "EEE", package: "4.5 LPA" },
      ],
      branchWisePlaced: {
        CSE: 6,
        ECE: 4,
        EEE: 2,
      },
      status: "Completed",
    },
    {
      id: 6,
      name: "Cognizant",
      type: "Off-Campus",
      role: "Programmer Analyst",
      completedDate: "2025-12-10",
      openings: 15,
      branches: ["CSE", "MBA", "MCA"],
      totalEligible: 70,
      attended: 52,
      selectedCount: 8,
      placedStudents: [
        { id: 4, name: "Divya", branch: "MBA", package: "5.2 LPA" },
        { id: 5, name: "Karthik", branch: "CSE", package: "5.2 LPA" },
      ],
      branchWisePlaced: {
        CSE: 5,
        MBA: 2,
        MCA: 1,
      },
      status: "Completed",
    },
  ],
};

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

export default function PlacementCompanySections() {
  const [selectedUpcomingId, setSelectedUpcomingId] = useState(
    placementData.upcoming[0]?.id || null
  );
  const [selectedOngoingId, setSelectedOngoingId] = useState(
    placementData.ongoing[0]?.id || null
  );
  const [selectedCompletedId, setSelectedCompletedId] = useState(
    placementData.completed[0]?.id || null
  );

  // 🔹 Filters
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [upcomingBranch, setUpcomingBranch] = useState("ALL");

  const [ongoingSearch, setOngoingSearch] = useState("");
  const [ongoingBranch, setOngoingBranch] = useState("ALL");

  const [completedSearch, setCompletedSearch] = useState("");
  const [completedBranch, setCompletedBranch] = useState("ALL");

  const selectedUpcoming = useMemo(
    () => placementData.upcoming.find((c) => c.id === selectedUpcomingId),
    [selectedUpcomingId]
  );

  const selectedOngoing = useMemo(
    () => placementData.ongoing.find((c) => c.id === selectedOngoingId),
    [selectedOngoingId]
  );

  const selectedCompleted = useMemo(
    () => placementData.completed.find((c) => c.id === selectedCompletedId),
    [selectedCompletedId]
  );

  const getBranchWiseEligible = (students) => {
    return students.reduce((acc, s) => {
      acc[s.branch] = (acc[s.branch] || 0) + 1;
      return acc;
    }, {});
  };

  // 🔹 Filtered Upcoming Students
  const filteredUpcomingStudents = useMemo(() => {
    if (!selectedUpcoming) return [];
    return selectedUpcoming.eligibleStudents.filter((student) => {
      const matchName = student.name
        .toLowerCase()
        .includes(upcomingSearch.toLowerCase());
      const matchBranch =
        upcomingBranch === "ALL" || student.branch === upcomingBranch;
      return matchName && matchBranch;
    });
  }, [selectedUpcoming, upcomingSearch, upcomingBranch]);

  // 🔹 Filtered Ongoing Students
  const filteredOngoingStudents = useMemo(() => {
    if (!selectedOngoing) return [];
    return selectedOngoing.shortlistedStudents.filter((student) => {
      const matchName = student.name
        .toLowerCase()
        .includes(ongoingSearch.toLowerCase());
      const matchBranch =
        ongoingBranch === "ALL" || student.branch === ongoingBranch;
      return matchName && matchBranch;
    });
  }, [selectedOngoing, ongoingSearch, ongoingBranch]);

  // 🔹 Filtered Completed Students
  const filteredCompletedStudents = useMemo(() => {
    if (!selectedCompleted) return [];
    return selectedCompleted.placedStudents.filter((student) => {
      const matchName = student.name
        .toLowerCase()
        .includes(completedSearch.toLowerCase());
      const matchBranch =
        completedBranch === "ALL" || student.branch === completedBranch;
      return matchName && matchBranch;
    });
  }, [selectedCompleted, completedSearch, completedBranch]);

  const upcomingBranchWise = selectedUpcoming
    ? getBranchWiseEligible(filteredUpcomingStudents)
    : {};

  return (
    <div className="mt-8 space-y-8">

      {/* ===================== ONGOING ===================== */}
      <Card className="p-5">
        <SectionTitle
          title="🚀 Ongoing / Current Companies"
          subtitle="Track current drive progress, attendance, remaining rounds, and shortlisted students."
        />

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {placementData.ongoing.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                setSelectedOngoingId(company.id);
                setOngoingSearch("");
                setOngoingBranch("ALL");
              }}
              className={`text-left p-4 rounded-xl border transition ${
                selectedOngoingId === company.id
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <h3 className="font-semibold text-lg">{company.name}</h3>
              <p className="text-sm text-gray-500">{company.role}</p>
              <p className="text-sm mt-1">🟢 {company.status}</p>
              <p className="text-sm">👥 Eligible: {company.totalEligible}</p>
              <p className="text-sm">🙋 Attended: {company.attended}</p>
            </button>
          ))}
        </div>

        {selectedOngoing && (
          <div className="border rounded-xl p-4 bg-gray-50">
            <h3 className="text-lg font-bold mb-4">{selectedOngoing.name} - Live Status</h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Eligible Students</p>
                <p className="text-xl font-bold">{selectedOngoing.totalEligible}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Attended</p>
                <p className="text-xl font-bold">{selectedOngoing.attended}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Current Round</p>
                <p className="text-xl font-bold">{selectedOngoing.currentRound}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Rounds Remaining</p>
                <p className="text-xl font-bold">{selectedOngoing.roundsRemaining}</p>
              </div>
            </div>

            <div className="mb-5">
              <p className="font-semibold mb-2">Branch-wise Eligible Students</p>
              <div className="grid md:grid-cols-4 gap-3">
                {Object.entries(selectedOngoing.branchWiseEligible).map(([branch, count]) => (
                  <div key={branch} className="bg-white p-3 rounded-lg border">
                    <p className="text-sm text-gray-500">{branch}</p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                placeholder="Search student by name..."
                value={ongoingSearch}
                onChange={(e) => setOngoingSearch(e.target.value)}
                className="border p-2 rounded-lg bg-white"
              />
              <select
                value={ongoingBranch}
                onChange={(e) => setOngoingBranch(e.target.value)}
                className="border p-2 rounded-lg bg-white"
              >
                <option value="ALL">All Branches</option>
                {selectedOngoing.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="font-semibold mb-2">
                Shortlisted / Progress Students ({filteredOngoingStudents.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Branch</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOngoingStudents.map((student) => (
                      <tr key={student.id} className="border-t">
                        <td className="p-2">{student.id}</td>
                        <td className="p-2">{student.name}</td>
                        <td className="p-2">{student.branch}</td>
                        <td className="p-2">{student.status}</td>
                      </tr>
                    ))}
                    {filteredOngoingStudents.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-gray-500">
                          No students found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ===================== UPCOMING ===================== */}
      <Card className="p-5">
        <SectionTitle
          title="📅 Upcoming Companies"
          subtitle="Click a company to see allowed branches, eligible count, and eligible students list."
        />

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {placementData.upcoming.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                setSelectedUpcomingId(company.id);
                setUpcomingSearch("");
                setUpcomingBranch("ALL");
              }}
              className={`text-left p-4 rounded-xl border transition ${
                selectedUpcomingId === company.id
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <h3 className="font-semibold text-lg">{company.name}</h3>
              <p className="text-sm text-gray-500">{company.role}</p>
              <p className="text-sm mt-1">📍 {company.type}</p>
              <p className="text-sm">📅 {company.date}</p>
              <p className="text-sm">👥 Openings: {company.openings}</p>
            </button>
          ))}
        </div>

        {selectedUpcoming && (
          <div className="border rounded-xl p-4 bg-gray-50">
            <h3 className="text-lg font-bold mb-2">{selectedUpcoming.name} - Details</h3>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <p><span className="font-semibold">Role:</span> {selectedUpcoming.role}</p>
                <p><span className="font-semibold">Date:</span> {selectedUpcoming.date}</p>
                <p><span className="font-semibold">Type:</span> {selectedUpcoming.type}</p>
                <p><span className="font-semibold">Openings:</span> {selectedUpcoming.openings}</p>
              </div>
              <div>
                <p className="font-semibold">Allowed Branches:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUpcoming.branches.map((b) => (
                    <span key={b} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                placeholder="Search student by name..."
                value={upcomingSearch}
                onChange={(e) => setUpcomingSearch(e.target.value)}
                className="border p-2 rounded-lg bg-white"
              />
              <select
                value={upcomingBranch}
                onChange={(e) => setUpcomingBranch(e.target.value)}
                className="border p-2 rounded-lg bg-white"
              >
                <option value="ALL">All Branches</option>
                {selectedUpcoming.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <p className="font-semibold mb-2">
                Total Eligible Students: {filteredUpcomingStudents.length}
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {Object.entries(upcomingBranchWise).map(([branch, count]) => (
                  <div key={branch} className="bg-white p-3 rounded-lg border">
                    <p className="text-sm text-gray-500">{branch}</p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-semibold mb-2">Eligible Students List</p>
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUpcomingStudents.map((student) => (
                      <tr key={student.id} className="border-t">
                        <td className="p-2">{student.id}</td>
                        <td className="p-2">{student.name}</td>
                        <td className="p-2">{student.branch}</td>
                      </tr>
                    ))}
                    {filteredUpcomingStudents.length === 0 && (
                      <tr>
                        <td colSpan="3" className="p-4 text-center text-gray-500">
                          No students found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ===================== COMPLETED ===================== */}
      <Card className="p-5">
        <SectionTitle
          title="✅ Completed / Past Companies"
          subtitle="View final results, placed count, branch-wise placed stats, and placed students list."
        />

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {placementData.completed.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                setSelectedCompletedId(company.id);
                setCompletedSearch("");
                setCompletedBranch("ALL");
              }}
              className={`text-left p-4 rounded-xl border transition ${
                selectedCompletedId === company.id
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <h3 className="font-semibold text-lg">{company.name}</h3>
              <p className="text-sm text-gray-500">{company.role}</p>
              <p className="text-sm mt-1">📅 Completed: {company.completedDate}</p>
              <p className="text-sm">🎯 Placed: {company.selectedCount}</p>
            </button>
          ))}
        </div>

        {selectedCompleted && (
          <div className="border rounded-xl p-4 bg-gray-50">
            <h3 className="text-lg font-bold mb-4">{selectedCompleted.name} - Final Report</h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Eligible</p>
                <p className="text-xl font-bold">{selectedCompleted.totalEligible}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Attended</p>
                <p className="text-xl font-bold">{selectedCompleted.attended}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Placed</p>
                <p className="text-xl font-bold text-green-600">{selectedCompleted.selectedCount}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-sm text-gray-500">Openings</p>
                <p className="text-xl font-bold">{selectedCompleted.openings}</p>
              </div>
            </div>

            <div className="mb-5">
              <p className="font-semibold mb-2">Branch-wise Placed Count</p>
              <div className="grid md:grid-cols-4 gap-3">
                {Object.entries(selectedCompleted.branchWisePlaced).map(([branch, count]) => (
                  <div key={branch} className="bg-white p-3 rounded-lg border">
                    <p className="text-sm text-gray-500">{branch}</p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                placeholder="Search student by name..."
                value={completedSearch}
                onChange={(e) => setCompletedSearch(e.target.value)}
                className="border p-2 rounded-lg bg-white"
              />
              <select
                value={completedBranch}
                onChange={(e) => setCompletedBranch(e.target.value)}
                className="border p-2 rounded-lg bg-white"
              >
                <option value="ALL">All Branches</option>
                {selectedCompleted.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="font-semibold mb-2">
                Placed Students List ({filteredCompletedStudents.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Branch</th>
                      <th className="p-2 text-left">Package</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompletedStudents.map((student) => (
                      <tr key={student.id} className="border-t">
                        <td className="p-2">{student.id}</td>
                        <td className="p-2">{student.name}</td>
                        <td className="p-2">{student.branch}</td>
                        <td className="p-2">{student.package}</td>
                      </tr>
                    ))}
                    {filteredCompletedStudents.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-gray-500">
                          No students found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}