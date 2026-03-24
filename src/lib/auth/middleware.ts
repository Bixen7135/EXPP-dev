import { NextRequest } from "next/server";

const SESSION_COOKIE = "expp_session";

interface RouteRule {
  prefix: string;
  requiredPermissions: string[];
  redirectTo: string;
}

const ROUTE_RULES: RouteRule[] = [
  {
    prefix: "/teacher",
    requiredPermissions: ["workspace.teacher", "workspace.admin"],
    redirectTo: "/login",
  },
  {
    prefix: "/student",
    requiredPermissions: ["workspace.student"],
    redirectTo: "/login",
  },
  {
    prefix: "/admin",
    requiredPermissions: ["workspace.admin"],
    redirectTo: "/login",
  },
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

export function isAllowed(permissions: string[], rule: RouteRule): boolean {
  if (permissions.includes("*")) return true;
  return rule.requiredPermissions.some((permission) =>
    permissions.includes(permission)
  );
}
