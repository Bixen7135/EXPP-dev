import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AppError, ValidationError } from "@/lib/errors";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(["STUDENT", "TEACHER"]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  try {
    await checkRateLimit(ip);

    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { email, password, name, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Email already in use", "EMAIL_TAKEN", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
    });

    const token = await createSession(user.id);
    await setSessionCookie(token);

    await auditLog({
      userId: user.id,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
      context: { ip, role },
      traceId,
    });

    return NextResponse.json(
      ok({ id: user.id, email: user.email, name: user.name, role: user.role }, traceId),
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[register]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}
