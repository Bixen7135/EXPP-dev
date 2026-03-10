import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { listAssignments, createAssignment } from "@/modules/assignments/service";
import { auditLog } from "@/lib/audit/logger";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER" && session.role !== "ADMIN")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const list = await listAssignments(session.id);
  return NextResponse.json(ok(list, traceId));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER" && session.role !== "ADMIN")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const { generationResultId } = body ?? {};

    if (!generationResultId || typeof generationResultId !== "string")
      return NextResponse.json(fail("generationResultId is required", "VALIDATION_ERROR", traceId), { status: 422 });

    const assignment = await createAssignment({
      teacherId: session.id,
      generationResultId,
    });

    await auditLog({
      userId: session.id,
      action: "assignment.created",
      entityType: "Assignment",
      entityId: assignment.id,
      traceId,
    });

    return NextResponse.json(ok(assignment, traceId), { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN") {
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), {
        status: e.statusCode ?? 400,
      });
    }
    throw err;
  }
}
