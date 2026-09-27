import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { ok, fail } from "@/lib/errors";
import {
  getAssignment,
  updateAssignment,
  deleteAssignment,
} from "@/modules/assignments/service";
import { auditLog } from "@/lib/audit/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessTeacherWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const assignment = await getAssignment(id, session.id);
    return NextResponse.json(ok(assignment, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessTeacherWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const { content, changeDescription } = body ?? {};
    if (!content || typeof content !== "object")
      return NextResponse.json(fail("content is required", "VALIDATION_ERROR", traceId), { status: 422 });

    const assignment = await updateAssignment(id, session.id, content, changeDescription);

    await auditLog({
      userId: session.id,
      action: "assignment.updated",
      entityType: "Assignment",
      entityId: id,
      traceId,
    });

    return NextResponse.json(ok(assignment, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessTeacherWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    await deleteAssignment(id, session.id);

    await auditLog({
      userId: session.id,
      action: "assignment.deleted",
      entityType: "Assignment",
      entityId: id,
      traceId,
    });

    return NextResponse.json(ok({ deleted: true }, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
