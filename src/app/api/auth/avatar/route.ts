import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail, AppError, ValidationError } from "@/lib/errors";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

function extensionFromFile(file: File): string {
  const typeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  if (typeMap[file.type]) return typeMap[file.type];

  const name = file.name ?? "";
  const idx = name.lastIndexOf(".");
  if (idx > -1 && idx < name.length - 1) {
    return `.${name.slice(idx + 1).toLowerCase()}`;
  }

  return ".png";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();
  const session = await resolveSession();
  if (!session) {
    return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), {
      status: 401,
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("file is required");
    }
    if (!file.type.startsWith("image/")) {
      throw new ValidationError("Only image files are allowed");
    }
    if (file.size <= 0) {
      throw new ValidationError("Uploaded file is empty");
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new ValidationError("Image is too large (max 5MB)");
    }

    const uploadsDir = join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadsDir, { recursive: true });

    const extension = extensionFromFile(file);
    const filename = `${session.id}-${Date.now()}${extension}`;
    const fullPath = join(uploadsDir, filename);
    const publicUrl = `/uploads/avatars/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    await prisma.account.update({
      where: { id: session.id },
      data: { avatarUrl: publicUrl },
    });

    return NextResponse.json(ok({ avatarUrl: publicUrl }, traceId));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(fail(error.message, error.code, traceId), {
        status: error.statusCode,
      });
    }
    return NextResponse.json(fail("Internal server error", "SERVER_ERROR", traceId), {
      status: 500,
    });
  }
}

