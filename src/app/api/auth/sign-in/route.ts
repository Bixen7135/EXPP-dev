import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  autoVerifyEmailIfEnabled,
  normalizeEmailAddress,
} from "@/lib/auth/email-verification";
import {
  extractSessionRequestMetadata,
  resolveSessionByToken,
  setSessionCookie,
  upsertSessionWithUser,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AuthError, AppError, ValidationError } from "@/lib/errors";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const requestMeta = extractSessionRequestMetadata(request.headers);
  const ip = requestMeta.ipAddress ?? "unknown";

  try {
    await checkRateLimit(ip);

    const body = await request.json();
    const parsed = SignInSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { email, password } = parsed.data;
    const normalizedEmail = normalizeEmailAddress(email);

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });
    const passwordValid =
      user != null && (await verifyPassword(password, user.passwordHash));

    if (!user || !passwordValid) {
      await auditLog({
        action: "auth.sign_in_failed",
        context: { ip, email: normalizedEmail },
        traceId,
      });
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
      await auditLog({
        userId: user.id,
        action: "auth.sign_in_blocked_unverified",
        entityType: "user",
        entityId: user.id,
        context: { ip, email: normalizedEmail },
        traceId,
      });
      throw new AppError(
        "Please verify your email before signing in.",
        "EMAIL_NOT_VERIFIED",
        403
      );
    }

    const userContext = await prisma.account.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!userContext) {
      throw new AuthError(
        "No active user context linked to this credential. Contact support."
      );
    }

    const token = await upsertSessionWithUser(userContext.id, requestMeta);
    await setSessionCookie(token);

    const session = await resolveSessionByToken(token, { requestMeta });
    if (!session) {
      throw new AuthError("Session creation failed");
    }

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      action: "auth.sign_in",
      entityType: "user",
      entityId: session.userId,
      context: { ip },
      traceId,
    });

    return NextResponse.json(
      ok(
        {
          user: {
            id: session.userId,
            email: session.email,
            name: session.name,
          },
          activeUser: {
            id: session.id,
            domain: session.domain,
            displayName: session.displayName,
            avatarUrl: session.avatarUrl,
            organizationId: session.organizationId,
            organizationName: session.organizationName,
          },
          users: session.availableUsers,
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
    console.error("[sign-in]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}

