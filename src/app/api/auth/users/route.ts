import { NextRequest, NextResponse } from "next/server";
import {
  extractSessionRequestMetadata,
  resolveSession,
  resolveSessionByToken,
  setSessionCookie,
  upsertSessionWithUser,
} from "@/lib/auth/session";
import {
  autoVerifyEmailIfEnabled,
  normalizeEmailAddress,
} from "@/lib/auth/email-verification";
import { ok, fail, ValidationError, AppError, AuthError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { auditLog } from "@/lib/audit/logger";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? crypto.randomUUID();
  const session = await resolveSession();
  if (!session) {
    return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
      status: 401,
    });
  }

  return NextResponse.json(ok(session.availableUsers, traceId));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? crypto.randomUUID();
  const requestMeta = extractSessionRequestMetadata(req.headers);
  const currentSession = await resolveSession(requestMeta);
  if (!currentSession) {
    return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
      status: 401,
    });
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || typeof body.email !== "string") {
      throw new ValidationError("email is required");
    }
    if (!body.password || typeof body.password !== "string") {
      throw new ValidationError("password is required");
    }

    const normalizedEmail = normalizeEmailAddress(body.email);
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });
    const passwordValid =
      user != null && (await verifyPassword(body.password, user.passwordHash));

    if (!user || !passwordValid) {
      throw new AuthError("Invalid email or password");
    }
    if (!user.isActive) {
      throw new AuthError("User is disabled");
    }
    const emailVerifiedAt = await autoVerifyEmailIfEnabled({
      userId: user.id,
      emailVerifiedAt: user.emailVerifiedAt,
    });

    if (!emailVerifiedAt) {
      throw new AppError(
        "Please verify your email before signing in.",
        "EMAIL_NOT_VERIFIED",
        403
      );
    }

    const userContext = await prisma.account.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!userContext) {
      throw new AuthError("No active user context linked to this credential");
    }

    const token = await upsertSessionWithUser(userContext.id, requestMeta);
    await setSessionCookie(token);

    const updatedSession = await resolveSessionByToken(token, { requestMeta });
    if (!updatedSession) {
      throw new AppError("Session update failed", "AUTH_ERROR", 500);
    }

    await auditLog({
      userId: currentSession.userId,
      actorAccountId: currentSession.id,
      organizationId: updatedSession.organizationId ?? undefined,
      action: "auth.user_added",
      entityType: "User",
      entityId: user.id,
      context: { addedUserId: user.id, addedUserContextId: userContext.id },
      traceId,
    });

    return NextResponse.json(
      ok(
        {
          activeUser: {
            id: updatedSession.id,
            domain: updatedSession.domain,
            displayName: updatedSession.displayName,
            avatarUrl: updatedSession.avatarUrl,
            organizationId: updatedSession.organizationId,
            organizationName: updatedSession.organizationName,
            permissions: updatedSession.permissions,
          },
          users: updatedSession.availableUsers,
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

