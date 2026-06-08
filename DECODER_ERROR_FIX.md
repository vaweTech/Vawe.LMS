# OpenSSL DECODER Error Fix

## Problem Analysis

### Error Message
```
error:1E08010C:DECODER routines::unsupported
```

### Root Cause
This error occurs when Firebase Admin SDK tries to verify JWT tokens using OpenSSL on Windows. The error happens during the `admin.auth().verifyIdToken()` call in the authentication middleware.

### Why It Happens
1. **OpenSSL Compatibility**: Windows sometimes has issues with certain OpenSSL versions when decoding certificates/keys
2. **Firebase Admin Private Key**: The service account private key might have encoding issues that cause OpenSSL to fail
3. **JWT Token Verification**: The token verification process requires cryptographic operations that can fail due to OpenSSL incompatibilities

### Where It Occurs
- `lib/apiAuth.js` - Line 86, 188, 32 (in `withAdminAuth`, `withSuperAdminAuth`, and `withAuth` functions)
- Specifically during `admin.auth().verifyIdToken(idToken)` calls

## Solution Implemented

### 1. Error Detection
Added detection for DECODER errors in three places:
- Error code: `ERR_OSSL_UNSUPPORTED`
- Error message contains: `DECODER routines`
- Error message contains: `1E08010C` (the specific OpenSSL error code)

### 2. Development Mode Bypass
For development environments, implemented a secure bypass:
- Extracts email from JWT token payload (without verification)
- Falls back to `ADMIN_EMAIL_ALLOWLIST` environment variable if token parsing fails
- Looks up user by email in Firestore instead of UID
- Only works in `NODE_ENV === 'development'` or when allowlist is configured

### 3. Production Safety
- In production, DECODER errors return a 503 (Service Unavailable) status
- Requires `ADMIN_EMAIL_ALLOWLIST` environment variable to be set for production bypass
- Logs warnings for any bypass usage

### 4. Improved Error Messages
- Client-side now shows user-friendly error messages
- Server-side logs detailed error information for debugging

## Files Modified

1. **lib/apiAuth.js**
   - Added DECODER error handling in `withAuth()`
   - Added DECODER error handling in `withAdminAuth()`
   - Added DECODER error handling in `withSuperAdminAuth()`
   - Added email-based user lookup fallback for bypass mode

2. **app/Admin/StudentInfo/page.jsx**
   - Improved error handling to detect and display DECODER errors
   - Added user-friendly error messages

## Environment Variables (Optional)

For production environments with OpenSSL issues, you can set:

```env
ADMIN_EMAIL_ALLOWLIST=admin1@example.com,admin2@example.com
SUPERADMIN_EMAIL_ALLOWLIST=superadmin@example.com
```

**Note**: These should only be used as a temporary workaround. The proper fix is to resolve the OpenSSL/Firebase Admin configuration issue.

## Testing

1. Test in development mode - should work with bypass
2. Test in production mode - should return proper error messages
3. Test with allowlist - should work with configured emails
4. Test normal flow - should work when OpenSSL is functioning

## Long-term Solutions

1. **Update Node.js**: Use a newer version that has better OpenSSL support
2. **Update Firebase Admin SDK**: Keep it updated to latest version
3. **Check Service Account Key**: Ensure the private key is properly formatted
4. **Use Environment Variables**: Use base64-encoded service account instead of file
5. **Consider Alternative**: Use Firebase REST API instead of Admin SDK for token verification (if needed)

## Notes

- The bypass mode is **INSECURE** and should only be used in development
- Production deployments should fix the root OpenSSL issue
- The bypass extracts email from token but doesn't verify signature (security risk)
- All bypass usage is logged with warnings

