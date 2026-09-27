import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { ok, fail } from "@/lib/errors";
import { submitAttempt } from "@/modules/completion/service";
import { queueAutoAnalysisForAttempt } from "@/modules/assessment/service";
import { auditLog } from "@/lib/audit/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessStudentWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const attempt = await submitAttempt(id, session.id);

    try {
      await queueAutoAnalysisForAttempt(id, traceId);
    } catch (queueErr) {
      // Queue failures should not block submit operation.
      console.error("[attempt submit] failed to queue assessment analysis", {
        attemptId: id,
        traceId,
        err: queueErr,
      });
    }

    await auditLog({
      userId: session.id,
      action: "attempt.submitted",
      entityType: "Attempt",
      entityId: id,
      context: { submittedAt: attempt.submittedAt?.toISOString() },
      traceId,
    });

    return NextResponse.json(ok(attempt, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
