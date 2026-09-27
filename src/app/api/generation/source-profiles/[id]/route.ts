import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { ok, fail, AppError, ForbiddenError, ValidationError } from "@/lib/errors";
import {
  deleteExternalSourceProfile,
  getExternalSourceProfileOrThrow,
  updateExternalSourceProfile,
} from "@/modules/generation/source-profiles";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

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

    const profile = await getExternalSourceProfileOrThrow(id, session.id);
    return NextResponse.json(ok(profile, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }

    console.error("[generation/source-profiles/[id] GET]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

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

    const name = body.name === undefined ? undefined : String(body.name);
    const includeWhitelist =
      body.includeWhitelist === undefined
        ? undefined
        : Boolean(body.includeWhitelist);

    let urls: string[] | undefined;
    if (body.urls !== undefined) {
      if (!Array.isArray(body.urls)) {
        throw new ValidationError("urls must be an array of strings");
      }
      urls = body.urls.filter((entry): entry is string => typeof entry === "string");
    }

    const profile = await updateExternalSourceProfile({
      id,
      ownerAccountId: session.id,
      name,
      includeWhitelist,
      urls,
    });

    return NextResponse.json(ok(profile, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }

    console.error("[generation/source-profiles/[id] PATCH]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

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

    await deleteExternalSourceProfile(id, session.id);
    return NextResponse.json(ok({ id }, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }

    console.error("[generation/source-profiles/[id] DELETE]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
