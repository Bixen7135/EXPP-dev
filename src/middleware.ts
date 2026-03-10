import { NextRequest, NextResponse } from "next/server";
import {
  resolveSessionFromRequest,
  matchRouteRule,
} from "@/lib/auth/middleware";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const traceId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();
  response.headers.set("x-trace-id", traceId);
  response.headers.set("x-request-id", traceId);

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return response;
  }

  const rule = matchRouteRule(pathname);
  if (!rule) return response;

  const session = await resolveSessionFromRequest(request);

  if (!session) {
    const loginUrl = new URL(rule.redirectTo, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const proxied = NextResponse.next();
  proxied.headers.set("x-trace-id", traceId);
  proxied.headers.set("x-has-session", "true");
  return proxied;
}

export const config = {
  matcher: [
    "/teacher/:path*",
    "/student/:path*",
    "/admin/:path*",
  ],
};
