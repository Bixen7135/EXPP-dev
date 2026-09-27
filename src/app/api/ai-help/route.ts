import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { checkHelpPolicy } from "@/modules/ai-help/policy-engine";
import { requestAiHelp } from "@/modules/ai-help/ai-help-gateway";
import { auditLog } from "@/lib/audit/logger";
import type { AiHelpMode } from "@/modules/ai-help/mode-definitions";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = req.headers.get("x-trace-id") ?? "unknown";
  const session = await resolveSession();
  if (!session) return NextResponse.json(fail("Unauthorized", "AUTH_ERROR", traceId), { status: 401 });
  if (!canAccessStudentWorkspace(session))
    return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

  try {
    const body = await req.json();
    const { attemptId, question } = body ?? {};

    if (!attemptId || typeof attemptId !== "string")
      return NextResponse.json(fail("attemptId is required", "VALIDATION_ERROR", traceId), { status: 422 });
    if (!question || typeof question !== "string" || question.trim().length === 0)
      return NextResponse.json(fail("question is required", "VALIDATION_ERROR", traceId), { status: 422 });

    // Fetch attempt with distribution context for policy check
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        recipient: {
          include: {
            distribution: {
              include: {
                version: { select: { content: true } },
              },
            },
          },
        },
      },
    });

    if (!attempt) return NextResponse.json(fail("Attempt not found", "NOT_FOUND", traceId), { status: 404 });
    if (attempt.learnerAccountId !== session.id)
      return NextResponse.json(fail("Forbidden", "FORBIDDEN", traceId), { status: 403 });

    const dist = attempt.recipient.distribution;
    const mode = dist.aiHelpMode as AiHelpMode;
    const policyCtx = {
      mode,
      isMandatory: dist.status === "MANDATORY",
      isGraded: dist.isGraded,
      attemptStatus: attempt.status as "DRAFT" | "SUBMITTED",
    };

    // Layer 2: Server policy check (independent from Layer 3 gateway check)
    const layer2 = checkHelpPolicy(policyCtx);
    if (!layer2.allowed) {
      // Persist the blocked request and audit log
      const helpRequest = await prisma.helpRequest.create({
        data: {
          attemptId,
          learnerAccountId: session.id,
          mode,
          requestContent: question,
          status: "BLOCKED",
          blockReason: layer2.blockReason,
          traceId,
        },
      });
      await auditLog({
        actorAccountId: session.id,
        action: "ai_help.blocked",
        entityType: "HelpRequest",
        entityId: helpRequest.id,
        context: { mode, blockReason: layer2.blockReason, attemptId },
        traceId,
      });
      return NextResponse.json(
        fail(layer2.blockReason ?? "AI help is not available", "POLICY_BLOCKED", traceId),
        { status: 403 }
      );
    }

    // Build assignment context string for the AI prompt
    const versionContent = dist.version.content as { title: string; instructions: string };
    const assignmentContext = `Title: ${versionContent.title}\nInstructions: ${versionContent.instructions}`;

    // Layer 3: Gateway (independently re-checks policy before calling LLM)
    const result = await requestAiHelp({
      attemptId,
      learnerAccountId: session.id,
      mode,
      question: question.trim(),
      assignmentContext,
      policyCtx,
      traceId,
    });

    if (result.status === "BLOCKED") {
      return NextResponse.json(
        fail(result.blockReason ?? "AI help is not available", "POLICY_BLOCKED", traceId),
        { status: 403 }
      );
    }

    return NextResponse.json(
      ok({ response: result.response, helpRequestId: result.helpRequestId, mode }, traceId)
    );
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; statusCode?: number };
    if (e.code === "VALIDATION_ERROR" || e.code === "NOT_FOUND" || e.code === "FORBIDDEN")
      return NextResponse.json(fail(e.message ?? "Error", e.code, traceId), { status: e.statusCode ?? 400 });
    throw err;
  }
}

