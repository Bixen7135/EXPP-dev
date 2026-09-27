import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gateway", () => ({
  aiGenerate: vi.fn(),
}));

import { aiGenerate } from "@/lib/ai/gateway";
import { generateSectionDraft } from "@/modules/generation/generator";
import type { GenerationConstraints } from "@/modules/generation/types";

const mockAiGenerate = aiGenerate as unknown as ReturnType<typeof vi.fn>;

const baseConstraints: GenerationConstraints = {
  topic: "Algebra",
  difficulty: "MEDIUM",
  format: "SINGLE_ASSIGNMENT",
  questionCount: 2,
};

describe("generateSectionDraft", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes array payload into section draft items", async () => {
    mockAiGenerate.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          order: 1,
          type: "SHORT_ANSWER",
          question: "What is x if x + 2 = 5?",
          expectedAnswer: "x = 3",
          maxScore: 1,
        },
      ]),
    });

    const result = await generateSectionDraft({
      section: { title: "Linear equations", items: ["Solve a one-step equation."] },
      sectionIndex: 0,
      constraints: baseConstraints,
      materialContext: "",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.question).toContain("x + 2 = 5");
    expect(mockAiGenerate).toHaveBeenCalledTimes(1);
  });

  it("retries after invalid structure and succeeds on the next attempt", async () => {
    mockAiGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify({ foo: "bar" }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          items: [
            {
              order: 1,
              type: "SHORT_ANSWER",
              question: "Define a variable in algebra.",
              expectedAnswer: "A symbol representing an unknown value.",
              maxScore: 1,
            },
          ],
        }),
      });

    const result = await generateSectionDraft({
      section: { title: "Basics", items: ["Define a variable."] },
      sectionIndex: 0,
      constraints: baseConstraints,
      materialContext: "",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.expectedAnswer).toContain("unknown value");
    expect(mockAiGenerate).toHaveBeenCalledTimes(2);
  });

  it("falls back to deterministic items when all attempts are invalid", async () => {
    mockAiGenerate.mockResolvedValue({
      text: JSON.stringify({ unexpected: true }),
    });

    const result = await generateSectionDraft({
      section: {
        title: "Fallback section",
        items: ["Explain factorization.", "Explain roots of a quadratic equation."],
      },
      sectionIndex: 1,
      constraints: baseConstraints,
      materialContext: "",
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.question).toContain("factorization");
    expect(result[1]?.question).toContain("roots of a quadratic equation");
    expect(mockAiGenerate).toHaveBeenCalledTimes(3);
  });
});
