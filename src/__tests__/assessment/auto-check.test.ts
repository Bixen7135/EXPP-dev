import { describe, it, expect } from "vitest";
import { autoCheck } from "@/modules/assessment/auto-check";
import type { AssignmentItemContent } from "@/modules/assignments/types";
import type { AttemptAnswer } from "@/modules/completion/types";

const mcItem: AssignmentItemContent = {
  order: 1,
  type: "MULTIPLE_CHOICE",
  question: "What is 2+2?",
  options: ["3", "4", "5"],
  expectedAnswer: "4",
};

const shortItem: AssignmentItemContent = {
  order: 2,
  type: "SHORT_ANSWER",
  question: "What is the capital of France?",
  expectedAnswer: "Paris",
};

const longItem: AssignmentItemContent = {
  order: 3,
  type: "LONG_ANSWER",
  question: "Explain photosynthesis.",
  expectedAnswer: "Plants use sunlight...",
};

describe("autoCheck", () => {
  it("marks correct MC answer as score 1", () => {
    const result = autoCheck([mcItem], [{ itemOrder: 1, text: "4" }]);
    expect(result.items[0].autoScore).toBe(1);
    expect(result.autoScore).toBe(1);
    expect(result.autoMaxScore).toBe(1);
  });

  it("marks incorrect MC answer as score 0", () => {
    const result = autoCheck([mcItem], [{ itemOrder: 1, text: "3" }]);
    expect(result.items[0].autoScore).toBe(0);
    expect(result.autoScore).toBe(0);
  });

  it("is case-insensitive for MC", () => {
    const result = autoCheck([mcItem], [{ itemOrder: 1, text: "4" }]);
    expect(result.items[0].autoScore).toBe(1);
  });

  it("trims whitespace before comparing SHORT_ANSWER", () => {
    const result = autoCheck([shortItem], [{ itemOrder: 2, text: "  paris  " }]);
    expect(result.items[0].autoScore).toBe(1);
  });

  it("marks correct SHORT_ANSWER as score 1", () => {
    const result = autoCheck([shortItem], [{ itemOrder: 2, text: "Paris" }]);
    expect(result.items[0].autoScore).toBe(1);
  });

  it("marks incorrect SHORT_ANSWER as score 0", () => {
    const result = autoCheck([shortItem], [{ itemOrder: 2, text: "London" }]);
    expect(result.items[0].autoScore).toBe(0);
  });

  it("marks LONG_ANSWER as not auto-checkable with score 0", () => {
    const result = autoCheck([longItem], [{ itemOrder: 3, text: "Some essay..." }]);
    expect(result.items[0].isAutoCheckable).toBe(false);
    expect(result.items[0].autoScore).toBe(0);
    // LONG_ANSWER excluded from autoMaxScore
    expect(result.autoMaxScore).toBe(0);
    expect(result.autoScore).toBe(0);
  });

  it("handles missing answer as incorrect", () => {
    const result = autoCheck([shortItem], []);
    expect(result.items[0].autoScore).toBe(0);
  });

  it("aggregates scores across mixed items", () => {
    const items = [mcItem, shortItem, longItem];
    const answers: AttemptAnswer[] = [
      { itemOrder: 1, text: "4" },  // correct
      { itemOrder: 2, text: "Berlin" }, // incorrect
      { itemOrder: 3, text: "Essay" },  // not auto-checkable
    ];
    const result = autoCheck(items, answers);
    expect(result.autoScore).toBe(1);
    expect(result.autoMaxScore).toBe(2); // only 2 auto-checkable items
    expect(result.items).toHaveLength(3);
  });

  it("returns autoScore 0 and autoMaxScore 0 when all items are LONG_ANSWER", () => {
    const result = autoCheck([longItem], [{ itemOrder: 3, text: "x" }]);
    expect(result.autoScore).toBe(0);
    expect(result.autoMaxScore).toBe(0);
  });
});
