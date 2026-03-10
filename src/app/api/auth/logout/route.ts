import { NextRequest, NextResponse } from "next/server";
import { getSessionToken, deleteSession, clearSessionCookie } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { ok } from "@/lib/errors";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  const token = await getSessionToken();
  const userId = request.headers.get("x-user-id") ?? undefined;

  if (token) {
    await deleteSession(token);
  }

  await clearSessionCookie();

  await auditLog({
    userId,
    action: "auth.logout",
    traceId,
  });

  return NextResponse.json(ok({ loggedOut: true }, traceId));
}
