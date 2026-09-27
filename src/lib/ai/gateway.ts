import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AiGenerateOptions, AiGenerateResult } from "./types";
import { logAiRequest, logAiResponse } from "./logging";
import { resolveAiModel } from "./models";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return createOpenAI({ apiKey });
}

export async function aiGenerate(
  opts: AiGenerateOptions
): Promise<AiGenerateResult> {
  const openai = getOpenAIClient();
  const modelId = resolveAiModel({ explicitModelId: opts.modelId });
  const callId = crypto.randomUUID();

  await logAiRequest({
    callId,
    traceId: opts.traceId,
    label: opts.label,
    modelId,
    messages: opts.messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  });

  try {
    const { text } = await generateText({
      model: openai(modelId),
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      maxOutputTokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.7,
    });

    await logAiResponse({
      callId,
      traceId: opts.traceId,
      label: opts.label,
      modelId,
      text,
    });

    return { text };
  } catch (error) {
    await logAiResponse({
      callId,
      traceId: opts.traceId,
      label: opts.label,
      modelId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
