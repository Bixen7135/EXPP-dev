import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { AppError, ForbiddenError, fail, ok } from "@/lib/errors";
import { duplicateAssignmentForBank } from "@/modules/assignments/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
        status: 401,
      });
    }
    if (!canAccessTeacherWorkspace(session)) {
      throw new ForbiddenError();
    }

    const duplicated = await duplicateAssignmentForBank(id, session.id);
    return NextResponse.json(ok(duplicated, traceId), { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[worksheet-bank/[id]/duplicate POST]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
