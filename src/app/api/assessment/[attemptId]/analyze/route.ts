import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { triggerAssessmentAnalysis } from "@/modules/assessment/service";
import { auditLog } from "@/lib/audit/logger";

type Params = { params: Promise<{ attemptId: string }> };

// POST - teacher manually enqueues AI re-analysis.
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { attemptId } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();

  if (!session) {
    return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  }
  if (session.role !== "TEACHER") {
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
  }

  try {
    const assessment = await triggerAssessmentAnalysis(attemptId, session.id, traceId);

    await auditLog({
      userId: session.id,
      action: "assessment.ai_rerun",
      entityType: "Assessment",
      entityId: assessment.id,
      context: { attemptId },
      traceId,
    });

    return NextResponse.json(ok(assessment, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN") {
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), {
        status: e.statusCode ?? 400,
      });
    }
    throw err;
  }
}
