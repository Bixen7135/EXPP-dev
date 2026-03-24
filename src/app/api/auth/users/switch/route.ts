import { NextRequest, NextResponse } from "next/server";
import {
  resolveSession,
  setActiveUserForCurrentSession,
} from "@/lib/auth/session";
import { ok, fail, ValidationError, AppError } from "@/lib/errors";
import { auditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? crypto.randomUUID();
  const session = await resolveSession();
  if (!session) {
    return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
      status: 401,
    });
  }

  try {
    const body = (await req.json()) as { userContextId?: string };
    if (!body.userContextId || typeof body.userContextId !== "string") {
      throw new ValidationError("userContextId is required");
    }

    if (!session.availableUsers.some((user) => user.id === body.userContextId)) {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    const switched = await setActiveUserForCurrentSession(body.userContextId);
    if (!switched) {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    const refreshedSession = await resolveSession();
    if (!refreshedSession) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
        status: 401,
      });
    }

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: refreshedSession.organizationId ?? undefined,
      action: "auth.user_switched",
      entityType: "User",
      entityId: refreshedSession.userId,
      context: {
        fromUserContextId: session.id,
        toUserContextId: refreshedSession.id,
      },
      traceId,
    });

    return NextResponse.json(
      ok(
        {
          activeUser: {
            id: refreshedSession.id,
            domain: refreshedSession.domain,
            displayName: refreshedSession.displayName,
            avatarUrl: refreshedSession.avatarUrl,
            organizationId: refreshedSession.organizationId,
            organizationName: refreshedSession.organizationName,
            permissions: refreshedSession.permissions,
          },
        },
        traceId
      )
    );
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    throw err;
  }
}

