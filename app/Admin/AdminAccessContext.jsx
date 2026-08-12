"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import {
  computeAdminAccess,
  canonicalAdminRole,
  subdomainFromUserOrDetails,
} from "@/lib/collegeAdminAccess";
import { resolveCollegeSubdomain } from "@/lib/studentRole";

const AdminAccessContext = createContext(null);

const emptyAccess = {
  loading: true,
  user: null,
  role: null,
  moduleLms: true,
  moduleCrt: true,
  platformEmpty: false,
  collegeSubdomain: null,
  tenantSubdomain: resolveCollegeSubdomain(null),
  ...computeAdminAccess(null, true, true),
};

export function AdminAccessProvider({ children }) {
  const [state, setState] = useState(emptyAccess);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setState({
          loading: false,
          user: null,
          role: null,
          moduleLms: true,
          moduleCrt: true,
          platformEmpty: false,
          collegeSubdomain: null,
          tenantSubdomain: resolveCollegeSubdomain(null),
          ...computeAdminAccess(null, true, true),
        });
        return;
      }
      const snap = await getDoc(doc(db, "users", u.uid));
      const d = snap.exists() ? snap.data() : {};
      const detailSnap = await getDoc(doc(db, "users", u.uid, "details", "profile"));
      const det = detailSnap.exists() ? detailSnap.data() || {} : {};
      const role = canonicalAdminRole(d) ?? canonicalAdminRole(det);
      const isCollege = role === "collegeAdmin";
      let moduleLms = isCollege
        ? !!(d.moduleLms ?? d.ModuleLms ?? det.moduleLms ?? det.ModuleLms)
        : true;
      let moduleCrt = isCollege
        ? !!(d.moduleCrt ?? d.ModuleCrt ?? det.moduleCrt ?? det.ModuleCrt)
        : true;
      const platformEmpty = isCollege && !!(d.platformEmpty ?? det.platformEmpty);
      let collegeSubdomain =
        subdomainFromUserOrDetails(d) || subdomainFromUserOrDetails(det);
      // Superadmin source of truth: collegeHosts (by subdomain doc id or collegeAdminUid).
      if (isCollege) {
        try {
          let h = null;
          if (collegeSubdomain) {
            const hostSnap = await getDoc(doc(db, "collegeHosts", collegeSubdomain));
            if (hostSnap.exists()) h = hostSnap.data() || {};
          }
          if (!h) {
            const q = query(
              collection(db, "collegeHosts"),
              where("collegeAdminUid", "==", u.uid),
              limit(3)
            );
            const qs = await getDocs(q);
            if (!qs.empty) {
              const docSnap = qs.docs[0];
              h = docSnap.data() || {};
              collegeSubdomain =
                collegeSubdomain ||
                docSnap.id ||
                subdomainFromUserOrDetails(h) ||
                (h.subdomain ? String(h.subdomain).trim() : null);
            }
          }
          if (h) {
            if (Object.prototype.hasOwnProperty.call(h, "moduleLms")) {
              moduleLms = !!h.moduleLms;
            } else if (Object.prototype.hasOwnProperty.call(h, "emptyLms")) {
              moduleLms = !!h.emptyLms;
            }
            if (Object.prototype.hasOwnProperty.call(h, "moduleCrt")) {
              moduleCrt = !!h.moduleCrt;
            } else if (Object.prototype.hasOwnProperty.call(h, "emptyCrt")) {
              moduleCrt = !!h.emptyCrt;
            }
          }
        } catch (e) {
          console.warn("AdminAccess: could not read collegeHosts for module flags:", e?.message || e);
        }
      }
      setState({
        loading: false,
        user: u,
        role,
        moduleLms,
        moduleCrt,
        platformEmpty,
        collegeSubdomain,
        tenantSubdomain: resolveCollegeSubdomain(collegeSubdomain),
        ...computeAdminAccess(role, moduleLms, moduleCrt),
      });
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
  );
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) {
    throw new Error("useAdminAccess must be used within AdminAccessProvider");
  }
  return ctx;
}
