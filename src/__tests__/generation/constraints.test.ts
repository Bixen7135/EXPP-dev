import { describe, it, expect } from "vitest";
import { validateConstraints } from "@/modules/generation/constraints";
import { ValidationError } from "@/lib/errors";

describe("validateConstraints", () => {
  const valid = {
    topic: "Quadratic equations",
    difficulty: "MEDIUM",
    format: "SINGLE_ASSIGNMENT",
    questionCount: 5,
  };

  it("accepts a valid minimal constraint set", () => {
    expect(() => validateConstraints(valid)).not.toThrow();
    const result = validateConstraints(valid);
    expect(result.topic).toBe("Quadratic equations");
    expect(result.difficulty).toBe("MEDIUM");
    expect(result.questionCount).toBe(5);
  });

  it("accepts constraints with all optional fields", () => {
    expect(() =>
      validateConstraints({
        ...valid,
        section: "Chapter 3",
        educationalGoals: "Factor trinomials",
        additionalInstructions: "Include word problems",
      })
    ).not.toThrow();
  });

  it("throws ValidationError when topic is missing", () => {
    expect(() =>
      validateConstraints({ ...valid, topic: "" })
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when questionCount exceeds 20", () => {
    expect(() =>
      validateConstraints({ ...valid, questionCount: 21 })
    ).toThrow(ValidationError);
  });

  it("throws ValidationError when questionCount is less than 1", () => {
    expect(() =>
      validateConstraints({ ...valid, questionCount: 0 })
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid difficulty", () => {
    expect(() =>
      validateConstraints({ ...valid, difficulty: "EXTREME" })
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid format", () => {
    expect(() =>
      validateConstraints({ ...valid, format: "EXAM" })
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for non-integer questionCount", () => {
    expect(() =>
      validateConstraints({ ...valid, questionCount: 5.5 })
    ).toThrow(ValidationError);
  });
});
