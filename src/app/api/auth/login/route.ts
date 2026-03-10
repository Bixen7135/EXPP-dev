import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AuthError, AppError, ValidationError } from "@/lib/errors";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  try {
    await checkRateLimit(ip);

    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordValid =
      user != null && (await verifyPassword(password, user.passwordHash));

    if (!user || !passwordValid) {
      await auditLog({
        action: "auth.login_failed",
        context: { ip, email },
        traceId,
      });
      throw new AuthError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new AuthError("Account is disabled");
    }

    const token = await createSession(user.id);
    await setSessionCookie(token);

    await auditLog({
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      context: { ip },
      traceId,
    });

    return NextResponse.json(
      ok({ id: user.id, email: user.email, name: user.name, role: user.role }, traceId)
    );
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[login]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}
