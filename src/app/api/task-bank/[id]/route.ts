import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { AppError, ForbiddenError, ValidationError, fail, ok } from "@/lib/errors";
import {
  deleteTaskBankItem,
  getTaskBankItem,
  updateTaskBankItem,
} from "@/modules/task-bank/service";

const TagSchema = z.object({
  key: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(255),
});

const ContentSchema = z.object({
  type: z.enum(["SHORT_ANSWER", "MULTIPLE_CHOICE", "LONG_ANSWER"]),
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).optional(),
  expectedAnswer: z.string().trim().min(1),
  maxScore: z.number().positive().optional(),
  rubricCriteria: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        weight: z.number().positive().optional(),
        type: z.enum(["EXPECTATION", "PENALTY"]).optional(),
      })
    )
    .optional(),
});

const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: ContentSchema.optional(),
    tags: z.array(TagSchema).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.content !== undefined ||
      value.tags !== undefined,
    {
      message: "At least one of title, content, or tags must be provided",
    }
  );

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
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

    const item = await getTaskBankItem(id, session.id);
    return NextResponse.json(ok(item, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[task-bank/[id] GET]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
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
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const updated = await updateTaskBankItem(id, session.id, parsed.data);
    return NextResponse.json(ok(updated, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[task-bank/[id] PATCH]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
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

    await deleteTaskBankItem(id, session.id);
    return NextResponse.json(ok({ deleted: true }, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[task-bank/[id] DELETE]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
