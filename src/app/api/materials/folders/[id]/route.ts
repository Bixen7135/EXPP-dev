import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AppError } from "@/lib/errors";
import {
  deleteMaterialFolder,
  moveMaterialFolder,
  renameMaterialFolder,
} from "@/modules/materials/service";

type Params = { params: Promise<{ id: string }> };
const UpdateFolderBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    parentId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) =>
      Object.prototype.hasOwnProperty.call(data, "name") ||
      Object.prototype.hasOwnProperty.call(data, "parentId"),
    { message: "At least one field is required" }
  );

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
    if (session.role !== "TEACHER" && session.role !== "ADMIN") {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    await deleteMaterialFolder(id, session.id);

    await auditLog({
      userId: session.id,
      action: "material.folder.delete",
      entityType: "materialFolder",
      entityId: id,
      traceId,
    });

    return NextResponse.json(ok({ deleted: true }, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[materials/folders/:id DELETE]", err);
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
    if (session.role !== "TEACHER" && session.role !== "ADMIN") {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), {
        status: 403,
      });
    }

    const rawBody = await request.json();
    const parsed = UpdateFolderBody.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        fail("Invalid folder payload", "VALIDATION_ERROR", traceId),
        { status: 422 }
      );
    }

    const hasName = Object.prototype.hasOwnProperty.call(parsed.data, "name");
    const hasParentId = Object.prototype.hasOwnProperty.call(parsed.data, "parentId");

    let folder = hasParentId
      ? await moveMaterialFolder({
          folderId: id,
          teacherId: session.id,
          parentId: parsed.data.parentId ?? null,
        })
      : null;

    if (hasName && parsed.data.name) {
      folder = await renameMaterialFolder({
        folderId: id,
        teacherId: session.id,
        name: parsed.data.name,
      });
    }

    if (!folder) {
      return NextResponse.json(
        fail("Invalid folder payload", "VALIDATION_ERROR", traceId),
        { status: 422 }
      );
    }

    const action =
      hasName && hasParentId
        ? "material.folder.update"
        : hasParentId
          ? "material.folder.move"
          : "material.folder.rename";

    await auditLog({
      userId: session.id,
      action,
      entityType: "materialFolder",
      entityId: id,
      context: { name: folder.name, parentId: folder.parentId, path: folder.path },
      traceId,
    });

    return NextResponse.json(ok(folder, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[materials/folders/:id PATCH]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
