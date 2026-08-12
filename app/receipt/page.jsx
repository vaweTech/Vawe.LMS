"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { auth } from "@/lib/firebase";

function ReceiptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [printedAt, setPrintedAt] = useState("");
  const [displayDate, setDisplayDate] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        // User is not authenticated, redirect to login
        router.push("/auth/login");
      } else {
        // User is authenticated
        setIsAuthenticated(true);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const data = useMemo(() => {
    const amountPaise = Number(searchParams.get("amount") || 0);
    const addAmount = Math.round(amountPaise) / 100;
    const totalFeePaise = Number(searchParams.get("totalFee") || 0);
    const totalFee = Math.round(totalFeePaise) / 100;
    const paidFeePaise = Number(searchParams.get("paidFee") || 0);
    const paidFee = Math.round(paidFeePaise) / 100;
    const nextPaid = paidFee + addAmount;
    const remainingDue = Math.max(totalFee - nextPaid, 0);
    
    // Debug logging
    console.log('Receipt received params:', {
      amount: searchParams.get("amount"),
      totalFee: searchParams.get("totalFee"),
      paidFee: searchParams.get("paidFee"),
      phone: searchParams.get("phone"),
      course: searchParams.get("course"),
      calculated: { addAmount, paidFee, totalFee, nextPaid, remainingDue }
    });
    
    return {
      payment_id: searchParams.get("payment_id") || "",
      order_id: searchParams.get("order_id") || "",
      studentId: searchParams.get("studentId") || "",
      name: searchParams.get("name") || "",
      email: searchParams.get("email") || "",
      phone: searchParams.get("phone") || "",
      course: searchParams.get("course") || "",
      date: searchParams.get("date") || new Date().toISOString(),
      paymentMethod: searchParams.get("paymentMethod") || "",
      paymentType: searchParams.get("type") || "",
      addAmount,
      paidFee,
      totalFee,
      nextPaid,
      remainingDue,
    };
  }, [searchParams]);

  // Avoid hydration mismatches: format dates on client only
  useEffect(() => {
    setPrintedAt(new Date().toLocaleString());
    try {
      setDisplayDate(new Date(data.date).toLocaleString());
    } catch {
      setDisplayDate(data.date);
    }
  }, [data.date]);

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div id="receipt-root" className="min-h-screen bg-gray-100 py-8 px-4 print:min-h-0 print:py-0 print:px-0 print:bg-white">
      <div className="receipt-card max-w-2xl mx-auto bg-white rounded-xl shadow-md border print:shadow-none print:border print:border-gray-300 print:rounded-none print:max-w-none">
        {/* Header with Logo and Institute Name */}
        <div className="p-6 border-b print:p-3 print:pb-2">
          <div className="flex items-center justify-between gap-4 print:gap-2">
            <div className="flex items-center gap-3 print:gap-2">
              <Image src="/vawe-logo.png" alt="Institute Logo" width={40} height={40} className="w-10 h-10 print:w-8 print:h-8 object-contain" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-wide text-gray-900 print:text-lg">VAWE</h1>
                <p className="text-xs text-gray-500 -mt-1 print:text-[10px]">Payment Receipt</p>
              </div>
            </div>
            <div className="text-right print:text-[10px]">
              <div className="hidden print:block text-gray-500">Printed on {printedAt}</div>
              <div className="text-xs text-gray-500 print:text-[10px]">Receipt Date: {displayDate}</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 print:p-3 print:space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-x-3 print:gap-y-1.5 print:text-xs">
            <div>
              <p className="text-xs text-gray-500">Payer Name</p>
              <p className="font-medium">{data.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium break-all">{data.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone Number</p>
              <p className="font-medium">{data.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Student ID</p>
              <p className="font-medium">{data.studentId || "-"}</p>
            </div>
            <div className="sm:col-span-2 print:col-span-1">
              <p className="text-xs text-gray-500 print:text-[10px]">Course Name</p>
              <p className="font-medium">{data.course || "-"}</p>
            </div>
            <div className="print:hidden">
              <p className="text-xs text-gray-500">Date</p>
              <p className="font-medium">{displayDate}</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden print:rounded">
            <table className="w-full text-sm print:text-xs">
              <tbody>
                <tr className="bg-gray-50">
                  <td className="p-3 text-gray-600 print:py-1.5 print:px-2">Total Course Fee</td>
                  <td className="p-3 font-semibold print:py-1.5 print:px-2">₹{data.totalFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="p-3 text-gray-600 print:py-1.5 print:px-2">Previously Paid</td>
                  <td className="p-3 font-medium print:py-1.5 print:px-2">₹{data.paidFee.toFixed(2)}</td>
                </tr>
                <tr className="bg-blue-50 border-t-2 border-blue-200 print:bg-blue-50">
                  <td className="p-3 text-gray-800 font-semibold print:py-1.5 print:px-2">Amount Paid Now</td>
                  <td className="p-3 font-bold text-blue-700 print:py-1.5 print:px-2">₹{data.addAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-green-50 border-t border-green-200 print:bg-green-50">
                  <td className="p-3 text-gray-800 font-semibold print:py-1.5 print:px-2">Total Paid After This Payment</td>
                  <td className="p-3 font-bold text-green-700 print:py-1.5 print:px-2">₹{data.nextPaid.toFixed(2)}</td>
                </tr>
                <tr className="bg-amber-50 border-t border-amber-200 print:bg-amber-50">
                  <td className="p-3 text-gray-800 font-semibold print:py-1.5 print:px-2">Remaining Due</td>
                  <td className="p-3 font-bold text-amber-700 print:py-1.5 print:px-2">₹{data.remainingDue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="p-3 text-gray-600 print:py-1.5 print:px-2">Payment Method</td>
                  <td className="p-3 font-medium capitalize print:py-1.5 print:px-2">{data.paymentMethod || '-'}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-3 text-gray-600 print:py-1.5 print:px-2">Payment Type</td>
                  <td className="p-3 font-medium capitalize print:py-1.5 print:px-2">{data.paymentType || 'fee_payment'}</td>
                </tr>
                {data.paymentMethod?.toLowerCase() !== "cash" && data.payment_id ? (
                  <tr>
                    <td className="p-3 text-gray-600 print:py-1.5 print:px-2">Payment ID</td>
                    <td className="p-3 font-mono text-xs break-all print:py-1.5 print:px-2 print:text-[9px]">{data.payment_id}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500 print:text-[9px] print:leading-tight">
            Note: This is a system-generated receipt for your records. For any corrections, please contact support.
          </div>
        </div>

        {/* Footer with Stamp/Signature */}
        <div className="px-6 pb-6 print:px-3 print:pb-3">
          <div className="mt-10 flex items-end justify-between print:mt-3">
            <div className="text-xs text-gray-500 print:text-[10px]">Thank you for choosing VAWE.</div>
            <div className="text-center">
              <Image src="/vawe-logo.png" alt="Institute Stamp" width={96} height={96} className="w-24 h-24 print:w-12 print:h-12 object-contain mx-auto opacity-90" />
              <div className="mt-1 text-sm text-gray-700 print:text-[10px] print:mt-0.5">Authorized Signatory</div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex items-center gap-2 print:hidden">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Print / Save PDF
          </button>
        </div>
      </div>
      {/* Print-only styles: single-page compact layout */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html,
          body {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          #receipt-root,
          #receipt-root * {
            visibility: visible !important;
          }
          #receipt-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          #receipt-root .receipt-card {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
            break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}


