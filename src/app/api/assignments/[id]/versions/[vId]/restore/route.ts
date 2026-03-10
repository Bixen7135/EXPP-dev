import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { restoreVersion } from "@/modules/assignments/service";
import { auditLog } from "@/lib/audit/logger";

type Params = { params: Promise<{ id: string; vId: string }> };

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id, vId } = await params;
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (session.role !== "TEACHER" && session.role !== "ADMIN")
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const assignment = await restoreVersion(id, vId, session.id);

    await auditLog({
      userId: session.id,
      action: "assignment.version.restored",
      entityType: "Assignment",
      entityId: id,
      context: { restoredVersionId: vId },
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
