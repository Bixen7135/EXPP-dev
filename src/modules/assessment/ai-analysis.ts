import { z } from "zod";
import { aiGenerate } from "@/lib/ai/gateway";
import type { AssignmentItemContent, RubricCriterion } from "@/modules/assignments/types";
import type { AttemptAnswer } from "@/modules/completion/types";
import { ValidationError } from "@/lib/errors";
import type {
  AssessmentAiRecommendation,
  AssessmentAiItemRecommendation,
  AutoCheckResult,
  ConfidenceLevel,
} from "./types";

export const ASSESSMENT_AI_PROMPT_VERSION = "assessment-v1";

const itemSchema = z.object({
  itemOrder: z.number().int().positive(),
  recommendedScore: z.number().min(0),
  confidenceValue: z.number().min(0).max(1),
  riskFlags: z.array(z.string()).max(10).default([]),
  whatIsCorrect: z.array(z.string()).max(6).default([]),
  whatIsIncorrect: z.array(z.string()).max(6).default([]),
  whatIsMissing: z.array(z.string()).max(6).default([]),
  teacherFacingComment: z.string().min(1).max(600),
});

const recommendationSchema = z.object({
  gradeRationale: z.string().min(1).max(2000),
  reviewPriority: z.array(z.string()).max(10).default([]),
  items: z.array(itemSchema),
});

export interface AnalyzeAttemptInput {
  items: AssignmentItemContent[];
  answers: AttemptAnswer[];
  autoCheckResult: AutoCheckResult;
  modelId?: string;
}

interface NormalizedPromptItem {
  itemOrder: number;
  type: AssignmentItemContent["type"];
  question: string;
  expectedAnswer: string;
  maxScore: number;
  rubricCriteria: RubricCriterion[];
  studentAnswer: string;
  deterministicExactMatch: boolean;
}

export async function analyzeAttemptWithAi(
  input: AnalyzeAttemptInput
): Promise<AssessmentAiRecommendation> {
  const answerMap = new Map(input.answers.map((answer) => [answer.itemOrder, answer.text]));
  const promptItems = input.items.map((item) => {
    const check = input.autoCheckResult.items.find((result) => result.itemOrder === item.order);
    return {
      itemOrder: item.order,
      type: item.type,
      question: item.question,
      expectedAnswer: item.expectedAnswer,
      maxScore: getMaxScore(item),
      rubricCriteria: normalizeRubric(item),
      studentAnswer: answerMap.get(item.order) ?? "",
      deterministicExactMatch: Boolean(check?.isExactMatch),
    } satisfies NormalizedPromptItem;
  });

  const result = await aiGenerate({
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(promptItems) },
    ],
    maxTokens: 2400,
    temperature: 0.2,
  });

  let parsed: z.infer<typeof recommendationSchema>;
  try {
    const raw = JSON.parse(result.text);
    parsed = recommendationSchema.parse(raw);
  } catch {
    throw new ValidationError("Failed to parse AI assessment recommendation");
  }

  return normalizeRecommendation(parsed, promptItems);
}

function normalizeRecommendation(
  raw: z.infer<typeof recommendationSchema>,
  promptItems: NormalizedPromptItem[]
): AssessmentAiRecommendation {
  const normalizedItems: AssessmentAiItemRecommendation[] = promptItems.map((promptItem) => {
    const aiItem = raw.items.find((candidate) => candidate.itemOrder === promptItem.itemOrder);

    if (!aiItem) {
      return {
        itemOrder: promptItem.itemOrder,
        recommendedScore: 0,
        maxScore: promptItem.maxScore,
        confidence: "LOW",
        confidenceValue: 0.1,
        riskFlags: ["AI_RESPONSE_MISSING_ITEM"],
        whatIsCorrect: [],
        whatIsIncorrect: [],
        whatIsMissing: ["AI did not return a recommendation for this item."],
        teacherFacingComment: "AI did not provide an analysis for this item. Please review manually.",
      };
    }

    const clampedScore = clamp(aiItem.recommendedScore, 0, promptItem.maxScore);
    const riskFlags = [...aiItem.riskFlags];

    if (promptItem.deterministicExactMatch && clampedScore < promptItem.maxScore * 0.7) {
      riskFlags.push("OBJECTIVE_MISMATCH_WITH_DETERMINISTIC_CHECK");
    }

    return {
      itemOrder: promptItem.itemOrder,
      recommendedScore: Number(clampedScore.toFixed(2)),
      maxScore: promptItem.maxScore,
      confidence: confidenceLevel(aiItem.confidenceValue, riskFlags.length),
      confidenceValue: Number(aiItem.confidenceValue.toFixed(2)),
      riskFlags,
      whatIsCorrect: aiItem.whatIsCorrect,
      whatIsIncorrect: aiItem.whatIsIncorrect,
      whatIsMissing: aiItem.whatIsMissing,
      teacherFacingComment: aiItem.teacherFacingComment,
    };
  });

  const maxTotal = normalizedItems.reduce((sum, item) => sum + item.maxScore, 0);
  const recommendedTotal = normalizedItems.reduce((sum, item) => sum + item.recommendedScore, 0);
  const averageConfidenceValue =
    normalizedItems.length === 0
      ? 0
      : normalizedItems.reduce((sum, item) => sum + item.confidenceValue, 0) / normalizedItems.length;

  const warnings = normalizedItems
    .filter((item) => item.riskFlags.length > 0)
    .map((item) => `Q${item.itemOrder}: ${item.riskFlags.join(", ")}`);

  return {
    items: normalizedItems,
    recommendedTotal: Number(recommendedTotal.toFixed(2)),
    maxTotal: Number(maxTotal.toFixed(2)),
    confidence: confidenceLevel(averageConfidenceValue, warnings.length),
    confidenceValue: Number(averageConfidenceValue.toFixed(2)),
    warnings,
    gradeRationale: raw.gradeRationale,
    reviewPriority: raw.reviewPriority,
    promptVersion: ASSESSMENT_AI_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are an assessment assistant for teachers.",
    "Evaluate student answers by meaning against provided rubric criteria.",
    "Do not invent facts outside the answer, expected answer, and rubric.",
    "Return ONLY valid JSON.",
    "If confidence is low, still provide a score and include risk flags.",
    "JSON schema:",
    JSON.stringify({
      gradeRationale: "string",
      reviewPriority: ["string"],
      items: [
        {
          itemOrder: 1,
          recommendedScore: 0,
          confidenceValue: 0.5,
          riskFlags: ["string"],
          whatIsCorrect: ["string"],
          whatIsIncorrect: ["string"],
          whatIsMissing: ["string"],
          teacherFacingComment: "string",
        },
      ],
    }),
  ].join("\n");
}

function buildUserPrompt(items: NormalizedPromptItem[]): string {
  return [
    "Analyze each item. Scores must be between 0 and maxScore.",
    "Prefer rubric-weighted partial scoring.",
    JSON.stringify({ items }, null, 2),
  ].join("\n\n");
}

function getMaxScore(item: AssignmentItemContent): number {
  if (typeof item.maxScore === "number" && Number.isFinite(item.maxScore) && item.maxScore > 0) {
    return item.maxScore;
  }
  return 1;
}

function normalizeRubric(item: AssignmentItemContent): RubricCriterion[] {
  if (item.rubricCriteria && item.rubricCriteria.length > 0) {
    const maxScore = getMaxScore(item);
    const totalWeight = item.rubricCriteria.reduce((sum, criterion) => sum + Math.max(criterion.weight, 0), 0);
    if (totalWeight > 0) {
      const scale = maxScore / totalWeight;
      return item.rubricCriteria.map((criterion, index) => ({
        id: criterion.id || `criterion_${index + 1}`,
        title: criterion.title,
        description: criterion.description,
        weight: Number((Math.max(criterion.weight, 0) * scale).toFixed(2)),
        type: criterion.type === "PENALTY" ? "PENALTY" : "EXPECTATION",
      }));
    }
  }

  return [
    {
      id: "criterion_main",
      title: "Expected answer coverage",
      description: item.expectedAnswer || "Response demonstrates expected learning objective.",
      weight: getMaxScore(item),
      type: "EXPECTATION",
    },
  ];
}

function confidenceLevel(value: number, riskCount: number): ConfidenceLevel {
  const adjusted = value - Math.min(riskCount, 4) * 0.08;
  if (adjusted >= 0.75) return "HIGH";
  if (adjusted >= 0.45) return "MEDIUM";
  return "LOW";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
