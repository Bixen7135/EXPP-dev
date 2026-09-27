import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { AppError, ForbiddenError, ValidationError, fail, ok } from "@/lib/errors";
import { updateAssignmentTags } from "@/modules/assignments/service";

const TagSchema = z.object({
  key: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(255),
});

const PayloadSchema = z.object({
  tags: z.array(TagSchema),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
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

    const body = await request.json();
    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const updated = await updateAssignmentTags(id, session.id, parsed.data.tags);
    return NextResponse.json(ok(updated, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[worksheet-bank/[id]/tags PUT]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
