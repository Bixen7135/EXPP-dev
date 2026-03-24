import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { updateUserStatus } from "@/modules/admin/service";
import { canAccessAdminWorkspace } from "@/lib/auth/authorization";

// PATCH Ã¢â‚¬â€ admin updates active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessAdminWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  const { id } = await params;

  let body: { isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("Invalid JSON body", "VALIDATION_ERROR", traceId), { status: 422 });
  }

  const updates: { isActive?: boolean } = {};
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      fail("Provide isActive to update", "VALIDATION_ERROR", traceId),
      { status: 422 }
    );
  }

  try {
    const user = await updateUserStatus(id, session.userId, updates);
    return NextResponse.json(ok(user, traceId));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "NOT_FOUND" || e.code === "FORBIDDEN" || e.code === "VALIDATION_ERROR")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}
