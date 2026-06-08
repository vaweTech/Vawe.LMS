"use client";

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase config (from .env.local)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const hasValidConfig =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "undefined" &&
  firebaseConfig.projectId;

const FIREBASE_NOT_CONFIGURED_MSG =
  "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables to .env.local (see .env.example), then restart the dev server.";

let app;
let auth;
let db;
let storage;

if (hasValidConfig) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (typeof window !== "undefined") {
    isSupported().then((yes) => {
      if (yes) getAnalytics(app);
    });
  }
} else {
  app = null;
  auth = null;
  db = null;
  storage = null;
}

// 🔑 Exports (auth/db/storage are null when Firebase is not configured)
export { auth, db, storage };

export const isFirebaseConfigured = !!auth;

export const firebaseAuth = {
  login: (email, password) => {
    if (!auth) return Promise.reject(new Error(FIREBASE_NOT_CONFIGURED_MSG));
    return signInWithEmailAndPassword(auth, email, password);
  },
  register: (email, password) => {
    if (!auth) return Promise.reject(new Error(FIREBASE_NOT_CONFIGURED_MSG));
    return createUserWithEmailAndPassword(auth, email, password);
  },
  logout: () => {
    if (!auth) return Promise.resolve();
    return signOut(auth);
  },
  onAuthStateChanged: (authInstance, callback) => {
    if (!authInstance || !auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(authInstance, callback);
  },
};

export const firestoreHelpers = {
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
};

export default app;
