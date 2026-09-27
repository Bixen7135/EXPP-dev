import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { ok, fail } from "@/lib/errors";
import { getStudentAnalytics } from "@/modules/analytics/student";

// GET ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â returns analytics for the authenticated student
export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessStudentWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const teacherId = req.nextUrl.searchParams.get("teacherId");
  const subject = req.nextUrl.searchParams.get("subject");
  const period = req.nextUrl.searchParams.get("period");

  const analytics = await getStudentAnalytics(session.id, {
    teacherId: teacherId && teacherId.trim() ? teacherId : null,
    subject: subject && subject.trim() ? subject : null,
    period: period === "all_time" || !period ? "all_time" : "all_time",
  });
  return NextResponse.json(ok(analytics, traceId));
}
