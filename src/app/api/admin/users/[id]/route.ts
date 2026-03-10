import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { updateUserStatus } from "@/modules/admin/service";

// PATCH — admin updates user role or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const { id } = await params;

  let body: { isActive?: boolean; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("Invalid JSON body", "VALIDATION_ERROR", traceId), { status: 422 });
  }

  const updates: { isActive?: boolean; role?: "STUDENT" | "TEACHER" | "ADMIN" } = {};
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (body.role) {
    if (!["STUDENT", "TEACHER", "ADMIN"].includes(body.role)) {
      return NextResponse.json(
        fail("role must be STUDENT, TEACHER, or ADMIN", "VALIDATION_ERROR", traceId),
        { status: 422 }
      );
    }
    updates.role = body.role as "STUDENT" | "TEACHER" | "ADMIN";
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      fail("Provide isActive or role to update", "VALIDATION_ERROR", traceId),
      { status: 422 }
    );
  }

  try {
    const user = await updateUserStatus(id, session.id, updates);
    return NextResponse.json(ok(user, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN" || e.code === "VALIDATION_ERROR")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
