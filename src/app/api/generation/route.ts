import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import {
  ok,
  fail,
  AppError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors";
import {
  createGenerationRequest,
  listGenerationRequests,
} from "@/modules/generation/service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(
        fail("Unauthorized", "AUTH_ERROR", traceId),
        { status: 401 }
      );
    }
    if (!canAccessTeacherWorkspace(session)) {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    const requests = await listGenerationRequests(session.id);
    return NextResponse.json(ok(requests, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        fail(err.message, err.code, traceId),
        { status: err.statusCode }
      );
    }
    console.error("[generation GET]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(
        fail("Unauthorized", "AUTH_ERROR", traceId),
        { status: 401 }
      );
    }
    if (!canAccessTeacherWorkspace(session)) {
      throw new ForbiddenError();
    }

    const body = await request.json();
    const { constraints, materialIds } = body;

    if (!Array.isArray(materialIds)) {
      throw new ValidationError("materialIds must be an array");
    }

    const result = await createGenerationRequest({
      ownerAccountId: session.id,
      constraints,
      materialIds,
    });

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: "generation.request.created",
      entityType: "generation_request",
      entityId: result.id,
      context: { constraints, materialIds, status: result.status },
      traceId,
    });

    return NextResponse.json(ok(result, traceId), { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        fail(err.message, err.code, traceId),
        { status: err.statusCode }
      );
    }
    console.error("[generation POST]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

