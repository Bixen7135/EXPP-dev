import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  clearSessionCookie,
  deleteUserSessions,
  extractSessionRequestMetadata,
  resolveSession,
} from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { AppError, AuthError, ForbiddenError, ValidationError, fail, ok } from "@/lib/errors";

const CONFIRM_PHRASE = "delete my account";

const DeleteAccountSchema = z.object({
  identifier: z.string().min(1).max(320),
  confirmation: z.string().min(1).max(120),
});

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const requestMeta = extractSessionRequestMetadata(request.headers);
    const session = await resolveSession(requestMeta);
    if (!session) {
      throw new AuthError("Unauthorized");
    }
    if (session.domain !== "GLOBAL") {
      throw new ForbiddenError();
    }

    const body = await request.json();
    const parsed = DeleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const identifier = parsed.data.identifier.trim().toLowerCase();
    const confirmation = parsed.data.confirmation.trim();

    const allowedIdentifiers = [session.displayName, session.email]
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is string => value.length > 0);

    if (!allowedIdentifiers.includes(identifier)) {
      throw new ValidationError("Identifier does not match your current account");
    }

    if (confirmation !== CONFIRM_PHRASE) {
      throw new ValidationError("Confirmation phrase mismatch");
    }

    await deleteUserSessions(session.userId);
    await prisma.user.delete({
      where: { id: session.userId },
    });
    await clearSessionCookie();

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: "auth.account_deleted",
      entityType: "user",
      entityId: session.userId,
      traceId,
    });

    return NextResponse.json(ok({ deleted: true }, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[auth/account DELETE]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}

