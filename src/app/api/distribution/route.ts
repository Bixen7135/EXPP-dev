import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { createDistribution, listDistributions } from "@/modules/distribution/service";
import { auditLog } from "@/lib/audit/logger";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessTeacherWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const distributions = await listDistributions(session.id);
  return NextResponse.json(ok(distributions, traceId));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessTeacherWorkspace(session))
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
      recipientSources,
      recipientUserIds,
      includeUserIds,
      excludeUserIds,
    } = body ?? {};

    if (!assignmentId || typeof assignmentId !== "string")
      return NextResponse.json(fail("assignmentId is required", "VALIDATION_ERROR", traceId), { status: 422 });
    if (!versionId || typeof versionId !== "string")
      return NextResponse.json(fail("versionId is required", "VALIDATION_ERROR", traceId), { status: 422 });
    const distribution = await createDistribution({
      assignmentId,
      versionId,
      creatorUserId: session.id,
      deadline: deadline ? new Date(deadline) : null,
      distributionStatus: distributionStatus ?? "MANDATORY",
      isGraded: isGraded !== false,
      aiHelpMode: aiHelpMode ?? "NO_HELP",
      recipientSources: Array.isArray(recipientSources) ? recipientSources : [],
      recipientUserIds: Array.isArray(recipientUserIds) ? recipientUserIds : [],
      includeUserIds: Array.isArray(includeUserIds) ? includeUserIds : [],
      excludeUserIds: Array.isArray(excludeUserIds) ? excludeUserIds : [],
    });

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: "distribution.created",
      entityType: "AssignmentDistribution",
      entityId: distribution.id,
      context: {
        assignmentId,
        recipientCount: distribution.recipients.length,
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

