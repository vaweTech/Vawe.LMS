# Pseudocode and Used Algorithms

This document summarizes the core algorithms and logic workflows used in this application.

## 1) Authentication Middleware with Fallbacks

### Purpose
Validate Firebase ID tokens and support fallback mechanisms when SDK verification fails (for example, OpenSSL decoder issues).

### Pseudocode
```text
FUNCTION withAuth(request, handler):
    authHeader = read Authorization header
    IF authHeader missing OR not Bearer format:
        RETURN 401

    idToken = extract token
    IF token invalid format:
        RETURN 401

    TRY:
        decoded = FirebaseAdmin.verifyIdToken(idToken)
    CATCH decoderError:
        TRY:
            decoded = Firebase REST accounts:lookup fallback
        CATCH:
            decoded = manual JWT payload decode (unsafe fallback for allowlisted/dev cases)

    request.user = { uid, email, role }
    RETURN handler(request)
```

### Algorithm Type
- Token verification with multi-level fallback strategy
- Defensive error classification (decoder/network/auth errors)

---

## 2) Role-Based Access Control (Admin / Superadmin)

### Purpose
Restrict sensitive APIs to admin or superadmin users.

### Pseudocode
```text
FUNCTION withAdminAuth(request, handler):
    decodedUser = verify token (withAuth-style)

    TRY:
        userDoc = Firestore users/{uid}
        role = userDoc.role
    CATCH firestoreError:
        TRY:
            role = Firestore REST role lookup fallback
        CATCH:
            IF allowlist/dev fallback conditions pass:
                role = admin
            ELSE:
                THROW error

    IF role not in [admin, superadmin]:
        RETURN 403

    request.user = decodedUser + role
    RETURN handler(request)
```

### Algorithm Type
- RBAC (Role-Based Access Control)
- Fallback decision tree

---

## 3) Sliding-Window Rate Limiting

### Purpose
Prevent API abuse by limiting requests per IP and route over a time window.

### Pseudocode
```text
GLOBAL rateLimitMap

FUNCTION withRateLimit(maxRequests, windowMs):
    RETURN FUNCTION(request, handler):
        key = clientIP + "-" + request.url
        now = current time
        windowStart = now - windowMs

        FOR each entry in rateLimitMap:
            IF entry.timestamp < windowStart:
                delete entry

        current = rateLimitMap[key] OR { count: 0, timestamp: now }
        IF current.timestamp < windowStart:
            current.count = 1
            current.timestamp = now
        ELSE:
            current.count += 1

        save current back to map

        IF current.count > maxRequests:
            RETURN 429

        RETURN handler(request)
```

### Algorithm Type
- Sliding-window counter rate limiter
- Hash map lookup/update

---

## 4) OTP Verification with Attempts and Lockout

### Purpose
Store OTPs, verify them, limit retries, and apply temporary lockout after repeated failures.

### Pseudocode
```text
FUNCTION saveOtp(phone, otp, ttlMs):
    expiresAt = now + ttlMs
    record = read existing OTP record
    append otp to record.otps
    keep only last 5 OTPs
    reset attempts to 0
    clear lockoutUntil
    persist record

FUNCTION verifyOtp(phone, providedOtp):
    record = fetch OTP record
    IF no record:
        RETURN not_found

    IF lockoutUntil exists AND now < lockoutUntil:
        RETURN locked_out

    IF now > expiresAt:
        delete record
        RETURN expired

    normalize providedOtp and stored OTP list
    matched = providedOtp in stored OTP list

    IF not matched:
        attempts += 1
        IF attempts >= MAX_ATTEMPTS:
            lockoutUntil = now + LOCKOUT_DURATION
            persist
            RETURN locked_out
        persist attempts
        RETURN mismatch with attemptsLeft

    delete OTP record
    RETURN ok
```

### Algorithm Type
- Retry-limited authentication
- Time-based expiry check
- Temporary lockout policy

---

## 5) Payment Signature Verification (Razorpay)

### Purpose
Verify payment integrity and then update student fee records.

### Pseudocode
```text
FUNCTION verifyPayment(payload):
    validate payload schema (zod)

    expectedSignature = HMAC_SHA256(
        key = RAZORPAY_KEY_SECRET,
        message = orderId + "|" + paymentId
    )

    IF expectedSignature != providedSignature:
        RETURN 400 invalid signature

    student = fetch students/{studentId}
    IF student missing:
        RETURN 404

    addAmount = amountInPaise / 100
    nextPaid = currentPaid + addAmount
    IF nextPaid > totalFee:
        RETURN 400

    update student fee fields
    append payment record to subcollection

    RETURN success
```

### Algorithm Type
- HMAC-based signature verification
- Transaction-safe validation flow (validate before state update)

---

## 6) Student Dedup Aggregation Across Program Batches

### Purpose
Build one unique student list for a program from multiple batch-level sources.

### Pseudocode
```text
FUNCTION updateProgramStudentList(programId):
    program = fetch programs/{programId}
    IF program not found:
        RETURN 404

    uniqueStudents = Map()

    FOR each batch in program.batches:
        FOR each student in batch.enrolledStudents:
            key = student.email OR student.id OR student.name
            IF key not in uniqueStudents:
                uniqueStudents[key] = normalized student object

        IF batch.enrolledStudents empty AND allocatedStudentNames exists:
            FOR each name in allocatedStudentNames:
                key = name
                IF key not in uniqueStudents:
                    uniqueStudents[key] = fallback student object

    studentsList = values(uniqueStudents)

    update programs/{programId} with:
        students = studentsList
        totalStudents = length(studentsList)
        updatedAt = serverTimestamp

    RETURN success
```

### Algorithm Type
- Deduplication via hash map (Map)
- Merge/aggregation from heterogeneous inputs

---

## 7) Code Execution Provider Selection and Normalization

### Purpose
Execute user code through either OneCompiler or Judge0 and normalize outputs to one format.

### Pseudocode
```text
FUNCTION compile(request):
    input = parse { language, source, stdin }
    provider = ENV.CODE_RUN_PROVIDER default "judge0"

    IF provider == onecompiler:
        map language -> fileName
        call OneCompiler API
        RETURN normalize(output)

    ELSE:
        map language -> judge0 language_id
        call Judge0 API with wait=true
        RETURN normalize(output)

FUNCTION normalize(payload):
    return {
        stdout: payload.stdout OR payload.compile_output OR ""
        stderr: payload.stderr OR payload.message OR payload.exception OR ""
        status: payload.status.description OR payload.status OR derived default
    }
```

### Algorithm Type
- Strategy selection by provider flag
- Output normalization adapter pattern

---

## Data Structures Frequently Used

- `Map`: deduplication, rate-limit buckets, OTP temporary store
- Arrays: batch/student iteration, OTP history list (last N records)
- Firestore documents/subcollections: persistent state and audit trails

## Validation and Security Patterns

- Schema validation with `zod`
- Auth middleware chaining (`withAuth`, `withAdminAuth`, `withSuperAdminAuth`)
- HMAC signature checks for payment verification
- Request throttling with rate limiting
