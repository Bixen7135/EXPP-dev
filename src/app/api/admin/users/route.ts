import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { listUsers } from "@/modules/admin/service";
import { canAccessAdminWorkspace } from "@/lib/auth/authorization";

// GET Ã¢â‚¬â€ admin lists all users
export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessAdminWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const users = await listUsers();
  return NextResponse.json(ok(users, traceId));
}
