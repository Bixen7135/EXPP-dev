import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { AppError, ForbiddenError, fail, ok } from "@/lib/errors";
import { listWorksheetBank } from "@/modules/assignments/service";

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const tagKey = request.nextUrl.searchParams.get("tagKey") ?? undefined;
    const tagValue = request.nextUrl.searchParams.get("tagValue") ?? undefined;

    const list = await listWorksheetBank(session.id, { search, tagKey, tagValue });
    return NextResponse.json(ok(list, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[worksheet-bank GET]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
