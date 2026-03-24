import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { getAuditLog } from "@/modules/admin/service";
import { canAccessAdminWorkspace, canAccessTeacherWorkspace } from "@/lib/auth/authorization";

// GET â€” admin (full) or teacher (own events) audit log
// Query params: action, userId (admin only), entityType, from, to, page, pageSize
export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessAdminWorkspace(session) && !canAccessTeacherWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
  const asAdmin = canAccessAdminWorkspace(session);

  const sp = req.nextUrl.searchParams;
  const filters = {
    action: sp.get("action") ?? undefined,
    userId: asAdmin ? (sp.get("userId") ?? undefined) : undefined,
    entityType: sp.get("entityType") ?? undefined,
    from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
    to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
    page: sp.get("page") ? parseInt(sp.get("page")!, 10) : 1,
    pageSize: sp.get("pageSize") ? parseInt(sp.get("pageSize")!, 10) : 50,
  };

  const result = await getAuditLog(
    asAdmin ? "ADMIN" : "TEACHER",
    session.userId,
    filters
  );
  return NextResponse.json(ok(result, traceId));
}
