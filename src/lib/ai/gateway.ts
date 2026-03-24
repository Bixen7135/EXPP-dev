import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AiGenerateOptions, AiGenerateResult } from "./types";

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
  const modelId = process.env.AI_MODEL ?? "gpt-4o-mini";

  const { text } = await generateText({
    model: openai(modelId),
    messages: opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    maxOutputTokens: opts.maxTokens ?? 2000,
    temperature: opts.temperature ?? 0.7,
  });

  return { text };
}
