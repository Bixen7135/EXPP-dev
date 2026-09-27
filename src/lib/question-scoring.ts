export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "SHORT_ANSWER"
  | "LONG_ANSWER";

type ScoreRange = {
  min: number;
  max: number;
  defaultScore: number;
};

const SCORE_RANGE_BY_TYPE: Record<QuestionType, ScoreRange> = {
  MULTIPLE_CHOICE: { min: 1, max: 1, defaultScore: 1 },
  SHORT_ANSWER: { min: 1, max: 2, defaultScore: 1 },
  LONG_ANSWER: { min: 2, max: 3, defaultScore: 2 },
};

const FALLBACK_RANGE: ScoreRange = { min: 1, max: 3, defaultScore: 1 };

export const QUESTION_SCORING_RULE_TEXT =
  "Scoring per question: MULTIPLE_CHOICE = 1 point; SHORT_ANSWER = 1-2 points; LONG_ANSWER = 2-3 points; never exceed 3 points per question.";

export function normalizeMaxScoreByQuestionType(
  type: string,
  rawMaxScore: number | null | undefined
): number {
  const range =
    SCORE_RANGE_BY_TYPE[type as QuestionType] ?? FALLBACK_RANGE;

  const numeric =
    typeof rawMaxScore === "number" &&
    Number.isFinite(rawMaxScore) &&
    rawMaxScore > 0
      ? rawMaxScore
      : range.defaultScore;

  const rounded = Math.round(numeric);
  return Math.min(Math.max(rounded, range.min), range.max);
}
