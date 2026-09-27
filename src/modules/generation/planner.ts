import { aiGenerate } from "@/lib/ai/gateway";
import { resolveAiModel } from "@/lib/ai/models";
import { buildPlanningSystemPrompt, buildPlanningUserPrompt } from "./prompts";
import type {
  GenerationConstraints,
  GenerationPlanOutline,
  ParsedGenerationIntent,
} from "./types";
import { ValidationError } from "@/lib/errors";
import { parseAiJson } from "./ai-json";

export async function generatePlan(
  constraints: GenerationConstraints,
  materialContext: string,
  traceId?: string,
  parsedIntent?: ParsedGenerationIntent
): Promise<GenerationPlanOutline> {
  const result = await aiGenerate({
    modelId: resolveAiModel({ scopedEnvKey: "AI_MODEL_PLANNER" }),
    label: "generation.plan",
    traceId,
    messages: [
      { role: "system", content: buildPlanningSystemPrompt() },
      {
        role: "user",
        content: buildPlanningUserPrompt(constraints, materialContext, parsedIntent),
      },
    ],
    maxTokens: 1000,
    temperature: 0.5,
  });

  try {
    const outline = parseAiJson<GenerationPlanOutline>(result.text, "plan");
    if (
      !outline.title ||
      !Array.isArray(outline.sections) ||
      typeof outline.totalQuestions !== "number"
    ) {
      throw new ValidationError("AI returned invalid plan structure");
    }
    return outline;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Failed to parse AI-generated plan");
  }
}
