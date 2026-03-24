import { describe, expect, it } from "vitest";
import {
  buildQuestionNavItems,
  canSubmitWithSoftWarning,
  getAnsweredCount,
  getInitialQuestionOrder,
  getNextQuestionOrder,
  getPreviousQuestionOrder,
  getUnansweredQuestionOrders,
  isAnswerFilled,
} from "@/modules/completion/navigation";

describe("completion navigation helpers", () => {
  it("resolves initial question with query first, then storage, then first question", () => {
    const orders = [1, 2, 3, 4];

    expect(getInitialQuestionOrder(orders, "3", "2")).toBe(3);
    expect(getInitialQuestionOrder(orders, "99", "2")).toBe(2);
    expect(getInitialQuestionOrder(orders, "abc", "7")).toBe(1);
  });

  it("derives question navigator statuses", () => {
    const nav = buildQuestionNavItems([1, 2, 3], { 1: "Paris", 2: "   " }, 2, "QUESTION");
    expect(nav).toEqual([
      { order: 1, status: "answered" },
      { order: 2, status: "current" },
      { order: 3, status: "unanswered" },
    ]);
  });

  it("returns next and previous question orders with bounds", () => {
    const orders = [1, 2, 3];
    expect(getPreviousQuestionOrder(orders, 1)).toBeNull();
    expect(getPreviousQuestionOrder(orders, 3)).toBe(2);
    expect(getNextQuestionOrder(orders, 1)).toBe(2);
    expect(getNextQuestionOrder(orders, 3)).toBeNull();
  });

  it("counts answered and unanswered questions from trimmed answers", () => {
    const orders = [1, 2, 3];
    const answers = { 1: "A", 2: "   ", 3: "B" };

    expect(getAnsweredCount(orders, answers)).toBe(2);
    expect(getUnansweredQuestionOrders(orders, answers)).toEqual([2]);
  });

  it("applies soft-warning submit gate", () => {
    expect(canSubmitWithSoftWarning(0, false)).toBe(true);
    expect(canSubmitWithSoftWarning(2, false)).toBe(false);
    expect(canSubmitWithSoftWarning(2, true)).toBe(true);
  });

  it("treats undefined/blank answers as unfilled", () => {
    expect(isAnswerFilled(undefined)).toBe(false);
    expect(isAnswerFilled("")).toBe(false);
    expect(isAnswerFilled("   ")).toBe(false);
    expect(isAnswerFilled("ok")).toBe(true);
  });
});
