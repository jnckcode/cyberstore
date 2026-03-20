import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { consumeMemoryRateLimit, getClientIp } from "@/lib/security";

const strictPaths = new Set([
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/register",
  "/api/checkout",
  "/api/webhook/dana"
]);

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (strictPaths.has(path)) {
    const ip = getClientIp(request);
    const { allowed, retryAfterSec } = consumeMemoryRateLimit(`strict:${path}:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec)
          }
        }
      );
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
