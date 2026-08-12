import { NextResponse } from "next/server";

export function middleware(_req) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/superadmin/:path*"],
};
