import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AppError } from "@/lib/errors";
import { cancelGenerationRequest } from "@/modules/generation/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
        status: 401,
      });
    }

    if (!canAccessTeacherWorkspace(session)) {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      reason?: unknown;
    };

    const reason = typeof body.reason === "string" ? body.reason : undefined;

    const result = await cancelGenerationRequest({
      id,
      ownerAccountId: session.id,
      reason,
    });

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: "generation.request.cancelled",
      entityType: "generation_request",
      entityId: id,
      context: {
        reason,
        status: result.status,
        runToken: result.runToken,
      },
      traceId,
    });

    return NextResponse.json(ok(result, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }

    console.error("[generation/[id]/cancel POST]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
