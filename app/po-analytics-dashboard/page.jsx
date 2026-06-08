"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {  BarChart3,  Building2,  Download,  IndianRupee,  Lightbulb,  Pencil,  Plus,  RefreshCw,  TrendingUp,  Users,  Trash2,  UserX,  X,} from "lucide-react";
import { serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db, firestoreHelpers, isFirebaseConfigured } from "../../lib/firebase";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";  

const FILTER_OPTIONS = {
  academicYears: ["All", "2023-24", "2024-25", "2025-26"],
  placementStatus: ["All", "Placed", "Unplaced"],
  dateRanges: ["Last 30 Days", "Last 90 Days", "Last 6 Months", "Full Year"],
};

function dateRangeStartMs(label) {
  const now = Date.now();
  const day = 86400000;
  switch (label) {
    case "Last 30 Days":
      return now - 30 * day;
    case "Last 90 Days":
      return now - 90 * day;
    case "Last 6 Months":
      return now - 183 * day;
    case "Full Year":
      return now - 365 * day;
    default:
      return 0;
  }
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof v === "string" || typeof v === "number") {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function parsePackageLpa(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/,/g, "");
  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Firestore Timestamp / Date → yyyy-mm-dd for date inputs */
function offerDateFieldToHtmlDate(v) {
  if (v == null) return "";
  const ms = toMillis(v);
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Full offer rows from Firestore (array field or legacy single-company fields).
 * Preserves timestamps on existing entries when re-saving `offers`.
 */
function mergeOffersFromFirestoreData(d) {
  const raw = d?.offers ?? d?.placementOffers ?? d?.offerList ?? d?.offersHistory;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((o) => {
        if (!o || typeof o !== "object") return null;
        const c = String(o.company || o.companyName || o.placementCompany || "").trim();
        if (!c || c === "-" || c.toLowerCase() === "n/a") return null;
        const entry = {
          company: c,
          packageLpa: parsePackageLpa(o.packageLpa ?? o.package ?? o.ctcLpa ?? o.salaryLpa),
        };
        if (o.offerDate != null) entry.offerDate = o.offerDate;
        if (o.placementDate != null) entry.placementDate = o.placementDate;
        return entry;
      })
      .filter(Boolean);
  }
  const companyRaw = String(
    d.placementCompany || d.placedCompany || d.offerCompany || d.company || ""
  ).trim();
  const hasCompany =
    companyRaw.length > 0 &&
    companyRaw !== "-" &&
    companyRaw.toLowerCase() !== "n/a";
  if (hasCompany) {
    const entry = {
      company: companyRaw,
      packageLpa: parsePackageLpa(
        d.packageLpa ?? d.package ?? d.ctcLpa ?? d.salaryLpa ?? d.salary
      ),
    };
    if (d.offerDate != null) entry.offerDate = d.offerDate;
    if (d.placementDate != null) entry.placementDate = d.placementDate;
    return [entry];
  }
  return [];
}

/** Map Firestore CRT student doc → dashboard row (flexible field names). */
function normalizeCrtStudent(id, data) {
  const d = data || {};
  const regNo = String(d.regdNo || d.regNo || d.registrationNumber || "").trim() || "—";
  const name = String(d.name || d.studentName || "—").trim();
  const department = String(d.branch || d.department || "General").trim() || "General";

  const ps = String(d.placementStatus || d.placement || "").toLowerCase();
  const placedExplicit =
    d.placed === true ||
    d.isPlaced === true ||
    ps === "placed" ||
    ps === "yes";
  const companyRaw = String(
    d.placementCompany || d.placedCompany || d.offerCompany || d.company || ""
  ).trim();
  const hasCompany =
    companyRaw.length > 0 &&
    companyRaw !== "-" &&
    companyRaw.toLowerCase() !== "n/a";

  let status = "Unplaced";
  if (placedExplicit || hasCompany) status = "Placed";
  if (ps === "unplaced" || ps === "no" || d.placed === false) status = "Unplaced";

  const offersListRaw = mergeOffersFromFirestoreData(d);
  const offersList = offersListRaw.map(({ company, packageLpa }) => ({
    company,
    packageLpa,
  }));
  const primary = offersList[0];
  const company = primary
    ? primary.company
    : hasCompany
      ? companyRaw
      : "—";
  const packageLpa = primary
    ? primary.packageLpa
    : parsePackageLpa(
        d.packageLpa ?? d.package ?? d.ctcLpa ?? d.salaryLpa ?? d.salary
      );

  const offerTs = toMillis(d.offerDate ?? d.placementDate ?? d.placedAt);
  let offerDate = "—";
  if (offerTs) {
    offerDate = new Date(offerTs).toISOString().slice(0, 10);
  }

  const createdTs =
    toMillis(d.createdAt) ||
    toMillis(d.admissionDate) ||
    toMillis(d.dateOfJoining) ||
    0;

  const academicYear = String(d.academicYear || d.batchYear || "").trim();

  const offerOrActivityTs =
    status === "Placed" ? offerTs || createdTs : createdTs;

  /** Trend chart: prefer explicit counts, else number of offer rows, else 1 if placed. */
  const rawOffers =
    d.offersCount ??
    d.offersMade ??
    d.numberOfOffers ??
    d.totalOffers ??
    d.offersReceived;
  const nOffers = Number(rawOffers);
  let offersContribution = 0;
  if (offersList.length > 0) {
    offersContribution = offersList.length;
  } else if (Number.isFinite(nOffers) && nOffers > 0) {
    offersContribution = Math.round(nOffers);
  } else if (status === "Placed") {
    offersContribution = 1;
  }

  return {
    id,
    regNo,
    name,
    department,
    status,
    company,
    packageLpa,
    offerDate,
    offersList,
    _offerTs: offerTs,
    _createdTs: createdTs,
    _activityTs: offerOrActivityTs,
    _academicYear: academicYear,
    offersContribution,
    _studentDocSource: d._studentDocSource,
  };
}

/**
 * Student UIDs assigned to a CRT program (`crt/{id}/students`) or to a batch
 * (`crt/{id}/batches/{batchId}/students`). Only these appear on this dashboard.
 */
async function fetchAssignedCrtStudentIds() {
  const ids = new Set();
  if (!db) return ids;

  const crtSnap = await firestoreHelpers.getDocs(
    firestoreHelpers.collection(db, "crt")
  );

  await Promise.all(
    crtSnap.docs.map(async (crtDoc) => {
      const programId = crtDoc.id;
      let crtStSnap;
      let batchesSnap;
      try {
        [crtStSnap, batchesSnap] = await Promise.all([
          firestoreHelpers.getDocs(
            firestoreHelpers.collection(db, "crt", programId, "students")
          ),
          firestoreHelpers.getDocs(
            firestoreHelpers.collection(db, "crt", programId, "batches")
          ),
        ]);
      } catch {
        return;
      }

      crtStSnap.docs.forEach((d) => {
        const sid = d.data()?.studentId;
        if (sid) ids.add(sid);
      });

      await Promise.all(
        batchesSnap.docs.map(async (batchDoc) => {
          try {
            const bs = await firestoreHelpers.getDocs(
              firestoreHelpers.collection(
                db,
                "crt",
                programId,
                "batches",
                batchDoc.id,
                "students"
              )
            );
            bs.docs.forEach((d) => {
              const sid = d.data()?.studentId;
              if (sid) ids.add(sid);
            });
          } catch {
            /* ignore per-batch errors */
          }
        })
      );
    })
  );

  return ids;
}

/** Load `students/{uid}` or fallback `users/crtStudent/students/{uid}` for each assigned UID. */
async function fetchCrtStudentProfilesForIds(assignedIds) {
  const merged = new Map();
  if (!db || !assignedIds || assignedIds.size === 0) {
    return merged;
  }

  const idList = Array.from(assignedIds);
  const chunkSize = 20;
  for (let i = 0; i < idList.length; i += chunkSize) {
    const chunk = idList.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (uid) => {
        try {
          const ref = firestoreHelpers.doc(db, "students", uid);
          const snap = await firestoreHelpers.getDoc(ref);
          if (snap.exists()) {
            merged.set(uid, {
              id: snap.id,
              ...snap.data(),
              _studentDocSource: "students",
            });
            return;
          }
          const cRef = firestoreHelpers.doc(
            db,
            "users",
            "crtStudent",
            "students",
            uid
          );
          const cSnap = await firestoreHelpers.getDoc(cRef);
          if (cSnap.exists()) {
            merged.set(uid, {
              id: cSnap.id,
              ...cSnap.data(),
              _studentDocSource: "crtStudentStudents",
            });
          }
        } catch {
          /* ignore missing docs */
        }
      })
    );
  }

  return merged;
}

async function fetchCrtStudentsFromFirestore() {
  const assignedIds = await fetchAssignedCrtStudentIds();
  const merged = await fetchCrtStudentProfilesForIds(assignedIds);
  return Array.from(merged.values()).map((row) =>
    normalizeCrtStudent(row.id, row)
  );
}

/** Writes placement fields to the same collection the profile was loaded from. */
async function updateStudentPlacementFirestore(uid, source, payload) {
  if (!db) throw new Error("Database not available");
  if (source === "crtStudentStudents") {
    await firestoreHelpers.updateDoc(
      firestoreHelpers.doc(db, "users", "crtStudent", "students", uid),
      payload
    );
    return;
  }
  if (source === "students") {
    await firestoreHelpers.updateDoc(
      firestoreHelpers.doc(db, "students", uid),
      payload
    );
    return;
  }
  const refPrimary = firestoreHelpers.doc(db, "students", uid);
  const snapPrimary = await firestoreHelpers.getDoc(refPrimary);
  if (snapPrimary.exists()) {
    await firestoreHelpers.updateDoc(refPrimary, payload);
    return;
  }
  const refCrt = firestoreHelpers.doc(
    db,
    "users",
    "crtStudent",
    "students",
    uid
  );
  const snapCrt = await firestoreHelpers.getDoc(refCrt);
  if (snapCrt.exists()) {
    await firestoreHelpers.updateDoc(refCrt, payload);
    return;
  }
  throw new Error("Student record not found in Firestore");
}

async function resolveStudentDocRef(uid, source) {
  if (!db) throw new Error("Database not available");
  if (source === "crtStudentStudents") {
    return firestoreHelpers.doc(db, "users", "crtStudent", "students", uid);
  }
  if (source === "students") {
    return firestoreHelpers.doc(db, "students", uid);
  }
  const refPrimary = firestoreHelpers.doc(db, "students", uid);
  const snapPrimary = await firestoreHelpers.getDoc(refPrimary);
  if (snapPrimary.exists()) return refPrimary;
  return firestoreHelpers.doc(db, "users", "crtStudent", "students", uid);
}

/** Appends one offer (company + package + timestamp) and syncs `offers` array + counters. */
async function appendOfferToStudent(uid, source, { company, packageLpa }) {
  const ref = await resolveStudentDocRef(uid, source);
  const snap = await firestoreHelpers.getDoc(ref);
  if (!snap.exists()) throw new Error("Student record not found");
  const d = snap.data();
  const list = mergeOffersFromFirestoreData(d).map((o) => ({ ...o }));
  const pkg = parsePackageLpa(packageLpa);
  list.push({
    company: company.trim(),
    packageLpa: pkg,
    /** Firestore forbids `serverTimestamp()` inside array elements; use client Timestamp. */
    offerDate: Timestamp.now(),
  });
  const n = list.length;
  const first = list[0];
  await firestoreHelpers.updateDoc(ref, {
    offers: list,
    offersCount: n,
    totalOffers: n,
    numberOfOffers: n,
    placementCompany: first.company,
    placedCompany: first.company,
    offerCompany: first.company,
    company: first.company,
    packageLpa: first.packageLpa,
    package: first.packageLpa,
    placementStatus: "Placed",
    placed: true,
    offerDate: first.offerDate,
    placementDate: first.offerDate ?? first.placementDate,
  });
}

/** Load full offers from Firestore for the edit modal (includes per-offer dates). */
async function loadOffersForEditForm(uid, source) {
  const ref = await resolveStudentDocRef(uid, source);
  const snap = await firestoreHelpers.getDoc(ref);
  if (!snap.exists()) return [];
  return mergeOffersFromFirestoreData(snap.data()).map((o) => ({
    company: o.company,
    packageLpa: String(
      o.packageLpa !== undefined && o.packageLpa !== null ? o.packageLpa : ""
    ),
    offerDate: offerDateFieldToHtmlDate(o.offerDate ?? o.placementDate),
  }));
}

/**
 * Saves the full `offers` array from the edit form. Empty list → unplaced + cleared fields.
 * No serverTimestamp inside array elements.
 */
async function saveStudentOffersToFirestore(uid, source, formRows) {
  const ref = await resolveStudentDocRef(uid, source);
  const snap = await firestoreHelpers.getDoc(ref);
  if (!snap.exists()) throw new Error("Student record not found");

  const cleaned = formRows
    .map((r) => ({
      company: String(r.company || "").trim(),
      packageLpa: parsePackageLpa(r.packageLpa),
      offerDateStr: String(r.offerDate || "").trim(),
    }))
    .filter((r) => r.company);

  if (cleaned.length === 0) {
    await firestoreHelpers.updateDoc(ref, {
      offers: [],
      offersCount: 0,
      totalOffers: 0,
      numberOfOffers: 0,
      placementCompany: "",
      placedCompany: "",
      offerCompany: "",
      company: "",
      packageLpa: 0,
      package: 0,
      placementStatus: "Unplaced",
      placed: false,
    });
    return;
  }

  for (const r of cleaned) {
    if (!Number.isFinite(r.packageLpa) || r.packageLpa < 0) {
      throw new Error(`Invalid package (LPA) for “${r.company}”`);
    }
  }

  const firestoreList = cleaned.map((r) => {
    let offerTs = Timestamp.now();
    if (r.offerDateStr) {
      const parsed = new Date(`${r.offerDateStr}T12:00:00`);
      if (Number.isFinite(parsed.getTime())) {
        offerTs = Timestamp.fromDate(parsed);
      }
    }
    return {
      company: r.company,
      packageLpa: r.packageLpa,
      offerDate: offerTs,
    };
  });

  const n = firestoreList.length;
  const first = firestoreList[0];
  await firestoreHelpers.updateDoc(ref, {
    offers: firestoreList,
    offersCount: n,
    totalOffers: n,
    numberOfOffers: n,
    placementCompany: first.company,
    placedCompany: first.company,
    offerCompany: first.company,
    company: first.company,
    packageLpa: first.packageLpa,
    package: first.packageLpa,
    placementStatus: "Placed",
    placed: true,
    offerDate: first.offerDate,
    placementDate: first.offerDate,
  });
}

const CARD_COLORS = {
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  green: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  red: "bg-gradient-to-br from-rose-500 to-rose-600",
  violet: "bg-gradient-to-br from-violet-500 to-violet-600",
  amber: "bg-gradient-to-br from-amber-500 to-orange-500",
  cyan: "bg-gradient-to-br from-cyan-500 to-sky-500",
  indigo: "bg-gradient-to-br from-indigo-500 to-indigo-600",
  teal: "bg-gradient-to-br from-teal-500 to-teal-600",
};

const Card = ({ children, className = "", id }) => (
  <div
    id={id}
    className={`rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-300 ${className}`}
  >
    {children}
  </div>
);

const KpiCard = ({ label, value, icon: Icon, accent }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
          {value}
        </p>
      </div>
      <div className={`rounded-2xl p-3 shadow-sm ${accent}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </Card>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
      {label}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const TableSection = ({ title, headers, rows, renderRow, id: sectionId }) => (
  <Card id={sectionId} className="overflow-x-auto scroll-mt-24">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <table className="w-full text-left mt-4 min-w-[880px]">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/80">
          {headers.map((h) => (
            <th key={h} className="p-3 text-sm font-semibold text-slate-700">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  </Card>
);

export default function CRTPOAnalyticsDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [markingPlacedId, setMarkingPlacedId] = useState(null);
  const [offerModalStudent, setOfferModalStudent] = useState(null);
  const [offerForm, setOfferForm] = useState({
    company: "",
    packageLpa: "",
  });
  const [offerSaving, setOfferSaving] = useState(false);
  const [editPlacementStudent, setEditPlacementStudent] = useState(null);
  const [editOffersList, setEditOffersList] = useState([]);
  const [editOffersLoading, setEditOffersLoading] = useState(false);
  const [placementEditSaving, setPlacementEditSaving] = useState(false);

  const [filters, setFilters] = useState({
    academicYear: "All",
    department: "All",
    placementStatus: "All",
    dateRange: "Last 6 Months",
  });

  const departmentOptions = useMemo(() => {
    const set = new Set();
    allStudents.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allStudents]);

  const loadStudents = useCallback(async () => {
    if (!db || !isFirebaseConfigured) {
      setAllStudents([]);
      setFetchError(null);
      return;
    }
    setDataLoading(true);
    setFetchError(null);
    try {
      const rows = await fetchCrtStudentsFromFirestore();
      setAllStudents(rows);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setFetchError(e?.message || "Failed to load CRT students");
      setAllStudents([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setLoading(false);
        return;
      }

      if (!db) {
        setLoading(false);
        return;
      }

      const snap = await firestoreHelpers.getDoc(
        firestoreHelpers.doc(db, "users", u.uid)
      );

      const role = snap.exists() ? snap.data().role : null;
      setHasAccess(
        ["admin", "superadmin", "crtPoUser", "po", "crtPO"].includes(role)
      );
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const markStudentPlaced = useCallback(
    async (s) => {
      if (!s?.id || !db) return;
      const confirmed = window.confirm(
        `Mark ${s.name} as placed? They will appear in the Placed Students list.`
      );
      if (!confirmed) return;
      setMarkingPlacedId(s.id);
      try {
        await updateStudentPlacementFirestore(s.id, s._studentDocSource, {
          placementStatus: "Placed",
          placed: true,
          placementDate: serverTimestamp(),
          offerDate: serverTimestamp(),
        });
        await loadStudents();
        requestAnimationFrame(() => {
          document
            .getElementById("placed-students-section")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } catch (e) {
        console.error(e);
        alert(e?.message || "Failed to mark as placed");
      } finally {
        setMarkingPlacedId(null);
      }
    },
    [loadStudents]
  );

  const submitAdditionalOffer = useCallback(async () => {
    const s = offerModalStudent;
    if (!s?.id || !db) return;
    const company = offerForm.company.trim();
    if (!company) {
      alert("Enter company name.");
      return;
    }
    const pkg = parsePackageLpa(offerForm.packageLpa);
    if (!Number.isFinite(pkg) || pkg <= 0) {
      alert("Enter a valid package (LPA), e.g. 6.5");
      return;
    }
    setOfferSaving(true);
    try {
      await appendOfferToStudent(s.id, s._studentDocSource, {
        company,
        packageLpa: pkg,
      });
      setOfferModalStudent(null);
      setOfferForm({ company: "", packageLpa: "" });
      await loadStudents();
      requestAnimationFrame(() => {
        document
          .getElementById("placed-students-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to save offer");
    } finally {
      setOfferSaving(false);
    }
  }, [offerModalStudent, offerForm, loadStudents]);

  const submitEditOffers = useCallback(async () => {
    const s = editPlacementStudent;
    if (!s?.id || !db) return;

    const rowsWithCompany = editOffersList.filter((r) =>
      String(r.company || "").trim()
    );
    const stray = editOffersList.some(
      (r) =>
        !String(r.company || "").trim() &&
        (String(r.packageLpa || "").trim() || String(r.offerDate || "").trim())
    );
    if (stray) {
      alert("Fill company name or clear package/date on empty rows.");
      return;
    }

    for (const r of rowsWithCompany) {
      const pkg = parsePackageLpa(r.packageLpa);
      if (!Number.isFinite(pkg) || pkg < 0) {
        alert(
          `Enter a valid package (LPA) for “${String(r.company).trim()}”.`
        );
        return;
      }
    }

    if (rowsWithCompany.length === 0) {
      const ok = window.confirm(
        "Remove all offers? The student will be marked as unplaced."
      );
      if (!ok) return;
    }

    setPlacementEditSaving(true);
    try {
      await saveStudentOffersToFirestore(
        s.id,
        s._studentDocSource,
        editOffersList
      );
      setEditPlacementStudent(null);
      setEditOffersList([]);
      await loadStudents();
      requestAnimationFrame(() => {
        document
          .getElementById("placed-students-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to save offers");
    } finally {
      setPlacementEditSaving(false);
    }
  }, [editPlacementStudent, editOffersList, loadStudents]);

  useEffect(() => {
    if (!user || !hasAccess || !db || !isFirebaseConfigured) return;
    loadStudents();
  }, [user, hasAccess, loadStudents]);

  const setFilter = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const cohortStudents = useMemo(() => {
    let list = allStudents;
    if (filters.department !== "All") {
      list = list.filter((s) => s.department === filters.department);
    }
    if (filters.academicYear !== "All") {
      list = list.filter((s) => {
        if (!s._academicYear) return true;
        return s._academicYear === filters.academicYear;
      });
    }
    const start = dateRangeStartMs(filters.dateRange);
    if (start > 0) {
      list = list.filter((s) => {
        const t = s._activityTs || 0;
        if (!t) return true;
        return t >= start;
      });
    }
    return list;
  }, [
    allStudents,
    filters.department,
    filters.academicYear,
    filters.dateRange,
  ]);

  const filteredStudents = useMemo(() => {
    if (filters.placementStatus === "All") return cohortStudents;  
  }, [cohortStudents, filters.placementStatus]);

  const placedStudents = useMemo(
    () => filteredStudents.filter((s) => s.status === "Placed"),
    [filteredStudents]
  );

  const unplacedStudents = useMemo(
    () => filteredStudents.filter((s) => s.status === "Unplaced"),
    [filteredStudents]
  );

  const companyRecruitment = useMemo(() => {
    const byCompany = new Map();
    cohortStudents
      .filter((s) => s.status === "Placed")
      .forEach((s) => {
        const rows =
          s.offersList && s.offersList.length > 0
            ? s.offersList
            : s.company && s.company !== "—"
              ? [{ company: s.company, packageLpa: s.packageLpa }]
              : [];
        const seenForStudent = new Set();
        rows.forEach((o) => {
          const c = o.company;
          if (!c || c === "—") return;
          if (!byCompany.has(c)) {
            byCompany.set(c, { packages: [], recruited: 0, offers: 0 });
          }
          const entry = byCompany.get(c);
          entry.offers += 1;
          if (o.packageLpa > 0) entry.packages.push(o.packageLpa);
          if (!seenForStudent.has(c)) {
            seenForStudent.add(c);
            entry.recruited += 1;
          }
        });
      });
    return Array.from(byCompany.entries())
      .map(([company, v]) => ({
        company,
        recruited: v.recruited,
        offers: v.offers,
        avgPackageLpa:
          v.packages.length > 0
            ? (
                v.packages.reduce((a, b) => a + b, 0) / v.packages.length
              ).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.offers - a.offers);
  }, [cohortStudents]);

  /**
   * Last 6 months: bars = placed student count/month; line = sum of offers (offersCount… on doc, else 1/student).
   * Month bucket from offer date, or first recorded date if missing.
   */
  const monthlyTrend = useMemo(() => {
    const months = 6;
    const now = new Date();
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        month: d.toLocaleString("en", { month: "short" }),
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        placed: 0,
        offers: 0,
      });
    }
    cohortStudents.forEach((s) => {
      if (s.status !== "Placed") return;
      const t = s._offerTs || s._createdTs;
      if (!t) return;
      const od = new Date(t);
      const b = buckets.find(
        (x) =>
          x.year === od.getFullYear() && x.monthIndex === od.getMonth()
      );
      if (!b) return;
      b.placed += 1;
      b.offers += s.offersContribution ?? 1;
    });
    return buckets.map(({ month, placed, offers }) => ({
      month,
      placed,
      offers,
    }));
  }, [cohortStudents]);

  const stats = useMemo(() => {
    const totalStudents = filteredStudents.length;
    const totalPlaced = placedStudents.length;

    const placementRate = totalStudents
      ? Math.round((totalPlaced / totalStudents) * 100)
      : 0;

    const withPkg = placedStudents.filter((s) => s.packageLpa > 0);
    const highestPackage = withPkg.length
      ? Math.max(...withPkg.map((s) => s.packageLpa))
      : 0;

    const averagePackage = withPkg.length
      ? (
          withPkg.reduce((sum, s) => sum + s.packageLpa, 0) / withPkg.length
        ).toFixed(1)
      : "0.0";

    return { placementRate, highestPackage, averagePackage };
  }, [filteredStudents, placedStudents]);

  const totalOffersTracked = useMemo(
    () => companyRecruitment.reduce((sum, c) => sum + c.offers, 0),
    [companyRecruitment]
  );

  const kpis = [
    {
      label: "Total Students",
      value: filteredStudents.length,
      icon: Users,
      accent: CARD_COLORS.blue,
    },
    {
      label: "Placed",
      value: placedStudents.length,
      icon: TrendingUp,
      accent: CARD_COLORS.green,
    },
    {
      label: "Unplaced",
      value: unplacedStudents.length,
      icon: UserX,
      accent: CARD_COLORS.red,
    },
    {
      label: "Placement Rate",
      value: `${stats.placementRate}%`,
      icon: BarChart3,
      accent: CARD_COLORS.violet,
    },
    {
      label: "Highest Package",
      value: `${stats.highestPackage.toFixed(1)} LPA`,
      icon: IndianRupee,
      accent: CARD_COLORS.amber,
    },
    {
      label: "Average Package",
      value: `${stats.averagePackage} LPA`,
      icon: IndianRupee,
      accent: CARD_COLORS.cyan,
    },
    {
      label: "Total Recruiters",
      value: companyRecruitment.length,
      icon: Building2,
      accent: CARD_COLORS.indigo,
    },
    {
      label: "Placements (cohort)",
      value: totalOffersTracked,
      icon: TrendingUp,
      accent: CARD_COLORS.teal,
    },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStudents();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    const csv = [
      "RegNo,Name,Department,Status,Company,PackageLPA,OfferDate",
      ...filteredStudents.map(
        ({ regNo, name, department, status, company, packageLpa, offerDate }) =>
          `"${regNo}","${String(name).replace(/"/g, '""')}","${department}","${status}","${company}",${packageLpa},"${offerDate}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "crt-po-analytics.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-xl border-2 border-[#00448a] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 font-medium">
            Loading CRT PO analytics...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md w-full text-center p-10 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Access Denied
          </h1>
          <p className="text-slate-600 mb-8">PO or Admin access required.</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-2xl hover:bg-[#003a76] transition-colors font-medium"
          >
            Go to Home
          </button>
        </Card>
      </div>
    );
  }

  if (!isFirebaseConfigured || !db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md w-full text-center p-10 shadow-xl">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-[#00448a] text-white rounded-2xl hover:bg-[#003a76] transition-colors font-medium"
          >
            Go to Home
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  CRT PO Analytics Dashboard
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1">
                  Placement performance and hiring insights for CRT PO module.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Last updated: {lastUpdated.toLocaleString()}
                  {dataLoading ? " · Loading…" : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing || dataLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshing || dataLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00448a] hover:bg-[#003a76] text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {fetchError && (
              <p className="text-sm text-red-600 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                {fetchError}
              </p>
            )}
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SelectField
                label="Academic Year"
                value={filters.academicYear}
                onChange={(e) => setFilter("academicYear", e.target.value)}
                options={FILTER_OPTIONS.academicYears}
              />

              <SelectField
                label="Department"
                value={filters.department}
                onChange={(e) => setFilter("department", e.target.value)}
                options={departmentOptions}
              />

              <SelectField
                label="Placement Status"
                value={filters.placementStatus}
                onChange={(e) => setFilter("placementStatus", e.target.value)}
                options={FILTER_OPTIONS.placementStatus}
              />

              <SelectField
                label="Date Range"
                value={filters.dateRange}
                onChange={(e) => setFilter("dateRange", e.target.value)}
                options={FILTER_OPTIONS.dateRanges}
              />
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 xl:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Main Analytics Section */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">
        Placement Trend Overview
      </h2>
      <p className="text-sm text-slate-500 mt-1">
                Last 6 months: Placed Students (bars) vs Offers Made (line). Month is based on
                offer date when set. Offers sum{" "}
                <code className="text-[11px] bg-slate-100 px-1 rounded">
                  offersCount
                </code>{" "}
                / similar fields on each student; defaults to 1 offer per placed student.
      </p>
    </div>
  </div>

  <div className="mt-6 h-[340px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
                data={monthlyTrend}
        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#cbd5e1" }}
          tickLine={false}
        />
        <YAxis
                  allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#cbd5e1" }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        />
                <Legend
                  wrapperStyle={{ fontSize: "13px" }}
                  verticalAlign="bottom"
                />
        <Bar
          dataKey="placed"
          name="Placed Students"
          fill="#00448a"
          radius={[8, 8, 0, 0]}
          barSize={34}
        />
        <Line
          type="monotone"
          dataKey="offers"
          name="Offers Made"
          stroke="#06b6d4"
          strokeWidth={3}
                  dot={{ r: 4, fill: "#06b6d4" }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
</Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              Placement Summary
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Overall current cycle performance
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700">
                    Placement Ratio
                  </span>
                  <span className="text-slate-500">{stats.placementRate}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${stats.placementRate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                  <p className="text-xs font-medium text-emerald-700">Placed</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">
                    {placedStudents.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-center">
                  <p className="text-xs font-medium text-rose-700">
                    Unplaced
                  </p>
                  <p className="mt-2 text-2xl font-bold text-rose-600">
                    {unplacedStudents.length}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Best Package
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.highestPackage.toFixed(1)} LPA
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Average Package
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.averagePackage} LPA
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Company Recruitment */}
        <div className="mt-6">
          <TableSection
            title="Company-wise Recruitment"
            headers={["Company", "Students Recruited", "Offers Made", "Avg Package"]}
            rows={companyRecruitment}
            renderRow={(c) => (
              <tr
                key={c.company}
                className="border-b border-slate-100 hover:bg-slate-50/60"
              >
                <td className="p-3 text-sm text-slate-900 font-medium">
                  {c.company}
                </td>
                <td className="p-3 text-sm text-slate-600">{c.recruited}</td>
                <td className="p-3 text-sm text-slate-600">{c.offers}</td>
                <td className="p-3 text-sm text-slate-600">
                  {c.avgPackageLpa} LPA
                </td>
              </tr>
            )}
          />
        </div>

        {/* Student Tables */}
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TableSection
            id="placed-students-section"
            title="Placed Students"
            headers={[
              "Reg No",
              "Name",
              "Dept",
              "Company (primary)",
              "Package",
              "Offers",
              "Action",
            ]}
            rows={placedStudents}
            renderRow={(s) => (
              <tr
                key={s.id || s.regNo}
                className="border-b border-slate-100 hover:bg-slate-50/60"
              >
                <td className="p-3 text-sm text-slate-600">{s.regNo}</td>
                <td className="p-3 text-sm text-slate-900 font-medium">
                  {s.name}
                </td>
                <td className="p-3 text-sm text-slate-600">{s.department}</td>
                <td className="p-3 text-sm text-slate-600">{s.company}</td>
                <td className="p-3 text-sm text-slate-600">
                  {s.packageLpa > 0 ? `${s.packageLpa} LPA` : "—"}
                </td>
                <td className="p-3 text-sm text-slate-600 tabular-nums">
                  {s.offersList?.length ?? 0}
                </td>
                <td className="p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={
                        offerSaving || placementEditSaving || editOffersLoading
                      }
                      onClick={async () => {
                        setEditPlacementStudent(s);
                        setEditOffersLoading(true);
                        try {
                          const rows = await loadOffersForEditForm(
                            s.id,
                            s._studentDocSource
                          );
                          setEditOffersList(
                            rows.length > 0
                              ? rows
                              : [
                                  {
                                    company: "",
                                    packageLpa: "",
                                    offerDate: "",
                                  },
                                ]
                          );
                        } catch (e) {
                          console.error(e);
                          alert(e?.message || "Failed to load offers");
                          setEditPlacementStudent(null);
                        } finally {
                          setEditOffersLoading(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={offerSaving || placementEditSaving}
                      onClick={() => {
                        setOfferModalStudent(s);
                        setOfferForm({ company: "", packageLpa: "" });
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#00448a] bg-[#00448a]/5 px-3 py-1.5 text-xs font-semibold text-[#00448a] hover:bg-[#00448a]/10 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Add offer
                    </button>
                  </div>
                </td>
              </tr>
            )}
          />

          <TableSection
            title="Unplaced Students"
            headers={["Reg No", "Name", "Dept", "Status", "Action"]}
            rows={unplacedStudents}
            renderRow={(s) => (
              <tr
                key={s.id || s.regNo}
                className="border-b border-slate-100 hover:bg-slate-50/60"
              >
                <td className="p-3 text-sm text-slate-600">{s.regNo}</td>
                <td className="p-3 text-sm text-slate-900 font-medium">
                  {s.name}
                </td>
                <td className="p-3 text-sm text-slate-600">{s.department}</td>
                <td className="p-3 text-sm">
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-rose-700 text-xs font-medium">
                    Unplaced
                  </span>
                </td>
                <td className="p-3 text-sm">
                  <button
                    type="button"
                    disabled={markingPlacedId === s.id}
                    onClick={() => markStudentPlaced(s)}
                    className="rounded-xl border border-[#00448a] bg-[#00448a]/5 px-3 py-1.5 text-xs font-semibold text-[#00448a] hover:bg-[#00448a]/10 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {markingPlacedId === s.id ? "Saving…" : "Mark as placed"}
                  </button>
                </td>
              </tr>
            )}
          />
        </div>

        {/* Insights Panel */}
        <Card className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Insights & Recommendations Panel
          </h2>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              {
                title: "Positive Signals",
                box: "border-emerald-200 bg-emerald-50",
                titleColor: "text-emerald-800",
                textColor: "text-emerald-700",
                items: [
                  "Placement conversion is improving steadily this cycle.",
                  "Recruiter participation remains healthy and consistent.",
                  "Average package trend indicates stronger hiring outcomes.",
                ],
              },
              {
                title: "Action Recommendations",
                box: "border-amber-200 bg-amber-50",
                titleColor: "text-amber-800",
                textColor: "text-amber-700",
                items: [
                  "Run targeted mock drives for remaining unplaced students.",
                  "Conduct focused aptitude and interview refresh sessions.",
                  "Prioritize follow-up with top recruiters generating multiple offers.",
                ],
              },
            ].map((section) => (
              <div
                key={section.title}
                className={`rounded-2xl border p-4 ${section.box}`}
              >
                <p className={`text-sm font-semibold ${section.titleColor}`}>
                  {section.title}
                </p>
                <ul className={`mt-2 space-y-1 text-sm ${section.textColor}`}>
                  {section.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {offerModalStudent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-offer-title"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => {
                  setOfferModalStudent(null);
                  setOfferForm({ company: "", packageLpa: "" });
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <h3
                id="add-offer-title"
                className="text-lg font-semibold text-slate-900 pr-8"
              >
                Add another offer
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {offerModalStudent.name} · {offerModalStudent.regNo}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Primary company/package stay unchanged; this appends to the
                student&apos;s{" "}
                <code className="text-[11px] bg-slate-100 px-1 rounded">
                  offers
                </code>{" "}
                list in Firestore.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={offerForm.company}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, company: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    placeholder="e.g. Accenture"
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Package (LPA)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={offerForm.packageLpa}
                    onChange={(e) =>
                      setOfferForm((f) => ({ ...f, packageLpa: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                    placeholder="e.g. 8.5"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOfferModalStudent(null);
                    setOfferForm({ company: "", packageLpa: "" });
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={offerSaving || placementEditSaving}
                  onClick={submitAdditionalOffer}
                  className="rounded-2xl bg-[#00448a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#00356d] disabled:opacity-50"
                >
                  {offerSaving ? "Saving…" : "Save offer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {editPlacementStudent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-placement-title"
          >
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-xl">
              <div className="shrink-0 border-b border-slate-100 p-6 pb-4">
                <button
                  type="button"
                  className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => {
                    setEditPlacementStudent(null);
                    setEditOffersList([]);
                  }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <h3
                  id="edit-placement-title"
                  className="text-lg font-semibold text-slate-900 pr-8"
                >
                  Edit all offers
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editPlacementStudent.name} · {editPlacementStudent.regNo}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Edit or remove rows. The first row is the primary company shown
                  in the table. Saving updates the full{" "}
                  <code className="text-[11px] bg-slate-100 px-1 rounded">
                    offers
                  </code>{" "}
                  array in Firestore.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                {editOffersLoading ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    Loading offers…
                  </p>
                ) : (
                  <div className="space-y-3">
                    {editOffersList.map((row, index) => (
                      <div
                        key={`offer-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-semibold text-slate-600">
                            Offer #{index + 1}
                            {index === 0 ? (
                              <span className="ml-2 font-normal text-slate-400">
                                (primary)
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            disabled={placementEditSaving}
                            onClick={() =>
                              setEditOffersList((prev) =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Company
                            </label>
                            <input
                              type="text"
                              value={row.company}
                              onChange={(e) =>
                                setEditOffersList((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, company: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                              placeholder="Company name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Package (LPA)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.packageLpa}
                              onChange={(e) =>
                                setEditOffersList((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, packageLpa: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Offer date
                            </label>
                            <input
                              type="date"
                              value={row.offerDate}
                              onChange={(e) =>
                                setEditOffersList((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, offerDate: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00448a]/30 focus:border-[#00448a]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={placementEditSaving}
                      onClick={() =>
                        setEditOffersList((prev) => [
                          ...prev,
                          { company: "", packageLpa: "", offerDate: "" },
                        ])
                      }
                      className="w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      + Add offer row
                    </button>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex gap-3 justify-end border-t border-slate-100 p-6 pt-4">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setEditPlacementStudent(null);
                    setEditOffersList([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    placementEditSaving ||
                    offerSaving ||
                    editOffersLoading
                  }
                  onClick={submitEditOffers}
                  className="rounded-2xl bg-[#00448a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#00356d] disabled:opacity-50"
                >
                  {placementEditSaving ? "Saving…" : "Save all offers"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}