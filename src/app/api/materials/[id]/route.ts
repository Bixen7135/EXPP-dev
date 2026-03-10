import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit/logger";
import { ok, fail, AppError } from "@/lib/errors";
import {
  getMaterial,
  deleteMaterial,
  moveMaterialToFolder,
} from "@/modules/materials/service";

type Params = { params: Promise<{ id: string }> };

const UpdateMaterialBody = z.object({
  folderId: z.string().min(1).nullable(),
});

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
    }
    if (session.role !== "TEACHER" && session.role !== "ADMIN") {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
    }

    const material = await getMaterial(id, session.id);
    return NextResponse.json(ok(material, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), { status: err.statusCode });
    }
    console.error("[materials/:id GET]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
    }
    if (session.role !== "TEACHER" && session.role !== "ADMIN") {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
    }

    await deleteMaterial(id, session.id);

    await auditLog({
      userId: session.id,
      action: "material.delete",
      entityType: "material",
      entityId: id,
      traceId,
    });

    return NextResponse.json(ok({ deleted: true }, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), { status: err.statusCode });
    }
    console.error("[materials/:id DELETE]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const { id } = await params;

  try {
    const session = await resolveSession();
    if (!session) {
      return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
    }
    if (session.role !== "TEACHER" && session.role !== "ADMIN") {
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });
    }

    const rawBody = await request.json();
    const parsed = UpdateMaterialBody.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(fail("Invalid material payload", "VALIDATION_ERROR", traceId), {
        status: 422,
      });
    }

    const material = await moveMaterialToFolder({
      materialId: id,
      teacherId: session.id,
      folderId: parsed.data.folderId,
    });

    await auditLog({
      userId: session.id,
      action: "material.move",
      entityType: "material",
      entityId: id,
      context: { folderId: parsed.data.folderId },
      traceId,
    });

    return NextResponse.json(ok(material, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), { status: err.statusCode });
    }
    console.error("[materials/:id PATCH]", err);
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), { status: 500 });
  }
}
