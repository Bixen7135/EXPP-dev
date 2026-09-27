import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { ok, fail, AppError, ForbiddenError, ValidationError } from "@/lib/errors";
import {
  createExternalSourceProfile,
  listExternalSourceProfiles,
} from "@/modules/generation/source-profiles";

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

    const profiles = await listExternalSourceProfiles(session.id);
    return NextResponse.json(ok(profiles, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }

    console.error("[generation/source-profiles GET]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      includeWhitelist?: unknown;
      urls?: unknown;
    };

    if (typeof body.name !== "string") {
      throw new ValidationError("name must be a string");
    }

    const includeWhitelist =
      typeof body.includeWhitelist === "boolean" ? body.includeWhitelist : true;
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((entry): entry is string => typeof entry === "string")
      : [];

    const profile = await createExternalSourceProfile({
      ownerAccountId: session.id,
      name: body.name,
      includeWhitelist,
      urls,
    });

    return NextResponse.json(ok(profile, traceId), { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }

    console.error("[generation/source-profiles POST]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
