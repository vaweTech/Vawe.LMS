// app/api/create-student/route.js
import {
  adminDb,
  shouldUseFirestoreSdkDirect,
  addDocumentViaRest,
  addSubcollectionDocumentViaRest,
} from "@/lib/firebaseAdmin";
import admin from 'firebase-admin';
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  getScopedCrtStudentRole,
  getScopedInternshipRole,
  getScopedSkillwinsRole,
  getScopedStudentRole,
  isCrtStudentRole,
  isSkillwinsStudentRole,
  isScopedInternshipRole,
  isScopedStudentRole,
  isLegacyInternshipRole,
  isLegacyStudentRole,
  resolveCollegeSubdomain,
  getStudentLimitRoles,
  resolveStudentTypeFlags,
} from "@/lib/studentRole";
import { validateDateOfBirth, validateDateOfJoining } from "@/lib/formDateValidation";

let cachedServiceAccount = null;

function loadServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  let serviceAccountJson = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      serviceAccountJson = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        'base64'
      ).toString('utf8');
    } catch (error) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', error?.message || error);
    }
  }

  if (!serviceAccountJson && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }

  if (!serviceAccountJson) {
    try {
      const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
      serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
    } catch (error) {
      throw new Error('Service account credentials are required for REST fallback. Provide FIREBASE_SERVICE_ACCOUNT_BASE64 or serviceAccountKey.json.');
    }
  }

  cachedServiceAccount = JSON.parse(serviceAccountJson);
  if (
    cachedServiceAccount.private_key &&
    cachedServiceAccount.private_key.includes('\\n')
  ) {
    cachedServiceAccount.private_key = cachedServiceAccount.private_key.replace(/\\n/g, '\n');
  }
  return cachedServiceAccount;
}

function encodeBase64Url(value) {
  const jsonString = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(jsonString)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+/g, '');
}

async function getGoogleAccessToken(scopes = ['https://www.googleapis.com/auth/datastore']) {
  const serviceAccount = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    scope: scopeString
  };

  const unsigned = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign
    .sign(serviceAccount.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+/g, '');
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(errText || 'Failed to fetch Google OAuth token');
  }

  const { access_token } = await tokenRes.json();
  if (!access_token) {
    throw new Error('OAuth token response missing access_token');
  }

  return { accessToken: access_token, serviceAccount };
}

function isOpenSslOrNetworkFirestoreError(error) {
  const writeErrorMsg = String(error?.message || "");
  const isWriteDecoderError =
    writeErrorMsg.includes("DECODER routines") ||
    writeErrorMsg.includes("1E08010C") ||
    error?.code === "ERR_OSSL_UNSUPPORTED";
  const isTransientNetwork =
    error?.code === "ECONNRESET" ||
    writeErrorMsg.includes("socket hang up") ||
    writeErrorMsg.includes("ETIMEDOUT");
  return isWriteDecoderError || isTransientNetwork;
}

function buildCrtAdmissionData(body, name, email, createdByUid) {
  return {
    regNo: body.regdNo,
    studentName: name,
    fatherName: body.fatherName || "",
    gender: body.gender || "",
    dateOfBirth: body.dob || "",
    aadharNo: body.aadharNo || "",
    email,
    phone1: body.phone1 || "",
    phone2: body.phone2 || "",
    qualification: body.qualification || "",
    collegeUniversity: body.college || "",
    degree: body.degree || "",
    branch: body.branch || "",
    yearOfPassing: body.yearOfPassing || "",
    workExperienceYears: body.workExperienceYears || body.workExperience || "",
    company: body.company || body.workCompany || "",
    skillSet: body.skillSet || "",
    courseProjectTitle: body.courseTitle || "",
    dateOfJoining: body.dateOfJoining || "",
    timings: body.timings || "",
    totalFee: body.totalFee ?? "",
    paidFee: body.PayedFee ?? body.paidFee ?? "",
    remarks: body.remarks || "",
    createdBy: createdByUid,
  };
}

// Input validation schema
const createStudentSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  classId: z.string().min(1, 'Class ID is required'),
  regdNo: z.string().min(1, 'Registration number is required'),
  fatherName: z.string().optional(),
  address: z.string().optional(),
  phones: z.string().optional(),
  education: z.string().optional(),
  fees: z.number().optional(),
  courseTitle: z.string().optional()
}).passthrough();

// Minimal server-side normalization to E.164 (defaults to IN for 10-digit numbers)
function normalizeToE164(phoneRaw) {
  if (!phoneRaw) return undefined;
  const raw = String(phoneRaw).trim();
  if (/^\+\d{7,15}$/.test(raw)) return raw;
  let digits = raw.replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `+91${digits}`; // assume IN default
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function normalizeEmail(rawEmail) {
  const email = (rawEmail || "").trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  // Apply Gmail normalization rules
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plusIndex = local.indexOf("+");
    const withoutPlus = plusIndex === -1 ? local : local.slice(0, plusIndex);
    const withoutDots = withoutPlus.replace(/\./g, "");
    return `${withoutDots}@gmail.com`;
  }
  return `${local}@${domain}`;
}

// Use fixed default password as requested
const DEFAULT_STUDENT_PASSWORD = 'Vawe@2026';

function deriveStudentRole(body, reqUser) {
  const incomingRole = String(body.role || "").trim();
  const targetSubdomain = resolveCollegeSubdomain(
    body.collegeSubdomain || reqUser?.collegeSubdomain
  );

  if (body.isCrt) {
    const scopedRole = getScopedCrtStudentRole(null);
    if (!incomingRole || isCrtStudentRole(incomingRole)) return scopedRole;
    return incomingRole;
  }

  if (body.isSkillwins || body.isSkillWins) {
    if (isSkillwinsStudentRole(incomingRole)) return incomingRole;
    return getScopedSkillwinsRole(targetSubdomain);
  }

  if (incomingRole) {
    if (isSkillwinsStudentRole(incomingRole)) {
      return getScopedSkillwinsRole(targetSubdomain);
    }
    if (isScopedInternshipRole(incomingRole) || isLegacyInternshipRole(incomingRole)) {
      return getScopedInternshipRole(targetSubdomain);
    }
    if (isScopedStudentRole(incomingRole) || isLegacyStudentRole(incomingRole)) {
      return getScopedStudentRole(targetSubdomain);
    }
    return incomingRole;
  }

  return body.isInternship
    ? getScopedInternshipRole(targetSubdomain)
    : getScopedStudentRole(targetSubdomain);
}

async function countCollegeStudentsByRoles(_subdomain, roles) {
  const counts = await Promise.all(
    roles.map((role) =>
      adminDb
        .collection("students")
        .where("role", "==", role)
        .count()
        .get()
        .then((snap) => snap.data().count || 0)
    )
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

function parseLimitNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

async function getCollegeStudentLimits(_subdomain) {
  return { studentLimit: null, crtStudentLimit: null };
}

async function createStudentHandler(req) {
  const body = req.validatedBody;
  const { email, name, classId, regdNo } = body;

  if (body.dob) {
    const dobCheck = validateDateOfBirth(body.dob);
    if (!dobCheck.valid) {
      return new Response(JSON.stringify({ error: dobCheck.message }), { status: 400 });
    }
  }

  if (body.dateOfJoining) {
    const joiningCheck = validateDateOfJoining(body.dateOfJoining);
    if (!joiningCheck.valid) {
      return new Response(JSON.stringify({ error: joiningCheck.message }), { status: 400 });
    }
  }

  // Use fixed default password for new student accounts
  const defaultPassword = DEFAULT_STUDENT_PASSWORD;

  try {
    const targetSubdomain = resolveCollegeSubdomain(
      body?.collegeSubdomain || req?.user?.collegeSubdomain
    );
    const derivedRole = deriveStudentRole(body, req.user);

    if (isScopedStudentRole(derivedRole) || isCrtStudentRole(derivedRole)) {
      const { studentLimit, crtStudentLimit } = await getCollegeStudentLimits(targetSubdomain);
      if (isScopedStudentRole(derivedRole) && studentLimit !== null) {
        const limitRoles = getStudentLimitRoles(targetSubdomain);
        const existingStudentsCount = await countCollegeStudentsByRoles(
          targetSubdomain,
          limitRoles
        );
        if (existingStudentsCount >= studentLimit) {
          return new Response(
            JSON.stringify({
              error: `Student creation limit reached for this college (${studentLimit}).`,
            }),
            { status: 400 }
          );
        }
      }
      if (isCrtStudentRole(derivedRole) && crtStudentLimit !== null) {
        const existingCrtStudentsSnap = await adminDb
          .collection("students")
          .where("role", "==", derivedRole)
          .count()
          .get();
        const existingCrtStudentsCount = existingCrtStudentsSnap.data().count || 0;
        if (existingCrtStudentsCount >= crtStudentLimit) {
          return new Response(
            JSON.stringify({
              error: `CRT student creation limit reached for this college (${crtStudentLimit}).`,
            }),
            { status: 400 }
          );
        }
      }
    }

    let userRecord;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    async function restCreateAuthUser(emailToCreate, passwordToCreate) {
      if (!apiKey) {
        throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY for Auth REST fallback');
      }
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCreate, password: passwordToCreate, returnSecureToken: false })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || 'Auth REST signUp failed';
        throw new Error(msg);
      }
      return { uid: data.localId, email: emailToCreate };
    }
    
    // Check if user already exists in Firebase Auth
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log("User already exists in Firebase Auth:", userRecord.uid);
    } catch (authError) {
      // Handle DECODER errors for Firebase Admin Auth
      const errorMsg = String(authError?.message || '');
      const isDecoderError = errorMsg.includes('DECODER routines') || 
                            errorMsg.includes('1E08010C') ||
                            authError.code === 'ERR_OSSL_UNSUPPORTED';
      
      if (isDecoderError) {
        console.error('❌ OpenSSL DECODER error in Firebase Admin Auth:', errorMsg);
        // Try REST fallback to create Auth user
        try {
          userRecord = await restCreateAuthUser(email, defaultPassword);
          console.log('✅ Auth user created via REST fallback:', userRecord.uid);
        } catch (restErr) {
          console.warn('⚠️ Auth REST fallback failed:', restErr?.message || restErr);
          console.warn('⚠️ Proceeding without creating Auth user. Student will be created in Firestore only.');
          userRecord = null;
        }
      } else if (authError.code === 'auth/user-not-found') {
        // User doesn't exist, create new one
        try {
          // Prefer normalized phone over raw
          const phoneNormalized = normalizeToE164(body.phone || body.phone1);
          const createPayload = {
            email,
            password: defaultPassword,
            displayName: name,
          };
          if (phoneNormalized) {
            createPayload.phoneNumber = phoneNormalized;
          }
          userRecord = await admin.auth().createUser(createPayload);
          console.log("Created new Firebase Auth user:", userRecord.uid);
        } catch (createError) {
          // Handle DECODER error during user creation
          const createErrorMsg = String(createError?.message || '');
          const isCreateDecoderError = createErrorMsg.includes('DECODER routines') || 
                                      createErrorMsg.includes('1E08010C') ||
                                      createError.code === 'ERR_OSSL_UNSUPPORTED';
          
          if (isCreateDecoderError) {
            console.error('❌ OpenSSL DECODER error creating Firebase Auth user:', createErrorMsg);
            // Try REST fallback to create Auth user
            try {
              userRecord = await restCreateAuthUser(email, defaultPassword);
              console.log('✅ Auth user created via REST fallback:', userRecord.uid);
            } catch (restErr) {
              console.warn('⚠️ Auth REST fallback failed:', restErr?.message || restErr);
              console.warn('⚠️ Proceeding without creating Auth user. Student will be created in Firestore only.');
              userRecord = null;
            }
          } else {
            throw createError;
          }
        }
      } else {
        throw authError;
      }
    }

    // Backfill phone on existing auth user if missing and provided
    if (userRecord) {
      const phoneNormalized = normalizeToE164(body.phone || body.phone1);
      if (phoneNormalized && !userRecord.phoneNumber) {
        try {
          await admin.auth().updateUser(userRecord.uid, { phoneNumber: phoneNormalized });
          userRecord = await admin.auth().getUser(userRecord.uid);
        } catch (e) {
          // Handle DECODER errors during update
          const updateErrorMsg = String(e?.message || '');
          const isUpdateDecoderError = updateErrorMsg.includes('DECODER routines') || 
                                      updateErrorMsg.includes('1E08010C') ||
                                      e.code === 'ERR_OSSL_UNSUPPORTED';
          
          if (isUpdateDecoderError) {
            console.warn('⚠️ Skipping phone number update due to OpenSSL error:', updateErrorMsg);
          } else {
            console.warn('Unable to set phoneNumber on user:', e?.message || e);
          }
        }
      }
    }

    // Generate a temporary UID if Auth user creation was skipped due to DECODER error
    const studentUid = userRecord ? userRecord.uid : `temp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Check if student already exists in Firestore (normalized email)
    // Wrap in try-catch to handle any Firestore errors
    let existingStudent = null;
    let existingRegdNo = null;
    try {
      const studentsRef = adminDb.collection("students");
      const emailNormalized = normalizeEmail(email);
      
      existingStudent = await studentsRef
        .where("emailNormalized", "==", emailNormalized)
        .get();
      
      if (!existingStudent.empty) {
        return new Response(
          JSON.stringify({ error: "Student with this email already exists in the system" }),
          { status: 400 }
        );
      }

      // Check if registration number already exists
      existingRegdNo = await studentsRef
        .where("regdNo", "==", regdNo)
        .get();
      
      if (!existingRegdNo.empty) {
        return new Response(
          JSON.stringify({ error: "Registration number already exists in the system" }),
          { status: 400 }
        );
      }
    } catch (firestoreQueryError) {
      // Handle DECODER errors in Firestore queries
      const queryErrorMsg = String(firestoreQueryError?.message || '');
      const isQueryDecoderError = queryErrorMsg.includes('DECODER routines') || 
                                  queryErrorMsg.includes('1E08010C') ||
                                  firestoreQueryError.code === 'ERR_OSSL_UNSUPPORTED';
      const isTransientNetwork =
        firestoreQueryError.code === 'ECONNRESET' ||
        queryErrorMsg.includes('socket hang up') ||
        queryErrorMsg.includes('ETIMEDOUT');
      
      if (isQueryDecoderError || isTransientNetwork || process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Firestore query failed (continuing):', {
          code: firestoreQueryError.code,
          decoder: isQueryDecoderError,
          transient: isTransientNetwork,
          message: queryErrorMsg,
        });
        // Continue anyway - we'll try to create the student
        // Worst case: duplicate will be caught by Firestore unique constraints
      } else {
        throw firestoreQueryError;
      }
    }

    // Save student — local: HTTPS REST (no SDK SSL); production: Firestore SDK + SSL.
    let studentCreated = false;
    let useRestApi = false;
    let studentDocId = null;

    const phoneNormalized = normalizeToE164(body.phone || body.phone1);
    const typeFlags = resolveStudentTypeFlags(body, derivedRole);
    const { isCrt, isSkillwins, isInternship } = typeFlags;

    const studentDataBase = {
      ...body,
      email,
      emailNormalized: normalizeEmail(email),
      name,
      classId,
      uid: studentUid,
      role: derivedRole,
      isCrt,
      isSkillwins,
      isInternship,
      portal: typeFlags.portal || body.portal || null,
      collegeSubdomain: targetSubdomain || "",
      password: DEFAULT_STUDENT_PASSWORD,
      phone1: body.phone1 || "",
      phone: phoneNormalized || body.phone || body.phone1 || "",
      coursesTitle: body.courseTitle ? [body.courseTitle] : [],
      reminderCount: 0,
      createdBy: req.user.uid,
      authUserCreated: !!userRecord,
    };

    const crtAdmissionData = isCrt
      ? buildCrtAdmissionData(body, name, email, req.user.uid)
      : null;

    async function persistStudentViaRest() {
      const docId = await addDocumentViaRest("students", {
        ...studentDataBase,
        createdAt: new Date(),
      });
      if (!docId) {
        throw new Error("Firestore REST create returned no document ID");
      }
      if (crtAdmissionData) {
        await addSubcollectionDocumentViaRest(
          "students/crtstudent",
          "admission",
          { ...crtAdmissionData, createdAt: new Date() },
          { documentId: docId }
        );
      }
      return docId;
    }

    async function persistStudentViaSdk() {
      const docRef = await adminDb.collection("students").add({
        ...studentDataBase,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const docId = docRef.id;
      if (crtAdmissionData) {
        await adminDb
          .collection("students")
          .doc("crtstudent")
          .collection("admission")
          .doc(docId)
          .set({
            ...crtAdmissionData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }
      return docId;
    }

    try {
      if (shouldUseFirestoreSdkDirect()) {
        studentDocId = await persistStudentViaSdk();
      } else {
        studentDocId = await persistStudentViaRest();
        useRestApi = true;
      }
      studentCreated = true;
      console.log(
        `Student created (${useRestApi ? "REST" : "SDK"}) UID: ${studentUid}, docId: ${studentDocId}`
      );
    } catch (firestoreWriteError) {
      const writeErrorMsg = String(firestoreWriteError?.message || "");

      if (shouldUseFirestoreSdkDirect() && isOpenSslOrNetworkFirestoreError(firestoreWriteError)) {
        console.warn("Firestore SDK failed on server; trying REST fallback...", writeErrorMsg);
        try {
          studentDocId = await persistStudentViaRest();
          useRestApi = true;
          studentCreated = true;
        } catch (restApiError) {
          return new Response(
            JSON.stringify({
              error:
                "Failed to create student. Firestore SDK and REST fallback both failed. Check Firebase service account on the server.",
              details: restApiError.message,
              studentUid,
              authUserCreated: !!userRecord,
              debug:
                process.env.NODE_ENV !== "production"
                  ? { firestoreError: writeErrorMsg, restApiError: restApiError.message }
                  : undefined,
            }),
            { status: 500 }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            error: writeErrorMsg || "Failed to create student in Firestore",
            studentUid,
            authUserCreated: !!userRecord,
            hint: shouldUseFirestoreSdkDirect()
              ? undefined
              : "Local dev uses Firestore REST. Ensure serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT is set.",
          }),
          { status: 500 }
        );
      }
    }

    if (!studentCreated) {
      return new Response(JSON.stringify({ error: "Failed to create student" }), { status: 500 });
    }

    // Log the default password for admin reference (consider sending via email instead)
    console.log(`Student created with default password: ${DEFAULT_STUDENT_PASSWORD}${useRestApi ? ' (via REST API fallback)' : ''}`);

    let responseMessage = userRecord 
      ? "Student created successfully. Default password is Vawe@2026"
      : "Student created successfully (Firebase Auth user creation skipped due to OpenSSL compatibility issue). Default password is Vawe@2026. Note: Student may need to register manually.";
    
    if (useRestApi) {
      responseMessage += " (Created via REST API fallback due to OpenSSL compatibility issue)";
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        uid: studentUid,
        message: responseMessage,
        defaultPassword: DEFAULT_STUDENT_PASSWORD,
        authUserCreated: !!userRecord,
        useRestApi: useRestApi,
        warning: userRecord ? (useRestApi ? "Student created via REST API fallback due to OpenSSL error." : undefined) : "Firebase Auth user was not created due to OpenSSL error. Student record exists in Firestore but may need manual Auth user creation later."
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating student:", error);
    console.error("Error stack:", error.stack);
    
    // Provide user-friendly error message for DECODER errors
    const errorMsg = String(error?.message || '');
    const isDecoderError = errorMsg.includes('DECODER routines') || 
                          errorMsg.includes('1E08010C') ||
                          error.code === 'ERR_OSSL_UNSUPPORTED';
    
    let userMessage = error.message;
    let statusCode = 500;
    
    if (isDecoderError) {
      userMessage = "Failed to create student due to OpenSSL compatibility issue. Please try again or check the student list - the record may have been partially created.";
      // If we got here, it means we didn't successfully create the student
      // But we still want to provide helpful information
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
        errorCode: error.code,
        isDecoderError: isDecoderError
      }),
      { status: statusCode }
    );
  }
}

// Apply security middleware: Admin auth (allows both admin and superadmin) + Rate limiting + Input validation
// ✅ PERMISSIONS: Both 'admin' and 'superadmin' roles can create student admissions
// Note: withAdminAuth middleware allows both 'admin' and 'superadmin' roles (see lib/apiAuth.js line 225)
export async function POST(request) {
  return await withAdminAuth(request, (req1) =>
    withRateLimit(30, 15 * 60 * 1000)(req1, (req2) =>
      validateInput(createStudentSchema)(req2, createStudentHandler)
    )
  );
}
