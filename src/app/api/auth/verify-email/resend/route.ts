import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeEmailAddress,
  rotateEmailVerificationToken,
  sendEmailVerificationMessage,
} from "@/lib/auth/email-verification";
import {
  checkRateLimit,
  checkVerificationResendRateLimit,
} from "@/lib/auth/rate-limit";
import { extractSessionRequestMetadata } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { AppError, ValidationError, fail, ok } from "@/lib/errors";

const ResendEmailVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const requestMeta = extractSessionRequestMetadata(request.headers);
  const ip = requestMeta.ipAddress ?? "unknown";

  try {
    await checkRateLimit(ip);

    const body = await request.json();
    const parsed = ResendEmailVerificationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const normalizedEmail = normalizeEmailAddress(parsed.data.email);
    await checkVerificationResendRateLimit({
      ip,
      email: normalizedEmail,
    });

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    if (user && !user.emailVerifiedAt) {
      try {
        const rawToken = await rotateEmailVerificationToken(user.id);
        await sendEmailVerificationMessage({
          email: user.email,
          rawToken,
        });
        await auditLog({
          userId: user.id,
          action: "auth.email_verification_resent",
          entityType: "user",
          entityId: user.id,
          context: { ip },
          traceId,
        });
      } catch (error) {
        console.error("[verify-email resend] failed to send verification email", {
          traceId,
          userId: user.id,
          error,
        });
      }
    }

    return NextResponse.json(
      ok(
        {
          sent: true,
        },
        traceId
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(fail(error.message, error.code, traceId), {
        status: error.statusCode,
      });
    }

    console.error("[verify-email resend POST]", error);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}
