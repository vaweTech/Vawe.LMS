// app/api/create-student/route.js
import { adminDb } from "@/lib/firebaseAdmin";
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
  normalizeStudentTypeFlags,
} from "@/lib/studentRole";

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

    // Save student in Firestore - persist all provided form fields
    // Wrap in try-catch to handle any Firestore write errors
    let studentCreated = false;
    let useRestApi = false;
    
    try {
      const phoneNormalized = normalizeToE164(body.phone || body.phone1);
      const typeFlags = normalizeStudentTypeFlags(derivedRole);
      const { isCrt, isSkillwins, isInternship } = typeFlags;

      const studentData = {
        ...body, // regdNo, fatherName, address, phones, education, fees, etc.
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
        collegeSubdomain: null,
        // Store default password for admin visibility in Student Info (note: security trade-off as requested)
        password: DEFAULT_STUDENT_PASSWORD,
        // Store phone fields for UI/searching
        phone1: body.phone1 || '',
        phone: phoneNormalized || body.phone || body.phone1 || '',
        coursesTitle: body.courseTitle ? [body.courseTitle] : [],
        // Reminder tracking
        reminderCount: 0,
        // lastReminderAt intentionally omitted until first send
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.user.uid, // Track who created this student
        // Flag to indicate if Auth user was created (for debugging)
        authUserCreated: !!userRecord,
      };
      
      const docRef = await adminDb.collection("students").add(studentData);
      const studentDocId = docRef.id;
      
      // CRT students: store full admission form in students/crtstudent/admission/{studentDocId}
      if (isCrt) {
        const crtAdmissionData = {
          regNo: body.regdNo,
          studentName: name,
          fatherName: body.fatherName || '',
          gender: body.gender || '',
          dateOfBirth: body.dob || '',
          aadharNo: body.aadharNo || '',
          email,
          phone1: body.phone1 || '',
          phone2: body.phone2 || '',
          qualification: body.qualification || '',
          collegeUniversity: body.college || '',
          degree: body.degree || '',
          branch: body.branch || '',
          yearOfPassing: body.yearOfPassing || '',
          workExperienceYears: body.workExperienceYears || body.workExperience || '',
          company: body.company || body.workCompany || '',
          skillSet: body.skillSet || '',
          courseProjectTitle: body.courseTitle || '',
          dateOfJoining: body.dateOfJoining || '',
          timings: body.timings || '',
          totalFee: body.totalFee ?? '',
          paidFee: body.PayedFee ?? body.paidFee ?? '',
          remarks: body.remarks || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: req.user.uid,
        };
        await adminDb
          .collection("students")
          .doc("crtstudent")
          .collection("admission")
          .doc(studentDocId)
          .set(crtAdmissionData);
      }
      
      studentCreated = true;
      console.log(`Student created successfully with UID: ${studentUid}, docId: ${studentDocId}, authUserCreated: ${!!userRecord}`);
    } catch (firestoreWriteError) {
      // Handle DECODER errors in Firestore writes
      const writeErrorMsg = String(firestoreWriteError?.message || '');
      const isWriteDecoderError = writeErrorMsg.includes('DECODER routines') || 
                                  writeErrorMsg.includes('1E08010C') ||
                                  firestoreWriteError.code === 'ERR_OSSL_UNSUPPORTED';
      const isTransientNetwork =
        firestoreWriteError.code === 'ECONNRESET' ||
        writeErrorMsg.includes('socket hang up') ||
        writeErrorMsg.includes('ETIMEDOUT');
      
      if (isWriteDecoderError || isTransientNetwork) {
        console.error('❌ Firestore write failed. Attempting REST API fallback...', {
          code: firestoreWriteError.code,
          decoder: isWriteDecoderError,
          transient: isTransientNetwork,
        });
        
        try {
          const { accessToken, serviceAccount } = await getGoogleAccessToken('https://www.googleapis.com/auth/datastore');
          const projectId =
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            process.env.FIREBASE_PROJECT_ID ||
            serviceAccount.project_id;
          
          const phoneNormalized2 = normalizeToE164(body.phone || body.phone1);
          const isCrtRest = !!body.isCrt;
          
          const studentDataRest = {
            fields: {
              regdNo: { stringValue: String(body.regdNo || '') },
              email: { stringValue: email },
              emailNormalized: { stringValue: normalizeEmail(email) },
              name: { stringValue: name },
              classId: { stringValue: classId || 'general' },
              uid: { stringValue: studentUid },
              role: { stringValue: derivedRole },
              isCrt: { booleanValue: isCrtRest },
              collegeSubdomain: { stringValue: targetSubdomain || "" },
              password: { stringValue: DEFAULT_STUDENT_PASSWORD },
              phone1: { stringValue: body.phone1 || '' },
              phone: { stringValue: phoneNormalized2 || body.phone || body.phone1 || '' },
              coursesTitle: { arrayValue: { values: body.courseTitle ? [{ stringValue: body.courseTitle }] : [] } },
              reminderCount: { integerValue: '0' },
              createdAt: { timestampValue: new Date().toISOString() },
              createdBy: { stringValue: req.user.uid },
              authUserCreated: { booleanValue: !!userRecord },
              isInternship: { booleanValue: !!body.isInternship }
            }
          };
          
          // Add optional fields
          if (body.fatherName) studentDataRest.fields.fatherName = { stringValue: String(body.fatherName) };
          if (body.presentAddress) studentDataRest.fields.presentAddress = { stringValue: String(body.presentAddress) };
          if (body.addressAsPerAadhar) studentDataRest.fields.addressAsPerAadhar = { stringValue: String(body.addressAsPerAadhar) };
          if (body.aadharNo) studentDataRest.fields.aadharNo = { stringValue: String(body.aadharNo) };
          if (body.gender) studentDataRest.fields.gender = { stringValue: String(body.gender) };
          if (body.dob) studentDataRest.fields.dob = { stringValue: String(body.dob) };
          if (body.qualification) studentDataRest.fields.qualification = { stringValue: String(body.qualification) };
          if (body.college) studentDataRest.fields.college = { stringValue: String(body.college) };
          if (body.degree) studentDataRest.fields.degree = { stringValue: String(body.degree) };
          if (body.branch) studentDataRest.fields.branch = { stringValue: String(body.branch) };
          if (body.yearOfPassing) studentDataRest.fields.yearOfPassing = { stringValue: String(body.yearOfPassing) };
          if (body.workExperience) studentDataRest.fields.workExperience = { stringValue: String(body.workExperience) };
          if (body.workCompany) studentDataRest.fields.workCompany = { stringValue: String(body.workCompany) };
          if (body.skillSet) studentDataRest.fields.skillSet = { stringValue: String(body.skillSet) };
          if (body.courseTitle) studentDataRest.fields.courseTitle = { stringValue: String(body.courseTitle) };
          if (body.totalFee) studentDataRest.fields.totalFee = { doubleValue: Number(body.totalFee) };
          if (body.PayedFee !== undefined) studentDataRest.fields.PayedFee = { doubleValue: Number(body.PayedFee) };
          if (body.remarks) studentDataRest.fields.remarks = { stringValue: String(body.remarks) };
          if (body.classIds) studentDataRest.fields.classIds = {
            arrayValue: {
              values: Array.isArray(body.classIds)
                ? body.classIds.map((id) => ({ stringValue: id }))
                : []
            }
          };
          
          // Create document using REST API
          const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/students`;
          const restResponse = await fetch(restUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(studentDataRest)
          });
          
          if (!restResponse.ok) {
            const errorData = await restResponse.json().catch(() => ({}));
            throw new Error(`REST API failed: ${JSON.stringify(errorData)}`);
          }
          
          const restResult = await restResponse.json();
          const docName = restResult.name || '';
          const studentDocIdMatch = docName.match(/\/documents\/students\/([^/]+)$/);
          const studentDocId = studentDocIdMatch ? studentDocIdMatch[1] : null;
          
          // CRT students: create students/crtstudent/admission/{studentDocId} via REST
          if (isCrtRest && studentDocId) {
            const crtAdmissionRest = {
              fields: {
                regNo: { stringValue: String(body.regdNo || '') },
                studentName: { stringValue: name },
                fatherName: { stringValue: String(body.fatherName || '') },
                gender: { stringValue: String(body.gender || '') },
                dateOfBirth: { stringValue: String(body.dob || '') },
                aadharNo: { stringValue: String(body.aadharNo || '') },
                email: { stringValue: email },
                phone1: { stringValue: String(body.phone1 || '') },
                phone2: { stringValue: String(body.phone2 || '') },
                qualification: { stringValue: String(body.qualification || '') },
                collegeUniversity: { stringValue: String(body.college || '') },
                degree: { stringValue: String(body.degree || '') },
                branch: { stringValue: String(body.branch || '') },
                yearOfPassing: { stringValue: String(body.yearOfPassing || '') },
                workExperienceYears: { stringValue: String(body.workExperienceYears || body.workExperience || '') },
                company: { stringValue: String(body.company || body.workCompany || '') },
                skillSet: { stringValue: String(body.skillSet || '') },
                courseProjectTitle: { stringValue: String(body.courseTitle || '') },
                dateOfJoining: { stringValue: String(body.dateOfJoining || '') },
                timings: { stringValue: String(body.timings || '') },
                totalFee: { stringValue: String(body.totalFee ?? '') },
                paidFee: { stringValue: String(body.PayedFee ?? body.paidFee ?? '') },
                remarks: { stringValue: String(body.remarks || '') },
                createdAt: { timestampValue: new Date().toISOString() },
                createdBy: { stringValue: req.user.uid },
              }
            };
            const crtRestUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/students/crtstudent/admission?documentId=${studentDocId}`;
            const crtRestRes = await fetch(crtRestUrl, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(crtAdmissionRest),
            });
            if (!crtRestRes.ok) {
              console.warn('⚠️ CRT admission subcollection write failed:', await crtRestRes.text());
            }
          }
          
          studentCreated = true;
          useRestApi = true;
          console.log(`✅ Student created successfully via REST API fallback with UID: ${studentUid}, authUserCreated: ${!!userRecord}`);
        } catch (restApiError) {
          console.error('❌ REST API fallback also failed:', restApiError.message);
          return new Response(
            JSON.stringify({ 
              error: "Failed to create student due to OpenSSL compatibility issue. Both Admin SDK and REST API methods failed. Please check your Firebase configuration or try again later.",
              details: "Firestore write operation failed due to DECODER error. REST API fallback also failed.",
              studentUid: studentUid,
              authUserCreated: !!userRecord,
              debug: process.env.NODE_ENV !== 'production' ? {
                firestoreError: writeErrorMsg,
                restApiError: restApiError.message
              } : undefined
            }),
            { status: 500 }
          );
        }
      } else {
        // Re-throw non-DECODER errors
        throw firestoreWriteError;
      }
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
