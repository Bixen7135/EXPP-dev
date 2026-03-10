import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { createDistribution, listDistributions } from "@/modules/distribution/service";
import { auditLog } from "@/lib/audit/logger";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER" && session.role !== "ADMIN")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const distributions = await listDistributions(session.id);
  return NextResponse.json(ok(distributions, traceId));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER" && session.role !== "ADMIN")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const {
      assignmentId,
      versionId,
      deadline,
      distributionStatus,
      isGraded,
      aiHelpMode,
      recipientStudentIds,
    } = body ?? {};

    if (!assignmentId || typeof assignmentId !== "string")
      return NextResponse.json(fail("assignmentId is required", "VALIDATION_ERROR", traceId), { status: 422 });
    if (!versionId || typeof versionId !== "string")
      return NextResponse.json(fail("versionId is required", "VALIDATION_ERROR", traceId), { status: 422 });
    if (!Array.isArray(recipientStudentIds) || recipientStudentIds.length === 0)
      return NextResponse.json(fail("recipientStudentIds must be a non-empty array", "VALIDATION_ERROR", traceId), { status: 422 });

    const distribution = await createDistribution({
      assignmentId,
      versionId,
      teacherId: session.id,
      deadline: deadline ? new Date(deadline) : null,
      distributionStatus: distributionStatus ?? "MANDATORY",
      isGraded: isGraded !== false,
      aiHelpMode: aiHelpMode ?? "NO_HELP",
      recipientStudentIds,
    });

    await auditLog({
      userId: session.id,
      action: "distribution.created",
      entityType: "AssignmentDistribution",
      entityId: distribution.id,
      context: {
        assignmentId,
        recipientCount: recipientStudentIds.length,
        aiHelpMode,
        distributionStatus,
      },
      traceId,
    });

    return NextResponse.json(ok(distribution, traceId), { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
