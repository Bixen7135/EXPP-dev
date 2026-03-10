import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { getOrCreateAttempt } from "@/modules/completion/service";
import { listStudentAssignments } from "@/modules/distribution/service";
import { auditLog } from "@/lib/audit/logger";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "STUDENT")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const assignments = await listStudentAssignments(session.id);
  return NextResponse.json(ok(assignments, traceId));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "STUDENT")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const { recipientId } = body ?? {};
    if (!recipientId || typeof recipientId !== "string")
      return NextResponse.json(fail("recipientId is required", "VALIDATION_ERROR", traceId), { status: 422 });

    const attempt = await getOrCreateAttempt(recipientId, session.id);

    if (attempt.status === "DRAFT" && attempt.answers.length === 0) {
      await auditLog({
        userId: session.id,
        action: "attempt.started",
        entityType: "Attempt",
        entityId: attempt.id,
        context: { recipientId },
        traceId,
      });
    }

    return NextResponse.json(ok(attempt, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
