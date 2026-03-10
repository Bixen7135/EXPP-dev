import type { AssignmentItemContent } from "@/modules/assignments/types";
import type { AttemptAnswer } from "@/modules/completion/types";
import type { AutoCheckResult, ItemCheckResult } from "./types";

function getItemMaxScore(item: AssignmentItemContent): number {
  if (typeof item.maxScore === "number" && Number.isFinite(item.maxScore) && item.maxScore > 0) {
    return item.maxScore;
  }
  return 1;
}

/**
 * Deterministic auto-check:
 * - MULTIPLE_CHOICE: case-insensitive exact match against expectedAnswer
 * - SHORT_ANSWER: case-insensitive trimmed exact match against expectedAnswer
 * - LONG_ANSWER: not auto-checkable (score is always 0)
 */
export function autoCheck(
  items: AssignmentItemContent[],
  answers: AttemptAnswer[]
): AutoCheckResult {
  const answerMap = new Map(answers.map((a) => [a.itemOrder, a.text]));

  const itemResults: ItemCheckResult[] = items.map((item) => {
    const maxScore = getItemMaxScore(item);
    const isAutoCheckable =
      item.type === "MULTIPLE_CHOICE" || item.type === "SHORT_ANSWER";

    if (!isAutoCheckable) {
      return {
        itemOrder: item.order,
        autoScore: 0,
        maxScore,
        isAutoCheckable: false,
        isExactMatch: false,
      };
    }

    const studentAnswer = (answerMap.get(item.order) ?? "").trim().toLowerCase();
    const expected = (item.expectedAnswer ?? "").trim().toLowerCase();
    const isExactMatch = studentAnswer === expected && expected.length > 0;

    return {
      itemOrder: item.order,
      autoScore: isExactMatch ? maxScore : 0,
      maxScore,
      isAutoCheckable: true,
      isExactMatch,
    };
  });

  const checkableItems = itemResults.filter((r) => r.isAutoCheckable);
  const autoScore = checkableItems.reduce((sum, r) => sum + r.autoScore, 0);
  const autoMaxScore = checkableItems.reduce((sum, r) => sum + r.maxScore, 0);

  return { items: itemResults, autoScore, autoMaxScore };
}
