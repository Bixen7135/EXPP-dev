import { prisma } from "@/lib/db/prisma";
import { aiGenerate } from "@/lib/ai/gateway";
import { auditLog } from "@/lib/audit/logger";
import { checkHelpPolicy, type PolicyContext } from "./policy-engine";
import { AI_HELP_SYSTEM_PROMPTS, type AiHelpMode } from "./mode-definitions";

export interface AiHelpRequest {
  attemptId: string;
  studentId: string;
  mode: AiHelpMode;
  question: string;
  assignmentContext: string;
  policyCtx: PolicyContext;
  traceId: string;
}

export interface AiHelpResponse {
  status: "ALLOWED" | "BLOCKED";
  response?: string;
  blockReason?: string;
  helpRequestId: string;
}

/**
 * Layer 3 (Gateway): Independently verifies policy BEFORE any LLM call.
 * Even if Layer 2 (route) is bypassed, this layer blocks disallowed requests.
 * All help requests (allowed and blocked) are persisted and audited.
 */
export async function requestAiHelp(opts: AiHelpRequest): Promise<AiHelpResponse> {
  // Layer 3: Independent policy check (defense in depth)
  const policy = checkHelpPolicy(opts.policyCtx);

  if (!policy.allowed) {
    // Persist blocked request
    const helpRequest = await prisma.helpRequest.create({
      data: {
        attemptId: opts.attemptId,
        studentId: opts.studentId,
        mode: opts.mode,
        requestContent: opts.question,
        status: "BLOCKED",
        blockReason: policy.blockReason,
        traceId: opts.traceId,
      },
    });

    await auditLog({
      userId: opts.studentId,
      action: "ai_help.blocked",
      entityType: "HelpRequest",
      entityId: helpRequest.id,
      context: { mode: opts.mode, blockReason: policy.blockReason, attemptId: opts.attemptId },
      traceId: opts.traceId,
    });

    return {
      status: "BLOCKED",
      blockReason: policy.blockReason,
      helpRequestId: helpRequest.id,
    };
  }

  // Get AI system prompt for the mode
  const systemPrompt = AI_HELP_SYSTEM_PROMPTS[opts.mode];
  if (!systemPrompt) {
    // Should not happen given policy checks, but guard defensively
    throw new Error(`No system prompt defined for mode: ${opts.mode}`);
  }

  const result = await aiGenerate({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Assignment context:\n${opts.assignmentContext}\n\nStudent question: ${opts.question}`,
      },
    ],
    maxTokens: 500,
    temperature: 0.3,
  });

  const helpRequest = await prisma.helpRequest.create({
    data: {
      attemptId: opts.attemptId,
      studentId: opts.studentId,
      mode: opts.mode,
      requestContent: opts.question,
      responseContent: result.text,
      status: "ALLOWED",
      traceId: opts.traceId,
    },
  });

  await auditLog({
    userId: opts.studentId,
    action: "ai_help.allowed",
    entityType: "HelpRequest",
    entityId: helpRequest.id,
    context: { mode: opts.mode, attemptId: opts.attemptId },
    traceId: opts.traceId,
  });

  return {
    status: "ALLOWED",
    response: result.text,
    helpRequestId: helpRequest.id,
  };
}
