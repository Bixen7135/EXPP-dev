import { describe, expect, it } from "vitest";
import { normalizeContentForConstraints } from "@/modules/generation/generator";
import type { GenerationContent } from "@/modules/generation/types";

describe("generator normalization", () => {
  it("does not create synthetic variant questions when content is short", () => {
    const content: GenerationContent = {
      title: "Worksheet",
      instructions: "Answer all",
      items: [
        {
          order: 1,
          type: "LONG_ANSWER",
          question: "Analyze AI benefits and risks.",
          expectedAnswer: "Balanced analysis with examples.",
          maxScore: 5,
        },
      ],
    };

    const normalized = normalizeContentForConstraints(content, {
      topic: "AI",
      difficulty: "MEDIUM",
      format: "WORKSHEET",
      questionCount: 3,
      knowledgeMode: "INTERNAL_ONLY",
    });

    expect(normalized.items).toHaveLength(1);
    expect(normalized.items[0]?.question).not.toContain("(variant");
    expect(normalized.items[0]?.maxScore).toBe(3);
    expect(normalized.items[0]?.rubricCriteria?.length).toBeGreaterThan(0);
  });

  it("trims items to questionCount and preserves ordering", () => {
    const content: GenerationContent = {
      title: "Worksheet",
      instructions: "Answer all",
      items: [
        {
          order: 8,
          type: "SHORT_ANSWER",
          question: "Q1",
          expectedAnswer: "A1",
          maxScore: 1,
        },
        {
          order: 9,
          type: "SHORT_ANSWER",
          question: "Q2",
          expectedAnswer: "A2",
          maxScore: 1,
        },
        {
          order: 10,
          type: "SHORT_ANSWER",
          question: "Q3",
          expectedAnswer: "A3",
          maxScore: 1,
        },
      ],
    };

    const normalized = normalizeContentForConstraints(content, {
      topic: "AI",
      difficulty: "EASY",
      format: "SINGLE_ASSIGNMENT",
      questionCount: 2,
      knowledgeMode: "INTERNAL_ONLY",
    });

    expect(normalized.items).toHaveLength(2);
    expect(normalized.items[0]?.order).toBe(1);
    expect(normalized.items[1]?.order).toBe(2);
  });
});
