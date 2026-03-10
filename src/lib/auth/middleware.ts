import { NextRequest } from "next/server";

const SESSION_COOKIE = "expp_session";
type Role = "STUDENT" | "TEACHER" | "ADMIN";

interface RouteRule {
  prefix: string;
  allowedRoles: Role[];
  redirectTo: string;
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/teacher", allowedRoles: ["TEACHER", "ADMIN"], redirectTo: "/login" },
  { prefix: "/student", allowedRoles: ["STUDENT"], redirectTo: "/login" },
  { prefix: "/admin", allowedRoles: ["ADMIN"], redirectTo: "/login" },
];

export async function resolveSessionFromRequest(
  request: NextRequest
): Promise<{ token: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return { token };
}

export function matchRouteRule(pathname: string): RouteRule | null {
  return ROUTE_RULES.find((r) => pathname.startsWith(r.prefix)) ?? null;
}

export function isAllowed(role: Role, rule: RouteRule): boolean {
  return rule.allowedRoles.includes(role);
}
