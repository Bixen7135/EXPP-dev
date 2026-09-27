import type { GenerationItemContent } from "./types";

type RubricCriterion = NonNullable<GenerationItemContent["rubricCriteria"]>[number];

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function buildDefaultCriteria(item: {
  type: GenerationItemContent["type"];
  maxScore: number;
  expectedAnswer: string;
}): RubricCriterion[] {
  if (item.type === "MULTIPLE_CHOICE") {
    return [
      {
        id: "criterion_correct_option",
        title: "Correct option",
        description: "Selects the correct answer option.",
        weight: item.maxScore,
        type: "EXPECTATION",
      },
    ];
  }

  if (item.type === "SHORT_ANSWER") {
    if (item.maxScore <= 1) {
      return [
        {
          id: "criterion_main",
          title: "Key concept",
          description:
            item.expectedAnswer || "Mentions the expected core concept accurately.",
          weight: 1,
          type: "EXPECTATION",
        },
      ];
    }

    return [
      {
        id: "criterion_core_concept",
        title: "Core concept",
        description: "States the main expected idea.",
        weight: 1,
        type: "EXPECTATION",
      },
      {
        id: "criterion_accuracy",
        title: "Accuracy and detail",
        description: "Uses correct terms or required detail.",
        weight: item.maxScore - 1,
        type: "EXPECTATION",
      },
    ];
  }

  if (item.maxScore <= 2) {
    return [
      {
        id: "criterion_coverage",
        title: "Coverage of key ideas",
        description: "Covers the most important expected points.",
        weight: 1,
        type: "EXPECTATION",
      },
      {
        id: "criterion_reasoning",
        title: "Reasoning quality",
        description: "Provides clear reasoning or explanation.",
        weight: item.maxScore - 1,
        type: "EXPECTATION",
      },
    ];
  }

  return [
    {
      id: "criterion_coverage",
      title: "Coverage of key ideas",
      description: "Covers the most important expected points.",
      weight: 1,
      type: "EXPECTATION",
    },
    {
      id: "criterion_reasoning",
      title: "Reasoning and examples",
      description: "Explains reasoning and supports it with examples.",
      weight: 1,
      type: "EXPECTATION",
    },
    {
      id: "criterion_structure",
      title: "Structure and clarity",
      description: "Presents ideas clearly and in a logical structure.",
      weight: item.maxScore - 2,
      type: "EXPECTATION",
    },
  ];
}

function sanitizeCriteria(
  criteria: GenerationItemContent["rubricCriteria"] | undefined
): RubricCriterion[] {
  if (!Array.isArray(criteria) || criteria.length === 0) return [];

  return criteria
    .map((criterion, idx) => ({
      id: criterion.id || `criterion_${idx + 1}`,
      title: criterion.title?.trim() || `Criterion ${idx + 1}`,
      description:
        criterion.description?.trim() ||
        "Demonstrates the expected understanding.",
      weight:
        Number.isFinite(criterion.weight) && criterion.weight > 0
          ? Number(criterion.weight)
          : 0,
      type:
        (criterion.type === "PENALTY" ? "PENALTY" : "EXPECTATION") as RubricCriterion["type"],
    }))
    .filter((criterion) => criterion.weight > 0);
}

function scaleCriteriaToMaxScore(
  criteria: RubricCriterion[],
  maxScore: number
): RubricCriterion[] {
  if (criteria.length === 0) return [];

  if (criteria.length === 1) {
    return [{ ...criteria[0], weight: maxScore }];
  }

  const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (total <= 0) return [];

  let distributed = 0;
  return criteria.map((criterion, idx) => {
    if (idx === criteria.length - 1) {
      return { ...criterion, weight: round2(Math.max(maxScore - distributed, 0)) };
    }

    const scaledWeight = round2((criterion.weight / total) * maxScore);
    distributed = round2(distributed + scaledWeight);
    return { ...criterion, weight: scaledWeight };
  });
}

export function normalizeMarkSchemeForItem(item: {
  type: GenerationItemContent["type"];
  maxScore: number;
  expectedAnswer: string;
  rubricCriteria?: GenerationItemContent["rubricCriteria"];
}): RubricCriterion[] {
  const sanitized = sanitizeCriteria(item.rubricCriteria);
  if (sanitized.length === 0) {
    return buildDefaultCriteria(item);
  }

  const scaled = scaleCriteriaToMaxScore(sanitized, item.maxScore);
  if (scaled.length === 0) {
    return buildDefaultCriteria(item);
  }

  return scaled;
}
