import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { reviewAssessment } from "@/modules/assessment/service";
import { auditLog } from "@/lib/audit/logger";

type Params = { params: Promise<{ attemptId: string }> };

// PATCH — teacher submits grade + comment -> REVIEWED
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { attemptId } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const { manualGrade, maxGrade, comment, itemOverrides } = body ?? {};

    if (typeof manualGrade !== "number" || typeof maxGrade !== "number") {
      return NextResponse.json(
        fail("manualGrade and maxGrade are required numbers", "VALIDATION_ERROR", traceId),
        { status: 422 }
      );
    }

    const assessment = await reviewAssessment(attemptId, session.id, {
      manualGrade,
      maxGrade,
      comment: typeof comment === "string" ? comment : undefined,
      itemOverrides: Array.isArray(itemOverrides) ? itemOverrides : undefined,
    });

    await auditLog({
      userId: session.id,
      action: "assessment.reviewed",
      entityType: "Assessment",
      entityId: assessment.id,
      context: { attemptId, manualGrade, maxGrade },
      traceId,
    });

    return NextResponse.json(ok(assessment, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN" || e.code === "VALIDATION_ERROR")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
