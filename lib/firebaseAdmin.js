// // lib/firebaseAdmin.js

// // CRITICAL FIX for SSL/DECODER error on Windows and Vercel
// // Must be set BEFORE importing firebase-admin
// // Always prefer REST API to avoid gRPC SSL issues
// if (typeof process !== 'undefined') {
//   process.env.FIRESTORE_PREFER_REST = 'true';
//   process.env.GOOGLE_CLOUD_FIRESTORE_PREFER_REST = 'true';
  
//   // Additional settings for Windows
//   if (process.platform === 'win32') {
//     process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA';
//     process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For development only
//     process.env.GRPC_ENABLE_FORK_SUPPORT = '0';
//     process.env.GRPC_POLL_STRATEGY = 'poll';
//   }
// } 

// import admin from 'firebase-admin';
// import { readFileSync } from 'fs';
// import { join } from 'path';

// let db = null;

// // Check if Firebase Admin is already initialized
// if (!admin.apps.length) {
//   // Try multiple methods to initialize Firebase Admin
//   let initialized = false;
  
//   // Method 1: Use base64-encoded service account JSON (most reliable for Vercel)
//   if (!initialized && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
//     try {
//       console.log('🔐 Initializing Firebase Admin with base64-encoded service account');
      
//       // Clean and prepare the base64 string
//       let base64String = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim();
      
//       // Remove quotes if the entire string is wrapped in quotes (common Vercel issue)
//       if ((base64String.startsWith('"') && base64String.endsWith('"')) ||
//           (base64String.startsWith("'") && base64String.endsWith("'"))) {
//         base64String = base64String.slice(1, -1).trim();
//       }
      
//       // Remove common prefixes if present (e.g., data:application/json;base64,)
//       if (base64String.includes(',')) {
//         base64String = base64String.split(',').pop().trim();
//       }
      
//       // Remove any whitespace/newlines from the base64 string itself
//       base64String = base64String.replace(/\s/g, '');
      
//       // Validate base64 string is not empty
//       if (!base64String || base64String.length === 0) {
//         throw new Error('Base64 string is empty after cleaning');
//       }
      
//       // Decode base64 to JSON string
//       let serviceAccountJson;
//       try {
//         serviceAccountJson = Buffer.from(base64String, 'base64').toString('utf-8');
//       } catch (decodeError) {
//         throw new Error(`Failed to decode base64 string: ${decodeError.message}`);
//       }
      
//       // Remove BOM (Byte Order Mark) if present - can cause JSON parsing errors
//       if (serviceAccountJson.length > 0 && serviceAccountJson.charCodeAt(0) === 0xFEFF) {
//         serviceAccountJson = serviceAccountJson.slice(1);
//       }
      
//       // Remove any leading/trailing whitespace and invisible characters
//       let cleanedJson = serviceAccountJson.trim();
      
//       // Remove any leading/trailing invisible unicode characters
//       cleanedJson = cleanedJson.replace(/^[\u200B-\u200D\uFEFF]+|[\u200B-\u200D\uFEFF]+$/g, '');
      
//       // Validate JSON starts with { or [ before parsing
//       if (cleanedJson.length === 0) {
//         throw new Error('Decoded JSON string is empty');
//       }
      
//       const firstChar = cleanedJson.charAt(0);
//       if (firstChar !== '{' && firstChar !== '[') {
//         // Try to find where the actual JSON starts
//         const jsonStart = cleanedJson.indexOf('{');
//         const jsonStartArray = cleanedJson.indexOf('[');
//         const actualStart = jsonStart !== -1 ? (jsonStartArray !== -1 ? Math.min(jsonStart, jsonStartArray) : jsonStart) : jsonStartArray;
        
//         if (actualStart !== -1) {
//           cleanedJson = cleanedJson.substring(actualStart);
//           console.warn(`⚠️  Removed ${actualStart} invalid characters from start of decoded JSON`);
//         } else {
//           // Show diagnostic info in dev mode only
//           const preview = cleanedJson.substring(0, 100).replace(/[^\x20-\x7E]/g, '?');
//           throw new Error(`Invalid JSON format: Expected object or array, got "${firstChar}" (charCode: ${firstChar.charCodeAt(0)}). First 100 chars: ${preview}`);
//         }
//       }
      
//       // Parse JSON
//       let serviceAccount;
//       try {
//         serviceAccount = JSON.parse(cleanedJson);
//       } catch (parseError) {
//         // Provide more helpful error message
//         const position = parseError.message.match(/position (\d+)/);
//         if (position) {
//           const pos = parseInt(position[1]);
//           const context = cleanedJson.substring(Math.max(0, pos - 20), Math.min(cleanedJson.length, pos + 20));
//           throw new Error(`JSON parse error at position ${pos}: ${parseError.message}. Context: "...${context}..."`);
//         }
//         throw parseError;
//       }
      
//       // CRITICAL: Ensure private key has proper newlines
//       // The private_key might have escaped newlines (\n) as literal string "\n"
//       if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
//         // Replace literal \n with actual newline characters
//         serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
//       }
      
//       admin.initializeApp({
//         credential: admin.credential.cert(serviceAccount),
//         databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
//       });
//       console.log('✅ Firebase Admin initialized successfully with base64 method');
//       initialized = true;
//     } catch (error) {
//       console.error('❌ Base64 method failed:', error.message);
//       // Only log full error in development to avoid exposing sensitive data
//       if (process.env.NODE_ENV !== 'production') {
//         console.error('Full error:', error);
//       }
//     }
//   }
  
//   // Method 2: Use individual environment variables
//   if (!initialized && process.env.FIREBASE_PRIVATE_KEY && 
//       process.env.FIREBASE_CLIENT_EMAIL && 
//       process.env.FIREBASE_PROJECT_ID) {
//     try {
//       console.log('🔐 Initializing Firebase Admin with environment variables');
      
//       // Handle private key - it might have escaped newlines or be a JSON string
//       let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
//       // If the key is wrapped in quotes (from JSON), remove them
//       if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
//         privateKey = privateKey.slice(1, -1);
//       }
      
//       // Replace escaped newlines with actual newlines
//       privateKey = privateKey.replace(/\\n/g, '\n');
      
//       admin.initializeApp({
//         credential: admin.credential.cert({
//           projectId: process.env.FIREBASE_PROJECT_ID,
//           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//           privateKey: privateKey,
//         }),
//         databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
//       });
//       console.log('✅ Firebase Admin initialized successfully with env vars');
//       initialized = true;
//     } catch (error) {
//       console.error('❌ Environment variables method failed:', error.message);
//     }
//   }
  
//   // Method 3: Use service account key file (local development only)
//   if (!initialized && process.env.NODE_ENV !== 'production') {
//     try {
//       console.log('🔐 Initializing Firebase Admin with service account key');
      
//       // Use fs.readFileSync instead of require to avoid webpack bundling issues
//       const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
//       const serviceAccountJson = readFileSync(serviceAccountPath, 'utf-8');
//       const serviceAccount = JSON.parse(serviceAccountJson);
      
//       // Add SSL settings for development on Windows
//       if (process.platform === 'win32') {
//         console.log('🪟 Detected Windows - applying SSL and REST API fix');
//       }
      
//       admin.initializeApp({
//         credential: admin.credential.cert(serviceAccount),
//         databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`
//       });
//       console.log('✅ Firebase Admin initialized successfully with service account file');
//       initialized = true;
//     } catch (error) {
//       // File not found is expected in production - just log a warning
//       if (error.code === 'ENOENT' || error.message.includes('not found') || error.message.includes('ENOENT')) {
//         console.warn('⚠️  serviceAccountKey.json not found - using environment variables instead');
//       } else {
//         console.error('❌ Failed to initialize Firebase Admin with file:', error.message);
//         // Don't throw - let it fall through to the final check
//       }
//     }
//   }
  
//   if (!initialized) {
//     throw new Error('Firebase Admin could not be initialized with any method. Check your environment variables.');
//   }
  
//   // Initialize Firestore with REST API settings IMMEDIATELY after admin init
//   db = admin.firestore();
  
//   // Apply REST API settings to avoid gRPC SSL/decoder issues
//   const firestoreSettings = {
//     ignoreUndefinedProperties: true,
//     preferRest: true, // Always use REST API to avoid SSL/decoder errors
//   };
  
//   // Disable SSL for local development only
//   if (process.env.NODE_ENV !== 'production') {
//     firestoreSettings.ssl = false;
//     console.log('🔧 Firestore configured with REST API (SSL disabled for dev)');
//   } else {
//     firestoreSettings.ssl = true;
//     console.log('🔧 Firestore configured with REST API for production');
//   }
  
//   db.settings(firestoreSettings);
//   console.log('✅ Firestore initialized successfully');
// } else {
//   // Already initialized
//   db = admin.firestore();
// }

// export const adminDb = db;
// export default admin;


// lib/firebaseAdmin.js

// --- CRITICAL FIRESTORE REST API FIXES (works on Vercel + Windows) ---
if (typeof process !== "undefined") {
  process.env.FIRESTORE_PREFER_REST = "true";
  process.env.GOOGLE_CLOUD_FIRESTORE_PREFER_REST = "true";

  if (process.platform === "win32") {
    process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // dev only
    process.env.GRPC_ENABLE_FORK_SUPPORT = "0";
    process.env.GRPC_POLL_STRATEGY = "poll";
  }
}

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";

let db = null;
/** Stored for REST API fallback when SDK connection fails (e.g. socket hang up). */
let _serviceAccount = null;

/**
 * Load service account from env / file and cache it in _serviceAccount.
 * This is used both for Admin init and REST fallbacks, even if Admin
 * was already initialized earlier in this process.
 */
function loadServiceAccount() {
  if (_serviceAccount) return _serviceAccount;

  let serviceAccount = null;

  // Method 1 — RAW JSON from FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      console.log("🔐 Using FIREBASE_SERVICE_ACCOUNT (raw JSON)");
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
      console.error("❌ Invalid FIREBASE_SERVICE_ACCOUNT:", err.message);
    }
  }

  // Method 2 — Base64 (fallback only)
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      console.log("🔐 Using FIREBASE_SERVICE_ACCOUNT_BASE64");

      const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim(),
        "base64"
      ).toString("utf8");

      serviceAccount = JSON.parse(decoded);
    } catch (err) {
      console.error("❌ Invalid FIREBASE_SERVICE_ACCOUNT_BASE64:", err.message);
    }
  }

  // Method 3 — Local JSON file (dev only)
  if (!serviceAccount && process.env.NODE_ENV !== "production") {
    try {
      console.log("🔐 Using local serviceAccountKey.json");

      const filePath = join(process.cwd(), "serviceAccountKey.json");
      serviceAccount = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      console.warn("⚠️ No serviceAccountKey.json found (dev)");
    }
  }

  if (!serviceAccount) {
    throw new Error(
      "❌ Firebase Admin init failed: Provide FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_BASE64."
    );
  }

  // Fix private key newline issue
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  _serviceAccount = serviceAccount;
  return _serviceAccount;
}

/** Client app project from Next env — must match service account or ID token verification fails */
function assertAdminMatchesPublicProject(serviceAccount) {
  const publicId = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      ""
  ).trim();
  if (!publicId) return;
  const adminId = serviceAccount?.project_id && String(serviceAccount.project_id).trim();
  if (!adminId || adminId === publicId) return;
  const msg =
    `Firebase Admin project_id "${adminId}" does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID "${publicId}". ` +
    `Use a service account JSON from the same Firebase project as your web app (see .env.local), then restart the server.`;
  console.error(`❌ ${msg}`);
  throw new Error(msg);
}

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  assertAdminMatchesPublicProject(serviceAccount);

  // Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });

  console.log("✅ Firebase Admin Initialized");

  // Firestore (REST Mode)
  db = admin.firestore();

  db.settings({
    ignoreUndefinedProperties: true,
    preferRest: true,
    ssl: process.env.NODE_ENV === "production",
  });

  console.log("🔧 Firestore running in REST mode");
} else {
  // Admin was already initialized earlier in this process (possibly by older code).
  // We still need _serviceAccount populated so REST helpers can obtain a token.
  try {
    loadServiceAccount();
  } catch (e) {
    console.warn(
      "⚠️ Firebase Admin already initialized but service account could not be loaded for REST fallback:",
      e.message
    );
  }
  db = admin.firestore();
}

/**
 * Get OAuth2 access token for Firestore REST API (fallback when SDK has socket/connection issues).
 * @returns {Promise<string|null>} Access token or null if no service account.
 */
export async function getFirestoreRestAccessToken() {
  if (!_serviceAccount) return null;
  const { JWT } = await import("google-auth-library");
  const client = new JWT({
    email: _serviceAccount.client_email,
    key: _serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const creds = await client.authorize();
  return creds?.access_token || null;
}

/**
 * Return project ID for Firestore REST URLs (from same credential as Admin).
 */
export function getFirestoreProjectId() {
  return _serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null;
}

/**
 * Convert plain object to Firestore REST API "fields" format.
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null) fields[k] = { nullValue: "NULL_VALUE" };
    else if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "number") fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (v instanceof Date) fields[k] = { timestampValue: v.toISOString() };
    else if (typeof v === "object" && v !== null && "_seconds" in v) fields[k] = { timestampValue: new Date(v._seconds * 1000).toISOString() };
    else if (typeof v === "object" && v !== null) fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
  }
  return fields;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Transient network / TLS / undici failures worth retrying */
function isRetryableRestNetworkError(e) {
  const msg = `${e?.message || ""} ${e?.cause?.message || ""} ${e?.cause?.code || ""}`;
  return /socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|fetch failed|network|ENOTFOUND|UND_ERR|aborted/i.test(
    msg
  );
}

/**
 * Write a document to Firestore using REST API (one-off fetch, avoids SDK connection issues).
 * Retries on transient socket/network errors (common on Windows / unstable links).
 * @param {string} collection - e.g. "users"
 * @param {string} docId - document ID
 * @param {Record<string, unknown>} data - plain object (strings, numbers, Date; skip serverTimestamp(), use new Date() instead)
 * @param {{ maxAttempts?: number }} [options]
 */
export async function writeDocumentViaRest(collection, docId, data, options = {}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const backoffMs = [400, 1000, 2200, 4500, 8000];
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await writeDocumentViaRestOnce(collection, docId, data);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableRestNetworkError(e)) {
        await sleep(backoffMs[attempt - 1] ?? 8000);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function normalizeRestPayloadDates(data) {
  const clean = { ...data };
  if (clean.createdAt instanceof Date) {
    // already a Date
  } else if (clean.createdAt && typeof clean.createdAt === "object" && "_seconds" in clean.createdAt) {
    clean.createdAt = new Date(clean.createdAt._seconds * 1000);
  } else if (clean.createdAt === undefined) {
    clean.createdAt = new Date();
  }
  return clean;
}

async function writeDocumentViaRestOnce(collection, docId, data) {
  const documentPath = `${collection}/${docId}`;
  return writeDocumentPathViaRestOnce(documentPath, data);
}

/**
 * PATCH a Firestore document by full path under databases/(default)/documents/, e.g. "users/UID/details/profile".
 * Retries on transient socket/network errors.
 */
export async function writeDocumentPathViaRest(documentPath, data, options = {}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const backoffMs = [400, 1000, 2200, 4500, 8000];
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await writeDocumentPathViaRestOnce(documentPath, data);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableRestNetworkError(e)) {
        await sleep(backoffMs[attempt - 1] ?? 8000);
        continue;
      }
      throw e;
    }
  } 
  throw lastErr;
}

async function writeDocumentPathViaRestOnce(documentPath, data) {
  const projectId = getFirestoreProjectId();
  const token = await getFirestoreRestAccessToken();
  if (!projectId || !token) throw new Error("Firestore REST: missing project or token");

  const clean = normalizeRestPayloadDates(data);
  const fields = toFirestoreFields(clean);
  const query = Object.keys(fields).map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}?${query}`;

  const ac = typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(90000)
    : undefined;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
    ...(ac ? { signal: ac } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST PATCH failed: ${res.status} ${text}`);
  }
}

/**
 * Delete a document in Firestore using REST API.
 * Best-effort: treats 404 as success.
 */
export async function deleteDocumentViaRest(collection, docId) {
  const projectId = getFirestoreProjectId();
  const token = await getFirestoreRestAccessToken();
  if (!projectId || !token) throw new Error("Firestore REST: missing project or token");

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Firestore REST DELETE failed: ${res.status} ${text}`);
  }
}

export const adminDb = db;
export default admin;
