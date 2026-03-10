export type WorkspaceViewMode = "QUESTION" | "REVIEW";

export type QuestionNavStatus = "current" | "answered" | "unanswered";

export interface QuestionNavItem {
  order: number;
  status: QuestionNavStatus;
}

export function normalizeQuestionOrders(questionOrders: number[]): number[] {
  return [...questionOrders].sort((a, b) => a - b);
}

export function isAnswerFilled(answer: string | null | undefined): boolean {
  return typeof answer === "string" && answer.trim().length > 0;
}

export function getAnsweredCount(questionOrders: number[], answers: Record<number, string>): number {
  return questionOrders.reduce((count, order) => {
    return count + (isAnswerFilled(answers[order]) ? 1 : 0);
  }, 0);
}

export function getUnansweredQuestionOrders(
  questionOrders: number[],
  answers: Record<number, string>
): number[] {
  return questionOrders.filter((order) => !isAnswerFilled(answers[order]));
}

export function buildQuestionNavItems(
  questionOrders: number[],
  answers: Record<number, string>,
  currentQuestionOrder: number | null,
  viewMode: WorkspaceViewMode
): QuestionNavItem[] {
  return questionOrders.map((order) => {
    if (viewMode === "QUESTION" && currentQuestionOrder === order) {
      return { order, status: "current" };
    }
    return {
      order,
      status: isAnswerFilled(answers[order]) ? "answered" : "unanswered",
    };
  });
}

function parseQuestionOrder(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

export function getInitialQuestionOrder(
  questionOrders: number[],
  queryValue: string | null,
  storedValue: string | null
): number {
  const sortedOrders = normalizeQuestionOrders(questionOrders);
  if (sortedOrders.length === 0) return 1;

  const queryOrder = parseQuestionOrder(queryValue);
  if (queryOrder !== null && sortedOrders.includes(queryOrder)) {
    return queryOrder;
  }

  const storedOrder = parseQuestionOrder(storedValue);
  if (storedOrder !== null && sortedOrders.includes(storedOrder)) {
    return storedOrder;
  }

  return sortedOrders[0];
}

export function getNextQuestionOrder(
  questionOrders: number[],
  currentQuestionOrder: number
): number | null {
  const index = questionOrders.indexOf(currentQuestionOrder);
  if (index === -1 || index >= questionOrders.length - 1) return null;
  return questionOrders[index + 1];
}

export function getPreviousQuestionOrder(
  questionOrders: number[],
  currentQuestionOrder: number
): number | null {
  const index = questionOrders.indexOf(currentQuestionOrder);
  if (index <= 0) return null;
  return questionOrders[index - 1];
}

export function canSubmitWithSoftWarning(
  unansweredCount: number,
  hasSubmitWarningConfirmation: boolean
): boolean {
  return unansweredCount === 0 || hasSubmitWarningConfirmation;
}
