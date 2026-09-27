import { NextRequest, NextResponse } from "next/server";
import {
  getSessionToken,
  deleteSession,
  clearSessionCookie,
  resolveSession,
} from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { ok } from "@/lib/errors";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const session = await resolveSession();

  const token = await getSessionToken();

  if (token) {
    await deleteSession(token);
  }

  await clearSessionCookie();

  await auditLog({
    userId: session?.userId,
    actorAccountId: session?.id,
    organizationId: session?.organizationId ?? undefined,
    action: "auth.logout",
    traceId,
  });

  return NextResponse.json(ok({ loggedOut: true }, traceId));
}

