import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { ok, fail, AppError, ForbiddenError } from "@/lib/errors";
import {
  createMaterialFolder,
  listMaterialFolders,
} from "@/modules/materials/service";

const CreateFolderBody = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().min(1).optional().nullable(),
});

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
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    const folders = await listMaterialFolders(session.id);
    return NextResponse.json(ok(folders, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[materials/folders GET]", err);
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

    const rawBody = await request.json();
    const parsed = CreateFolderBody.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        fail("Invalid folder payload", "VALIDATION_ERROR", traceId),
        { status: 422 }
      );
    }

    const folder = await createMaterialFolder({
      ownerAccountId: session.id,
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
    });

    return NextResponse.json(ok(folder, traceId), { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[materials/folders POST]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
