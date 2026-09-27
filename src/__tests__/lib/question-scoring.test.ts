import { describe, expect, it } from "vitest";
import { normalizeMaxScoreByQuestionType } from "@/lib/question-scoring";

describe("normalizeMaxScoreByQuestionType", () => {
  it("forces MULTIPLE_CHOICE to exactly 1 point", () => {
    expect(normalizeMaxScoreByQuestionType("MULTIPLE_CHOICE", 5)).toBe(1);
    expect(normalizeMaxScoreByQuestionType("MULTIPLE_CHOICE", 0.5)).toBe(1);
    expect(normalizeMaxScoreByQuestionType("MULTIPLE_CHOICE", undefined)).toBe(1);
  });

  it("keeps SHORT_ANSWER in range 1-2", () => {
    expect(normalizeMaxScoreByQuestionType("SHORT_ANSWER", undefined)).toBe(1);
    expect(normalizeMaxScoreByQuestionType("SHORT_ANSWER", 1.6)).toBe(2);
    expect(normalizeMaxScoreByQuestionType("SHORT_ANSWER", 10)).toBe(2);
    expect(normalizeMaxScoreByQuestionType("SHORT_ANSWER", 0)).toBe(1);
  });

  it("keeps LONG_ANSWER in range 2-3", () => {
    expect(normalizeMaxScoreByQuestionType("LONG_ANSWER", undefined)).toBe(2);
    expect(normalizeMaxScoreByQuestionType("LONG_ANSWER", 1)).toBe(2);
    expect(normalizeMaxScoreByQuestionType("LONG_ANSWER", 4)).toBe(3);
  });

  it("uses fallback policy for unknown types", () => {
    expect(normalizeMaxScoreByQuestionType("MATCHING", undefined)).toBe(1);
    expect(normalizeMaxScoreByQuestionType("MATCHING", 7)).toBe(3);
  });
});
