import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { AppError, AuthError, ValidationError, fail, ok } from "@/lib/errors";
import { AppearancePayloadSchema } from "@/modules/appearance/schema";
import {
  getAppearanceSettingsForAccount,
  updateAppearanceSettingsForAccount,
} from "@/modules/appearance/service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      throw new AuthError("Unauthorized");
    }

    const settings = await getAppearanceSettingsForAccount(session.id);
    return NextResponse.json(ok(settings, traceId));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(fail(error.message, error.code, traceId), {
        status: error.statusCode,
      });
    }
    console.error("[auth/appearance GET]", error);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      throw new AuthError("Unauthorized");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const parsed = AppearancePayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid appearance payload");
    }

    const updated = await updateAppearanceSettingsForAccount(session.id, parsed.data);
    return NextResponse.json(ok(updated, traceId));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(fail(error.message, error.code, traceId), {
        status: error.statusCode,
      });
    }
    console.error("[auth/appearance PATCH]", error);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}
