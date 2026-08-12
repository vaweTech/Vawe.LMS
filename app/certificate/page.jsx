"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import Image from "next/image";

function CertificateContent() {
  const searchParams = useSearchParams();
  const [printReady, setPrintReady] = useState(false);
  const [templateSrc, setTemplateSrc] = useState("");

  const isInternship = searchParams.get("type") === "internship";

  const data = useMemo(() => {
    const now = new Date();
    const defaultDate = now.toLocaleDateString();
    const name = searchParams.get("name") || "";
    const course = searchParams.get("course") || "";
    const certNo =
      searchParams.get("certNo") ||
      `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${Math.floor(Date.now() / 1000)}`;
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const issued = searchParams.get("issued") || defaultDate;
    const regNo = searchParams.get("regNo") || "";
    const college = searchParams.get("college") || "";
    return { name, course, certNo, from, to, issued, regNo, college };
  }, [searchParams]);

  const nameLines = useMemo(() => {
    const full = (data.name || "").trim().replace(/\s+/g, " ");
    if (full.length <= 16) return [full, ""];
    const words = full.split(" ");
    let line1 = "";
    let i = 0;
    while (i < words.length) {
      const candidate = line1 ? line1 + " " + words[i] : words[i];
      if (candidate.length < 16) {
        line1 = candidate;
        i++;
        continue;
      }
      if (candidate.length === 16) {
        break;
      }
      break;
    }
    if (!line1) {
      line1 = full.slice(0, 16);
      return [line1, full.slice(16).trimStart()];
    }
    const line2 = words.slice(i).join(" ");
    return [line1, line2];
  }, [data.name]);

  useEffect(() => {
    const probe = async () => {
      const candidates = isInternship ? ["/CIC.jpeg"] : ["/cc_certificate.png"];
      for (const url of candidates) {
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            setTemplateSrc(url);
            break;
          }
        } catch {}
      }
      setPrintReady(true);
    };
    probe();
  }, [isInternship]);

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  const templateSizes = isInternship
    ? "(min-width: 1216px) 1152px, calc(100vw - 4rem)"
    : "(min-width: 1088px) 1024px, calc(100vw - 4rem)";

  return (
    <div
      id="certificate-root"
      data-cert-type={isInternship ? "internship" : "course"}
      className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:p-0 print:min-h-0"
    >
      <div className={`cert-sheet mx-auto bg-white rounded-xl shadow print:shadow-none print:border-0 print:max-w-none print:rounded-none print:p-0 p-4 ${isInternship ? "max-w-6xl" : "max-w-5xl"}`}>
        <div className="cert-screen-header flex items-center justify-between mb-4 print:hidden">
          <div className="flex items-center gap-3">
            <Image src="/vawe-logo.png" alt="VAWE" width={40} height={40} className="w-10 h-10 object-contain" />
            <h1 className="text-2xl font-extrabold tracking-wide">VAWE</h1>
          </div>
        </div>

        <div
          className={`cert-canvas relative w-full print:w-full print:h-[100vh] [container-type:inline-size] ${isInternship ? "cic-template" : ""}`}
          style={{
            aspectRatio: isInternship ? "1600/1158" : "1.414/1",
          }}
        >
          {templateSrc ? (
            <div className="absolute inset-0">
              <Image
                src={templateSrc}
                alt={isInternship ? "Certificate of Internship" : "Certificate Template"}
                fill
                sizes={templateSizes}
                className={`cic-bg-image ${isInternship ? "object-fill" : "object-contain"}`}
                priority
              />
            </div>
          ) : (
            <div className="absolute inset-0 w-full h-full bg-white" />
          )}

          <div className="absolute inset-0 z-10 w-full h-full">
            {isInternship ? (
              <>
                {/* Line 1: Mr/Ms [name], bearing Reg No: [regNo] */}
                <div className="absolute left-[34%] top-[47%] w-[30%]">
                  <p className="cic-name font-serif text-[clamp(11px,1.35cqi,16px)] font-semibold text-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {data.name}
                  </p>
                </div>
                <div className="absolute left-[80%] top-[47%] w-[16%]">
                  <p className="cic-regno font-serif text-[clamp(11px,1.35cqi,16px)] font-semibold text-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {data.regNo}
                  </p>
                </div>

                {/* Line 2: from [college] has successfully completed */}
                <div className="absolute left-[17%] top-[52%] w-[62%]">
                  <p className="cic-college font-serif text-[clamp(11px,1.35cqi,16px)] font-semibold text-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {data.college}
                  </p>
                </div>

                {/* Line 3: internship in [course] from [from] to [to] */}
                <div className="absolute left-[38%] top-[57.2%] w-[24%]">
                  <p className="cic-course font-serif text-[clamp(11px,1.35cqi,16px)] font-semibold text-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {data.course}
                  </p>
                </div>
                <div className="absolute left-[71%] top-[57.2%] w-[9%]">
                  <p className="cic-date font-serif text-[clamp(11px,1.35cqi,16px)] font-semibold text-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {data.from || ""}
                  </p>
                </div>
                <div className="absolute left-[84%] top-[57.2%] w-[9%]">
                  <p className="cic-date font-serif text-[clamp(11px,1.35cqi,16px)] font-semibold text-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {data.to || ""}
                  </p>
                </div>

                {/* Footer */}
                <div className="absolute left-[21%] bottom-[17.8%]">
                  <p className="cic-issued font-serif text-[clamp(10px,1.15cqi,14px)] font-medium text-black leading-none">
                    {data.issued}
                  </p>
                </div>
                <div className="absolute left-[19%] bottom-[12%]">
                  <p className="cic-certno font-serif text-[clamp(10px,1.15cqi,14px)] font-medium text-black leading-none">
                    {data.certNo}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="absolute text-sm mt-10 text-white ml-30 mt-15">
                  <span className="font-medium"></span> {data.certNo}
                </div>
                <div className="absolute left-[65%] right-[4%] top-[45%]">
                  <p className="cert-name text-[28px] font-semibold italic text-[#b87333] drop-shadow-sm whitespace-nowrap">
                    {nameLines[0]}
                  </p>
                </div>
                {nameLines[1] && (
                  <div className="absolute left-[35%] right-[10%] top-[52%]">
                    <p className="cert-name-line2 text-[26px] font-semibold italic text-[#b87333] drop-shadow-sm">
                      {nameLines[1]}
                    </p>
                  </div>
                )}
                <div className="absolute left-[55%] right-[9%] top-[61%]">
                  <p className="cert-course text-[22px] font-semibold tracking-wide text-[#7a1e16]">
                    {data.course}
                  </p>
                </div>
                <div className="absolute left-[42%] top-[64%]">
                  <p className="cert-date text-[20px] font-semibold text-[#7a1e16]">{data.from || ""}</p>
                </div>
                <div className="absolute left-[67%] top-[64%]">
                  <p className="cert-date text-[20px] font-semibold text-[#7a1e16]">{data.to || ""}</p>
                </div>
                <div className="absolute left-[39%] bottom-[11%] cert-issued text-sm">
                  <div>{data.issued}</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            disabled={!printReady}
            className={`px-4 py-2 rounded text-white ${printReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400"}`}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }
        @media print {
          html,
          body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #certificate-root,
          #certificate-root * {
            visibility: visible !important;
          }
          #certificate-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            min-height: 0;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          #certificate-root .cert-sheet {
            max-width: none !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          #certificate-root .cert-canvas {
            width: 100% !important;
            height: 100vh !important;
            aspect-ratio: auto !important;
          }
          #certificate-root .cic-bg-image {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #certificate-root .cert-name {
            font-size: 28px !important;
          }
          #certificate-root .cert-name-line2 {
            font-size: 26px !important;
          }
          #certificate-root .cert-course {
            font-size: 22px !important;
          }
          #certificate-root .cert-date {
            font-size: 20px !important;
          }
          #certificate-root .cert-issued {
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CertificatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CertificateContent />
    </Suspense>
  );
}
