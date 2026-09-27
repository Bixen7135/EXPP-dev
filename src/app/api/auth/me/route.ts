import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  const session = await resolveSession();
  if (!session) {
    return NextResponse.json(fail("Not authenticated", "UNAUTHENTICATED", traceId), {
      status: 401,
    });
  }

  return NextResponse.json(
    ok(
      {
        user: {
          id: session.userId,
          email: session.email,
          name: session.name,
          isActive: session.isActive,
        },
        activeUser: {
          id: session.id,
          domain: session.domain,
          displayName: session.displayName,
          avatarUrl: session.avatarUrl,
          organizationId: session.organizationId,
          organizationName: session.organizationName,
          permissions: session.permissions,
        },
        users: session.availableUsers,
      },
      traceId
    )
  );
}
