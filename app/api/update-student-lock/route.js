import { adminDb } from "@/lib/firebaseAdmin";
import admin from "@/lib/firebaseAdmin";
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from 'zod';

// Input validation schema
const updateLockSchema = z.object({
  id: z.string().min(1, 'Student ID is required'),
  locked: z.boolean()
});

async function updateLockHandler(request) {
  try {
    console.log("Update student lock API called");
    const { id, locked } = request.validatedBody;
    console.log("Received data:", { id, locked });
    
    // Input validation is now handled by middleware

    const docRef = adminDb.collection("students").doc(id);
    const docSnap = await docRef.get();
    
    console.log("Document exists:", docSnap.exists);
    
    if (!docSnap.exists) {
      return new Response(
        JSON.stringify({ error: "Student not found" }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update the lock status
    await docRef.update({
      locked: locked,
      lockedAt: locked ? admin.firestore.FieldValue.serverTimestamp() : null,
      lockedBy: locked ? request.user.email : null
    });

    console.log("Lock status updated successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        message: locked ? "Student locked successfully" : "Student unlocked successfully",
        locked: locked,
        updatedBy: request.user.email
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Update lock error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Failed to update lock status" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Apply security middleware: Admin auth + Rate limiting + Input validation
export async function POST(request) {
  return await withAdminAuth(request, (req1) =>
    withRateLimit(100, 15 * 60 * 1000)(req1, (req2) =>
      validateInput(updateLockSchema)(req2, updateLockHandler)
    )
  );
}
