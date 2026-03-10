import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  const user = await resolveSession();
  if (!user) {
    return NextResponse.json(fail("Not authenticated", "UNAUTHENTICATED", traceId), {
      status: 401,
    });
  }

  return NextResponse.json(
    ok({ id: user.id, email: user.email, name: user.name, role: user.role }, traceId)
  );
}
