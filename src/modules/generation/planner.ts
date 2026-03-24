import { aiGenerate } from "@/lib/ai/gateway";
import { buildPlanningSystemPrompt, buildPlanningUserPrompt } from "./prompts";
import type { GenerationConstraints, GenerationPlanOutline } from "./types";
import { ValidationError } from "@/lib/errors";

export async function generatePlan(
  constraints: GenerationConstraints,
  materialContext: string
): Promise<GenerationPlanOutline> {
  const result = await aiGenerate({
    messages: [
      { role: "system", content: buildPlanningSystemPrompt() },
      { role: "user", content: buildPlanningUserPrompt(constraints, materialContext) },
    ],
    maxTokens: 1000,
    temperature: 0.5,
  });

  try {
    const outline = JSON.parse(result.text) as GenerationPlanOutline;
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
