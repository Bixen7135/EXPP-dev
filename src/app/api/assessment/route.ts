import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { listSubmissionsForDistribution } from "@/modules/assessment/service";

// GET — teacher lists submissions for a distribution
// Query: ?distributionId=...
export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const distributionId = req.nextUrl.searchParams.get("distributionId");
  if (!distributionId)
    return NextResponse.json(
      fail("distributionId query param is required", "VALIDATION_ERROR", traceId),
      { status: 422 }
    );

  try {
    const submissions = await listSubmissionsForDistribution(distributionId, session.id);
    return NextResponse.json(ok(submissions, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
