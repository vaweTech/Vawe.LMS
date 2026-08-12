import { withAdminAuth, withRateLimit, validateInput } from "@/lib/apiAuth";
import { verifyRazorpayFeePayment } from "@/lib/razorpayVerifyFee";
import { runPaymentWhatsAppNotifications } from "@/lib/feeReceiptWhatsApp";
import { after } from "next/server";
import { z } from "zod";

const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1, "Payment ID is required"),
  razorpay_order_id: z.string().min(1, "Order ID is required"),
  razorpay_signature: z.string().min(1, "Signature is required"),
  amount: z.number().positive("Amount must be positive"),
  studentId: z.string().min(1, "Student ID is required"),
});

async function verifyAdminPaymentHandler(request) {
  try {
    const result = await verifyRazorpayFeePayment({
      ...request.validatedBody,
      processedBy: { uid: request.user.uid, email: request.user.email },
    });

    if (result.ok && result.whatsappNotifications) {
      after(async () => {
        await runPaymentWhatsAppNotifications(result.whatsappNotifications);
      });
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin payment verification error:", error);
    return new Response(JSON.stringify({ error: "Payment verification failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const maxDuration = 60;

export async function POST(request) {
  return await withAdminAuth(request, (req1) =>
    withRateLimit(30, 15 * 60 * 1000)(req1, (req2) =>
      validateInput(verifyPaymentSchema)(req2, verifyAdminPaymentHandler)
    )
  );
}
