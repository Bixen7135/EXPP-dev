import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/ai/gateway", () => ({
  aiGenerate: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { aiGenerate } from "@/lib/ai/gateway";
import { analyzeAttemptWithAi } from "@/modules/assessment/ai-analysis";
import { ValidationError } from "@/lib/errors";

const mockAiGenerate = aiGenerate as unknown as ReturnType<typeof vi.fn>;

describe("analyzeAttemptWithAi", () => {
  it("returns normalized recommendation with totals", async () => {
    mockAiGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        gradeRationale: "Mostly correct with one gap.",
        reviewPriority: ["Check terminology precision"],
        items: [
          {
            itemOrder: 1,
            recommendedScore: 1,
            confidenceValue: 0.9,
            riskFlags: [],
            whatIsCorrect: ["Correct option selected."],
            whatIsIncorrect: [],
            whatIsMissing: [],
            teacherFacingComment: "Correct answer.",
          },
          {
            itemOrder: 2,
            recommendedScore: 0.5,
            confidenceValue: 0.6,
            riskFlags: ["PARTIAL_COVERAGE"],
            whatIsCorrect: ["Mentions the key concept."],
            whatIsIncorrect: [],
            whatIsMissing: ["Missing one detail."],
            teacherFacingComment: "Partial understanding.",
          },
        ],
      }),
    });

    const result = await analyzeAttemptWithAi({
      items: [
        {
          order: 1,
          type: "MULTIPLE_CHOICE",
          question: "Q1",
          expectedAnswer: "A",
          options: ["A", "B"],
          maxScore: 1,
        },
        {
          order: 2,
          type: "SHORT_ANSWER",
          question: "Q2",
          expectedAnswer: "Paris",
          maxScore: 1,
        },
      ],
      answers: [
        { itemOrder: 1, text: "A" },
        { itemOrder: 2, text: "paris with extra text" },
      ],
      autoCheckResult: {
        items: [
          { itemOrder: 1, autoScore: 1, maxScore: 1, isAutoCheckable: true, isExactMatch: true },
          { itemOrder: 2, autoScore: 0, maxScore: 1, isAutoCheckable: true, isExactMatch: false },
        ],
        autoScore: 1,
        autoMaxScore: 2,
      },
    });

    expect(result.items).toHaveLength(2);
    expect(result.recommendedTotal).toBe(1.5);
    expect(result.maxTotal).toBe(2);
    expect(result.gradeRationale).toContain("Mostly correct");
  });

  it("throws ValidationError when model response is invalid JSON", async () => {
    mockAiGenerate.mockResolvedValueOnce({ text: "{invalid" });

    await expect(
      analyzeAttemptWithAi({
        items: [
          {
            order: 1,
            type: "LONG_ANSWER",
            question: "Explain.",
            expectedAnswer: "Expected",
          },
        ],
        answers: [{ itemOrder: 1, text: "Answer" }],
        autoCheckResult: {
          items: [{ itemOrder: 1, autoScore: 0, maxScore: 1, isAutoCheckable: false, isExactMatch: false }],
          autoScore: 0,
          autoMaxScore: 0,
        },
      })
    ).rejects.toThrow(ValidationError);
  });
});
