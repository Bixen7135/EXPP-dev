import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { ok, fail } from "@/lib/errors";
import { getStudentResult } from "@/modules/assessment/service";

type Params = { params: Promise<{ attemptId: string }> };

// GET ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â student fetches published result
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { attemptId } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessStudentWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const result = await getStudentResult(attemptId, session.id);
    return NextResponse.json(ok(result, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
