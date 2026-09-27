import { NextRequest, NextResponse } from "next/server";
import { verifyEmailByToken } from "@/lib/auth/email-verification";
import { auditLog } from "@/lib/audit/logger";

function redirectToSignIn(request: NextRequest, query: string): NextResponse {
  const target = new URL(`/sign-in${query}`, request.url);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const token = request.nextUrl.searchParams.get("token") ?? "";

  try {
    const result = await verifyEmailByToken(token);

    if (result.status === "VERIFIED") {
      if (result.userId) {
        await auditLog({
          userId: result.userId,
          action: "auth.email_verified",
          entityType: "user",
          entityId: result.userId,
          traceId,
        });
      }
      return redirectToSignIn(request, "?verified=1");
    }

    if (result.status === "ALREADY_VERIFIED") {
      return redirectToSignIn(request, "?verified=1");
    }

    if (result.status === "EXPIRED") {
      return redirectToSignIn(request, "?verify=expired");
    }

    return redirectToSignIn(request, "?verify=invalid");
  } catch (error) {
    console.error("[verify-email GET]", error);
    return redirectToSignIn(request, "?verify=error");
  }
}
