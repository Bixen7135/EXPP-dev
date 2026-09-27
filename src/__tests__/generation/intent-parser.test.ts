import { describe, expect, it } from "vitest";
import {
  buildRetrievalMaterialHints,
  buildRetrievalTopicQuery,
  parseGenerationIntent,
} from "@/modules/generation/intent-parser";

describe("generation intent parser", () => {
  it("parses educational goals with codes and bloom levels", () => {
    const parsed = parseGenerationIntent({
      topic: "Artificial intelligence",
      section: "12.1A",
      difficulty: "MEDIUM",
      format: "WORKSHEET",
      questionCount: 5,
      educationalGoals: `
        12.4.3.1 describe spheres where AI is applied in education and healthcare
        12.4.3.2 analyze risks and benefits of AI in society
      `,
      additionalInstructions: "Use real examples",
      knowledgeMode: "INTERNAL_ONLY",
    });

    expect(parsed.objectives.length).toBeGreaterThanOrEqual(2);

    const codes = parsed.objectives.map((objective) => objective.code);
    expect(codes).toContain("12.4.3.1");
    expect(codes).toContain("12.4.3.2");

    const analyzeObjective = parsed.objectives.find(
      (objective) => objective.code === "12.4.3.2"
    );
    expect(analyzeObjective?.bloomLevel).toBe("ANALYZE");
    expect(analyzeObjective?.keywords.length).toBeGreaterThan(0);
    expect(parsed.fallbackObjectiveUsed).toBe(false);
  });

  it("creates fallback objective when goals are absent", () => {
    const parsed = parseGenerationIntent({
      topic: "Quadratic equations",
      difficulty: "HARD",
      format: "SINGLE_ASSIGNMENT",
      questionCount: 3,
      knowledgeMode: "INTERNAL_ONLY",
    });

    expect(parsed.objectives).toHaveLength(1);
    expect(parsed.objectives[0]?.id).toBe("objective_topic_fallback");
    expect(parsed.objectives[0]?.bloomLevel).toBe("ANALYZE");
    expect(parsed.fallbackObjectiveUsed).toBe(true);
  });

  it("builds retrieval query and hints from parsed intent", () => {
    const constraints = {
      topic: "Cell biology",
      section: "Photosynthesis",
      difficulty: "MEDIUM" as const,
      format: "WORKSHEET" as const,
      questionCount: 4,
      educationalGoals:
        "Analyze chloroplast functions and explain ATP synthesis in photosynthesis",
      knowledgeMode: "INTERNAL_ONLY" as const,
    };

    const parsed = parseGenerationIntent(constraints);
    const query = buildRetrievalTopicQuery(constraints, parsed);
    const hints = buildRetrievalMaterialHints(parsed, ["chlorophyll"]);

    expect(query).toContain("Cell biology");
    expect(query).toContain("Photosynthesis");
    expect(hints).toContain("chlorophyll");
    expect(hints.length).toBeGreaterThan(1);
  });
});
