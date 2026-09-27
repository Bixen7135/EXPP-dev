import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { ok, fail } from "@/lib/errors";
import { auditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/prisma";

type Params = { params: Promise<{ id: string }> };

type RestrictedEventType =
  | "COPY_BLOCKED"
  | "SCREENSHOT_ATTEMPT"
  | "TAB_SWITCH"
  | "WINDOW_BLUR";

const EVENT_ACTION_MAP: Record<RestrictedEventType, string> = {
  COPY_BLOCKED: "attempt.restricted.copy_blocked",
  SCREENSHOT_ATTEMPT: "attempt.restricted.screenshot_attempt",
  TAB_SWITCH: "attempt.restricted.tab_switch",
  WINDOW_BLUR: "attempt.restricted.window_blur",
};

function isRestrictedEventType(value: unknown): value is RestrictedEventType {
  if (typeof value !== "string") return false;
  return value in EVENT_ACTION_MAP;
}

function normalizeMeta(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";

  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessStudentWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const { eventType, meta } = body ?? {};

    if (!isRestrictedEventType(eventType)) {
      return NextResponse.json(
        fail("eventType is invalid", "VALIDATION_ERROR", traceId),
        { status: 422 }
      );
    }

    const attempt = await prisma.attempt.findUnique({
      where: { id },
      select: {
        id: true,
        learnerAccountId: true,
        recipientId: true,
        recipient: {
          select: {
            distributionId: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(fail("Attempt not found", "NOT_FOUND", traceId), { status: 404 });
    }
    if (attempt.learnerAccountId !== session.id) {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
    }

    const normalizedMeta = normalizeMeta(meta);

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: EVENT_ACTION_MAP[eventType],
      entityType: "Attempt",
      entityId: attempt.id,
      context: {
        eventType,
        recipientId: attempt.recipientId,
        distributionId: attempt.recipient.distributionId,
        ...(normalizedMeta ? { meta: normalizedMeta } : {}),
      },
      traceId,
    });

    return NextResponse.json(ok({ logged: true }, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN") {
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    }
    throw err;
  }
}
