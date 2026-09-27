import { describe, expect, it } from "vitest";
import { normalizeMarkSchemeForItem } from "@/modules/generation/mark-scheme";

describe("normalizeMarkSchemeForItem", () => {
  it("creates default mark scheme for MULTIPLE_CHOICE", () => {
    const result = normalizeMarkSchemeForItem({
      type: "MULTIPLE_CHOICE",
      maxScore: 1,
      expectedAnswer: "B",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.weight).toBe(1);
    expect(result[0]?.title).toContain("Correct");
  });

  it("creates multi-criterion scheme for LONG_ANSWER", () => {
    const result = normalizeMarkSchemeForItem({
      type: "LONG_ANSWER",
      maxScore: 3,
      expectedAnswer: "Well structured explanation",
    });

    expect(result.length).toBeGreaterThanOrEqual(3);
    const total = result.reduce((sum, criterion) => sum + criterion.weight, 0);
    expect(total).toBe(3);
  });

  it("rescales existing rubric weights to max score", () => {
    const result = normalizeMarkSchemeForItem({
      type: "SHORT_ANSWER",
      maxScore: 2,
      expectedAnswer: "Paris",
      rubricCriteria: [
        {
          id: "c1",
          title: "Part 1",
          description: "First part",
          weight: 4,
          type: "EXPECTATION",
        },
        {
          id: "c2",
          title: "Part 2",
          description: "Second part",
          weight: 2,
          type: "EXPECTATION",
        },
      ],
    });

    const total = result.reduce((sum, criterion) => sum + criterion.weight, 0);
    expect(total).toBe(2);
    expect(result[0]?.weight).toBeGreaterThan(result[1]?.weight ?? 0);
  });
});
