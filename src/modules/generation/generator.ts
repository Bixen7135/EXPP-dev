import { aiGenerate } from "@/lib/ai/gateway";
import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from "./prompts";
import type {
  GenerationConstraints,
  GenerationContent,
  GenerationPlanOutline,
} from "./types";
import { ValidationError } from "@/lib/errors";

export async function generateContent(
  outline: GenerationPlanOutline,
  constraints: GenerationConstraints,
  materialContext: string
): Promise<GenerationContent> {
  const result = await aiGenerate({
    messages: [
      { role: "system", content: buildGenerationSystemPrompt() },
      {
        role: "user",
        content: buildGenerationUserPrompt(outline, constraints, materialContext),
      },
    ],
    maxTokens: 3000,
    temperature: 0.7,
  });

  try {
    const content = JSON.parse(result.text) as GenerationContent;
    if (
      !content.title ||
      !content.instructions ||
      !Array.isArray(content.items)
    ) {
      throw new ValidationError("AI returned invalid content structure");
    }
    return content;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Failed to parse AI-generated content");
  }
}
