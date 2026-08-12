export const runtime = "nodejs";

import Razorpay from "razorpay";
import { getRazorpayKeys } from "@/lib/razorpayKeys";
import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { z } from 'zod';

// Input validation schema
const createOrderSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  receipt: z.string().min(1, 'Receipt is required')
});

async function createOrderHandler(request) {
  try {
    const { amount, currency = "INR", receipt } = request.validatedBody;
    if (!amount) {
      return new Response(JSON.stringify({ error: "Amount required" }), { status: 400 });
    }

    const { key_id, key_secret } = getRazorpayKeys();
    if (!key_id || !key_secret) {
      return new Response(
        JSON.stringify({ error: "Server payment keys not configured" }),
        { status: 500 }
      );
    }

    const instance = new Razorpay({
      key_id,
      key_secret,
    });

    const order = await instance.orders.create({ amount, currency, receipt });
    
    // Add audit trail
    console.log(`Order created by ${request.user.email} for amount ${amount}`);
    
    return new Response(
      JSON.stringify({ ...order, key_id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Razorpay order error:", e);
    return new Response(
      JSON.stringify({ error: e?.error?.description || e.message || "Order creation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Apply security middleware: Admin auth + Rate limiting + Input validation
export async function POST(request) {
  return await withAdminAuth(request, (req1) =>
    withRateLimit(30, 15 * 60 * 1000)(req1, (req2) =>
      validateInput(createOrderSchema)(req2, createOrderHandler)
    )
  );
}


