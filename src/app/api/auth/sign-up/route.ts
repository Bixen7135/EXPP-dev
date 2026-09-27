import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { extractSessionRequestMetadata } from "@/lib/auth/session";
import {
  isEmailAutoVerificationEnabled,
  normalizeEmailAddress,
  rotateEmailVerificationToken,
  sendEmailVerificationMessage,
} from "@/lib/auth/email-verification";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AppError, ValidationError } from "@/lib/errors";
import { createGlobalUser } from "@/modules/users/service";

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  userDisplayName: z.string().min(1).max(120).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const requestMeta = extractSessionRequestMetadata(request.headers);
  const ip = requestMeta.ipAddress ?? "unknown";

  try {
    await checkRateLimit(ip);

    const body = await request.json();
    const parsed = SignUpSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { email, password, name, userDisplayName } = parsed.data;
    const normalizedEmail = normalizeEmailAddress(email);
    const autoVerifyEmails = isEmailAutoVerificationEnabled();

    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError("Email already in use", "EMAIL_TAKEN", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        emailVerifiedAt: autoVerifyEmails ? new Date() : null,
      },
    });

    try {
      const userContext = await createGlobalUser({
        userId: user.id,
        displayName: userDisplayName ?? name,
      });

      if (!autoVerifyEmails) {
        try {
          const rawToken = await rotateEmailVerificationToken(user.id);
          await sendEmailVerificationMessage({
            email: user.email,
            rawToken,
          });
        } catch {
          throw new AppError(
            "Failed to deliver verification email. Please try again.",
            "EMAIL_DELIVERY_FAILED",
            500
          );
        }
      }

      await auditLog({
        userId: user.id,
        actorAccountId: userContext.id,
        action: "auth.sign_up",
        entityType: "user",
        entityId: user.id,
        context: {
          ip,
          domain: userContext.domain,
          pendingVerification: !autoVerifyEmails,
        },
        traceId,
      });

      return NextResponse.json(
        ok(
          {
            pendingVerification: !autoVerifyEmails,
            email: user.email,
          },
          traceId
        ),
        { status: 201 }
      );
    } catch (innerError) {
      await prisma.user.delete({
        where: { id: user.id },
      });

      if (innerError instanceof AppError) {
        throw innerError;
      }
      throw innerError;
    }
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[sign-up]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}

