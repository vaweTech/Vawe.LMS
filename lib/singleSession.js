"use client";

import { auth, db } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

const SESSION_FIELD = "activeSessionId";
const SESSION_UPDATED_FIELD = "sessionUpdatedAt";

function getStorageKey(uid) {
  return `single-session:${uid}`;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readLocalSessionId(uid) {
  if (typeof window === "undefined" || !uid) return null;
  return window.localStorage.getItem(getStorageKey(uid));
}

function saveLocalSessionId(uid, sessionId) {
  if (typeof window === "undefined" || !uid || !sessionId) return;
  window.localStorage.setItem(getStorageKey(uid), sessionId);
}

export function clearSingleSession(uid) {
  if (typeof window === "undefined" || !uid) return;
  window.localStorage.removeItem(getStorageKey(uid));
}

export async function registerSingleSession(uid) {
  if (!uid || !db) return null;

  const sessionId = createSessionId();
  const ref = doc(db, "users", uid);

  await setDoc(
    ref,
    {
      [SESSION_FIELD]: sessionId,
      [SESSION_UPDATED_FIELD]: serverTimestamp(),
    },
    { merge: true }
  );

  saveLocalSessionId(uid, sessionId);
  return sessionId;
}

export async function registerSingleSessionWithConfirm(uid, options = {}) {
  if (!uid || !db) return null;

  const {
    confirmMessage = "This account is already logged in on another device.\n\nDo you want to log out other device and continue here?",
    cancelledMessage = "Login cancelled.",
    confirmFn,
  } = options;

  const localSessionId = readLocalSessionId(uid);
  const ref = doc(db, "users", uid);

  const snap = await getDoc(ref);
  const activeSessionId = snap.exists() ? snap.data()?.[SESSION_FIELD] : null;

  // Same device (already current session)
  if (activeSessionId && localSessionId && activeSessionId === localSessionId) {
    return localSessionId;
  }

  // First login on this device, but DB already has an active session -> confirm takeover
  if (activeSessionId && activeSessionId !== localSessionId) {
    const ask =
      typeof confirmFn === "function"
        ? confirmFn
        : (msg) => (typeof window !== "undefined" ? window.confirm(msg) : true);

    const ok = await ask(confirmMessage);
    if (!ok) {
      clearSingleSession(uid);
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
      throw new Error(cancelledMessage);
    }
  }

  // If DB has no session yet, but we already have local one, sync it.
  if (!activeSessionId && localSessionId) {
    await setDoc(
      ref,
      {
        [SESSION_FIELD]: localSessionId,
        [SESSION_UPDATED_FIELD]: serverTimestamp(),
      },
      { merge: true }
    );
    return localSessionId;
  }

  // Otherwise, create/replace the session (this will kick other devices)
  return await registerSingleSession(uid);
}

export function watchSingleSession(user, onSessionExpired) {
  if (!user?.uid || !db) return () => {};

  const uid = user.uid;
  let localSessionId = readLocalSessionId(uid);

  const startWatch = () =>
    onSnapshot(doc(db, "users", uid), async (snap) => {
      const activeSessionId = snap.exists() ? snap.data()?.[SESSION_FIELD] : null;

      if (!activeSessionId || !localSessionId) return;

      if (activeSessionId !== localSessionId) {
        clearSingleSession(uid);
        try {
          await signOut(auth);
        } catch (error) {
          console.error("Failed to sign out after session mismatch:", error);
        }
        if (typeof onSessionExpired === "function") {
          onSessionExpired();
        }
      }
    });

  let unsubscribe = () => {};
  let stopped = false;

  const bootstrap = async () => {
    if (!localSessionId) {
      try {
        localSessionId = await registerSingleSession(uid);
      } catch (error) {
        console.error("Failed to initialize single session:", error);
      }
    } else {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const activeSessionId = snap.exists() ? snap.data()?.[SESSION_FIELD] : null;
        if (!activeSessionId) {
          await setDoc(
            doc(db, "users", uid),
            {
              [SESSION_FIELD]: localSessionId,
              [SESSION_UPDATED_FIELD]: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Failed to sync single session state:", error);
      }
    }

    if (!stopped) {
      unsubscribe = startWatch();
    }
  };

  bootstrap();

  return () => {
    stopped = true;
    unsubscribe();
  };
}
