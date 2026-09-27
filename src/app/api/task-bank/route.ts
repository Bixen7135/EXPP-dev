import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { AppError, ForbiddenError, ValidationError, fail, ok } from "@/lib/errors";
import {
  createTaskBankItem,
  listTaskBankItems,
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

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: ContentSchema,
  tags: z.array(TagSchema).optional().default([]),
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
      throw new ForbiddenError();
    }

    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const tagKey = request.nextUrl.searchParams.get("tagKey") ?? undefined;
    const tagValue = request.nextUrl.searchParams.get("tagValue") ?? undefined;

    const list = await listTaskBankItems(session.id, { search, tagKey, tagValue });
    return NextResponse.json(ok(list, traceId));
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[task-bank GET]", err);
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

    const body = await request.json();
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const created = await createTaskBankItem({
      ownerAccountId: session.id,
      title: parsed.data.title,
      content: parsed.data.content,
      tags: parsed.data.tags,
    });

    return NextResponse.json(ok(created, traceId), { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(fail(err.message, err.code, traceId), {
        status: err.statusCode,
      });
    }
    console.error("[task-bank POST]", err);
    return NextResponse.json(
      fail("Internal server error", "SERVER_ERROR", traceId),
      { status: 500 }
    );
  }
}
