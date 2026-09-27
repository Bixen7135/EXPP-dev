import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  extractSessionRequestMetadata,
  getSessionToken,
  resolveSession,
} from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { AppError, AuthError, ValidationError, fail, ok } from "@/lib/errors";

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
});

function isPasswordStrong(password: string): boolean {
  return /[a-z]/.test(password) && /\d/.test(password);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const requestMeta = extractSessionRequestMetadata(request.headers);
  const ip = requestMeta.ipAddress ?? "unknown";

  try {
    const session = await resolveSession(requestMeta);
    if (!session) {
      throw new AuthError("Unauthorized");
    }

    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { oldPassword, newPassword, confirmPassword } = parsed.data;
    if (newPassword !== confirmPassword) {
      throw new ValidationError("New password and confirmation do not match");
    }
    if (!isPasswordStrong(newPassword)) {
      throw new ValidationError(
        "Password should be at least 8 characters including a number and a lowercase letter."
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });
    if (!user) {
      throw new AuthError("User not found");
    }

    const oldPasswordValid = await verifyPassword(oldPassword, user.passwordHash);
    if (!oldPasswordValid) {
      throw new AuthError("Old password is incorrect");
    }

    const isSameAsOldPassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSameAsOldPassword) {
      throw new ValidationError("New password must be different from old password");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    const currentToken = await getSessionToken();
    if (currentToken) {
      const accountRows = await prisma.account.findMany({
        where: { userId: session.userId },
        select: { id: true },
      });
      const accountIds = accountRows.map((row) => row.id);

      if (accountIds.length > 0) {
        await prisma.session.deleteMany({
          where: {
            signedInUserContextIds: { hasSome: accountIds },
            NOT: { token: currentToken },
          },
        });
      }
    }

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: "auth.password_changed",
      entityType: "user",
      entityId: session.userId,
      context: { ip },
      traceId,
    });

    return NextResponse.json(ok({ changed: true }, traceId));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(fail(error.message, error.code, traceId), {
        status: error.statusCode,
      });
    }

    console.error("[auth/password/change POST]", error);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}
