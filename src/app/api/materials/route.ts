import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { ok, fail, AppError, ForbiddenError, ValidationError } from "@/lib/errors";
import { uploadMaterial, listMaterials } from "@/modules/materials/service";

const TagSchema = z.object({ key: z.string().min(1).max(64), value: z.string().min(1).max(255) });
const MAX_MATERIAL_TITLE_LENGTH = 200;

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "").trim();
  const fallback = withoutExt.length > 0 ? withoutExt : filename.trim();
  return (fallback || "Untitled material").slice(0, MAX_MATERIAL_TITLE_LENGTH);
}

function resolveMaterialTitle(
  titleField: FormDataEntryValue | null,
  originalFilename: string
): string {
  if (typeof titleField !== "string") {
    return titleFromFilename(originalFilename);
  }

  const trimmed = titleField.trim();
  if (trimmed.length === 0) {
    return titleFromFilename(originalFilename);
  }
  if (trimmed.length > MAX_MATERIAL_TITLE_LENGTH) {
    throw new ValidationError(
      `Field 'title' must be at most ${MAX_MATERIAL_TITLE_LENGTH} characters`
    );
  }

  return trimmed;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
    }
    if (!canAccessTeacherWorkspace(session)) {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
    }

    const materials = await listMaterials(session.id);
    return NextResponse.json(ok(materials, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), { status: err.statusCode });
    }
    console.error("[materials GET]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
    }
    if (!canAccessTeacherWorkspace(session)) {
      throw new ForbiddenError();
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title");
    const folderIdRaw = formData.get("folderId");
    const tagsRaw = formData.get("tags");

    if (!file || !(file instanceof Blob)) {
      throw new ValidationError("Field 'file' is required");
    }

    let folderId: string | undefined;
    if (folderIdRaw != null) {
      if (typeof folderIdRaw !== "string") {
        throw new ValidationError("Field 'folderId' must be a string");
      }
      const trimmed = folderIdRaw.trim();
      if (trimmed.length > 0) {
        folderId = trimmed;
      }
    }

    let tags: { key: string; value: string }[] = [];
    if (tagsRaw && typeof tagsRaw === "string") {
      try {
        const parsed = JSON.parse(tagsRaw);
        const result = z.array(TagSchema).safeParse(parsed);
        if (!result.success) throw new ValidationError("Invalid tags format");
        tags = result.data;
      } catch (e) {
        if (e instanceof ValidationError) throw e;
        throw new ValidationError("tags must be a JSON array");
      }
    }

    const originalFilename =
      (file as File).name ?? "upload";
    const resolvedTitle = resolveMaterialTitle(title, originalFilename);
    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const material = await uploadMaterial({
      ownerAccountId: session.id,
      title: resolvedTitle,
      originalFilename,
      mimeType,
      buffer,
      folderId,
      tags,
    });

    await auditLog({
      userId: session.userId,
      actorAccountId: session.id,
      organizationId: session.organizationId ?? undefined,
      action: "material.upload",
      entityType: "material",
      entityId: material.id,
      context: { filename: originalFilename, mimeType, size: buffer.byteLength },
      traceId,
    });

    return NextResponse.json(ok(material, traceId), { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), { status: err.statusCode });
    }
    console.error("[materials POST]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), { status: 500 });
  }
}

