import admin from "firebase-admin";
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

async function handler(request) {
  const { email } = request.validatedBody;
  try {
    const user = await admin.auth().getUserByEmail(email);
    return new Response(
      JSON.stringify({ exists: true, uid: user?.uid || null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (err?.code === "auth/user-not-found") {
      return new Response(
        JSON.stringify({ exists: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const message = String(err?.message || "Failed to check auth user").replace(
      /[\x00-\x1F\x7F]/g,
      ""
    );
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(request) {
  return await withAdminAuth(request, (req1) =>
    withRateLimit(60, 15 * 60 * 1000)(req1, (req2) =>
      validateInput(schema)(req2, handler)
    )
  );
}

