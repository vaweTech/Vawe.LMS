"use client";

import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { auth } from "@/lib/firebase";

function SimplePDFViewerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pdfUrl = searchParams.get("url");
  const title = searchParams.get("title") || "Document";
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

  useEffect(() => {
    const noPrint = () => {
      window.getSelection()?.removeAllRanges();
    };
    window.addEventListener("beforeprint", noPrint);
    return () => window.removeEventListener("beforeprint", noPrint);
  }, []);

  // Get file extension to determine file type
  const fileExtension = pdfUrl?.split('.').pop()?.toLowerCase();
  const isPdf = fileExtension === 'pdf';
  const isWordDoc = fileExtension === 'docx' || fileExtension === 'doc';
  const isLocalFile = pdfUrl?.startsWith('/uploads/');

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (!pdfUrl) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">No PDF URL provided</h1>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft size={18} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // Block right-click and copy only on the document area (so header/footer and keyboard keep working)
  const preventCapture = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Styles: disable selection, disable print of content */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pdf-viewer-protected {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        .pdf-viewer-protected * {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        @media print {
          .pdf-viewer-protected .pdf-content-area { display: none !important; }
          .pdf-viewer-protected .pdf-no-print-msg { display: block !important; }
        }
        .pdf-no-print-msg { display: none; }
      `}} />
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={18} /> Back
            </button>
            <h1 className="text-lg font-semibold text-gray-800 truncate">
              {title}
            </h1>
          </div>
        </div>
      </div>

      {/* PDF Viewer - header/footer stay fully usable (keyboard, buttons); only document area protected */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="pdf-no-print-msg p-8 text-center text-gray-600 print:block">
            This document is protected. Screenshots, printing, and copying are not permitted.
          </div>
          <div
            className="pdf-content-area pdf-viewer-protected"
            onContextMenu={preventCapture}
            onCopy={preventCapture}
            onCut={preventCapture}
          >
           {isPdf ? (
             <>
               <iframe
                 src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&download=0&print=0`}
                 title={title}
                 className="w-full h-[calc(100vh-120px)] min-h-[600px] select-none"
                 frameBorder="0"
                 onLoad={() => console.log('PDF iframe loaded successfully')}
                 onError={() => console.log('PDF iframe failed to load')}
               />
               <div className="p-4 bg-gray-50 border-t">
                 <p className="text-sm text-gray-600 text-center">
                   PDF viewer – Download and print disabled for security.
                 </p>
               </div>
             </>
           ) : isWordDoc ? (
             // For Word documents, show message with download options
             <div className="p-8 text-center">
               <div className="max-w-md mx-auto">
                 <div className="mb-6">
                   <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                   </svg>
                 </div>
                 <h3 className="text-lg font-medium text-gray-900 mb-2">Word Document</h3>
                 <p className="text-gray-600 mb-6">
                   This is a Word document (.docx) that cannot be displayed directly in the browser.
                 </p>
                 <div className="flex flex-col gap-3">
                   <a
                     href={pdfUrl}
                     target="_blank"
                     className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                   >
                     Open in New Tab
                   </a>
                   <a
                     href={pdfUrl}
                     download
                     className="inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                   >
                     Download Document
                   </a>
                   <button
                     onClick={() => router.back()}
                     className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                   >
                     Go Back
                   </button>
                 </div>
               </div>
             </div>
           ) : (
             // For other file types, show generic message
             <div className="p-8 text-center">
               <div className="max-w-md mx-auto">
                 <div className="mb-6">
                   <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                   </svg>
                 </div>
                 <h3 className="text-lg font-medium text-gray-900 mb-2">Document Viewer</h3>
                 <p className="text-gray-600 mb-6">
                   This file type cannot be displayed directly in the browser.
                 </p>
                 <div className="flex flex-col gap-3">
                   <a
                     href={pdfUrl}
                     target="_blank"
                     className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                   >
                     Open in New Tab
                   </a>
                   <a
                     href={pdfUrl}
                     download
                     className="inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                   >
                     Download File
                   </a>
                   <button
                     onClick={() => router.back()}
                     className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                   >
                     Go Back
                   </button>
                 </div>
               </div>
             </div>
           )}
          </div>
         </div>
       </div>
    </div>
  );
}

export default function SimplePDFViewer() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Loading...</h1>
        </div>
      </div>
    }>
      <SimplePDFViewerContent />
    </Suspense>
  );
}
