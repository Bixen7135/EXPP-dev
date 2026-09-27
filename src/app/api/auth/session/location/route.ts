import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  extractSessionRequestMetadata,
  resolveSession,
  updateCurrentSessionPreciseLocation,
} from "@/lib/auth/session";
import { AppError, AuthError, ValidationError, fail, ok } from "@/lib/errors";

const UpdateSessionLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const requestMeta = extractSessionRequestMetadata(request.headers);
    const session = await resolveSession(requestMeta);
    if (!session) {
      throw new AuthError("Unauthorized");
    }

    const body = await request.json();
    const parsed = UpdateSessionLocationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const updated = await updateCurrentSessionPreciseLocation(parsed.data);
    if (!updated) {
      throw new AppError("Session not found", "NOT_FOUND", 404);
    }

    return NextResponse.json(ok({ updated: true }, traceId));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(fail(error.message, error.code, traceId), {
        status: error.statusCode,
      });
    }

    console.error("[auth/session/location POST]", error);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}
