import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const APP_CONTROL_COLLECTION = "appConfig";
export const APP_CONTROL_DOC_ID = "runtime";

export async function fetchAppControlClient() {
  const ref = doc(db, APP_CONTROL_COLLECTION, APP_CONTROL_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { disabled: false, updatedAt: null, updatedBy: null };
  }
  const data = snap.data() || {};
  return {
    disabled: Boolean(data.disabled),
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null,
  };
}

export async function setAppDisabledClient(disabled, updatedBy = "") {
  const ref = doc(db, APP_CONTROL_COLLECTION, APP_CONTROL_DOC_ID);
  const payload = {
    disabled: Boolean(disabled),
    updatedAt: new Date().toISOString(),
    updatedBy: String(updatedBy || "").trim() || null,
  };
  await setDoc(ref, payload, { merge: true });
  return payload;
}
