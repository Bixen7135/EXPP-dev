import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { ok, fail } from "@/lib/errors";
import { getTeacherAnalytics } from "@/modules/analytics/teacher";

// GET ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â returns analytics for the authenticated teacher's distributions
export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessTeacherWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const analytics = await getTeacherAnalytics(session.id);
  return NextResponse.json(ok(analytics, traceId));
}
