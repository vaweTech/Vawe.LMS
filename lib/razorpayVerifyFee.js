import crypto from "crypto";
import admin from "firebase-admin";
import { getRazorpayKeys } from "@/lib/razorpayKeys";

function studentCourseTitle(data) {
  if (Array.isArray(data?.coursesTitle)) return data.coursesTitle.join(", ");
  return data?.coursesTitle || "";
}

function buildWhatsAppNotifications(data, studentId, {
  razorpay_payment_id,
  addAmount,
  currentPaid,
  totalFee,
  nextPaid,
  paymentDate,
}) {
  const phone = data.phone1 || data.phone;
  const remainingDue = Math.max(totalFee - nextPaid, 0);
  const course = studentCourseTitle(data);

  return {
    feeReceipt: phone
      ? {
          phone,
          name: data.name || "Student",
          receiptNo: razorpay_payment_id,
          amount: addAmount,
          paymentDate,
          receiptDetails: {
            name: data.name,
            email: data.email,
            phone,
            studentId,
            course,
            paymentMethod: "online",
            paymentId: razorpay_payment_id,
            totalFee,
            previousPaid: currentPaid,
          },
        }
      : null,
    manager: {
      name: data.name || "Student",
      course,
      totalFee,
      paidAmount: addAmount,
      dueAmount: remainingDue,
      receiptNo: razorpay_payment_id,
      paymentMethod: "online",
      paymentDate,
    },
  };
}

/**
 * Verify Razorpay signature and update student fee in Firestore.
 * @param {{ razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string, amount: number, studentId: string, processedBy: { uid: string, email?: string } }} params
 */
export async function verifyRazorpayFeePayment({
  razorpay_payment_id,
  razorpay_order_id,
  razorpay_signature,
  amount,
  studentId,
  processedBy,
}) {
  const text = `${razorpay_order_id}|${razorpay_payment_id}`;
  const { key_secret } = getRazorpayKeys();
  if (!key_secret) {
    return { ok: false, status: 500, body: { error: "Server payment keys not configured" } };
  }

  const signature = crypto.createHmac("sha256", key_secret).update(text).digest("hex");
  if (signature !== razorpay_signature) {
    return { ok: false, status: 400, body: { error: "Invalid payment signature" } };
  }

  const db = admin.firestore();
  const docRef = db.collection("students").doc(studentId);
  const snap = await docRef.get();
  if (!snap.exists) {
    return { ok: false, status: 404, body: { error: "Student not found" } };
  }

  const data = snap.data();
  const currentPaid = Number(data.PayedFee ?? data.payedFee ?? 0);
  const totalFee = Number(data.totalFee ?? 0);
  const addAmount = Math.round(amount) / 100;
  const nextPaid = currentPaid + addAmount;

  if (nextPaid > totalFee) {
    return { ok: false, status: 400, body: { error: "Payment exceeds total fee" } };
  }

  await docRef.update({
    PayedFee: nextPaid,
    lastPaymentDate: new Date().toISOString(),
    lastPaymentAmount: addAmount,
    lastPaymentMethod: "online",
  });

  try {
    await docRef.collection("payments").add({
      amount: addAmount,
      paymentMethod: "online",
      paymentDate: new Date().toISOString(),
      status: "completed",
      type: "fee_payment",
      processedBy: processedBy.uid,
      processedByEmail: processedBy.email || "",
      razorpay_payment_id,
      razorpay_order_id,
    });
  } catch (_) {
    /* payment subcollection optional */
  }

  const paymentDate = new Date().toISOString();
  const whatsappNotifications = buildWhatsAppNotifications(data, studentId, {
    razorpay_payment_id,
    addAmount,
    currentPaid,
    totalFee,
    nextPaid,
    paymentDate,
  });

  return {
    ok: true,
    status: 200,
    whatsappNotifications,
    body: {
      success: true,
      message: "Payment verified and fee updated",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      amount,
      studentId,
      newPaid: nextPaid,
      totalFee,
      remainingDue: Math.max(totalFee - nextPaid, 0),
    },
  };
}
