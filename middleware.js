import { NextResponse } from "next/server";

function isAppDisabled() {
  const value = String(process.env.APP_DISABLED ?? "")
    .trim()
    .toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function unavailableResponse() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Service Unavailable</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: linear-gradient(180deg, #f0f7ff 0%, #e8f4f8 100%);
      color: #0f172a;
      padding: 24px;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px 28px;
      box-shadow: 0 10px 40px -16px rgba(0, 68, 138, 0.25);
      text-align: center;
    }
    .code {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #00448a;
      background: #e8f2fc;
      border-radius: 999px;
      padding: 6px 12px;
      margin-bottom: 16px;
    }
    h1 { font-size: 1.5rem; margin: 0 0 10px; }
    p { margin: 0; color: #64748b; line-height: 1.5; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="code">HTTP 503</div>
    <h1>Application unavailable</h1>
    <p>This service is temporarily disabled. Please try again later.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Retry-After": "3600",
    },
  });
}

export function middleware(_req) {
  if (isAppDisabled()) {
    return unavailableResponse();
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets / Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
