import { detectBloomLevelFromText } from "./intent-parser";
import { extractSignalKeywords } from "./text-utils";
import type {
  BloomTaxonomyLevel,
  DifficultyLevel,
  GenerationConstraints,
  GenerationContent,
  GenerationItemContent,
  GenerationItemQualityReport,
  GenerationQualityIssue,
  GenerationQualityIssueCode,
  GenerationQualityReport,
  ParsedGenerationIntent,
} from "./types";

const BLOOM_ORDER: BloomTaxonomyLevel[] = [
  "REMEMBER",
  "UNDERSTAND",
  "APPLY",
  "ANALYZE",
  "EVALUATE",
  "CREATE",
];

const QUALITY_REPAIR_MAX_REPLACEMENTS_RATIO = 0.6;

const BLOOM_TARGETS_BY_DIFFICULTY: Record<
  DifficultyLevel,
  { applyPlusMin: number; analyzePlusMin: number; evaluatePlusMin: number }
> = {
  EASY: { applyPlusMin: 0, analyzePlusMin: 0, evaluatePlusMin: 0 },
  MEDIUM: { applyPlusMin: 0.6, analyzePlusMin: 0.3, evaluatePlusMin: 0 },
  HARD: { applyPlusMin: 0.8, analyzePlusMin: 0.8, evaluatePlusMin: 0.3 },
};

const ITEM_TYPES: GenerationItemContent["type"][] = [
  "SHORT_ANSWER",
  "MULTIPLE_CHOICE",
  "LONG_ANSWER",
];

function bloomRank(level: BloomTaxonomyLevel): number {
  return BLOOM_ORDER.indexOf(level);
}

function bloomFloorByDifficulty(difficulty: DifficultyLevel): BloomTaxonomyLevel {
  if (difficulty === "HARD") return "ANALYZE";
  if (difficulty === "MEDIUM") return "APPLY";
  return "UNDERSTAND";
}

function bloomTargetByDifficulty(difficulty: DifficultyLevel): BloomTaxonomyLevel {
  if (difficulty === "HARD") return "EVALUATE";
  if (difficulty === "MEDIUM") return "ANALYZE";
  return "APPLY";
}

function normalizedTokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );
}

function tokenOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / Math.max(a.size, b.size);
}

function objectiveMatchScore(item: GenerationItemContent, objectiveKeywords: string[]): number {
  if (objectiveKeywords.length === 0) return 0;
  const itemTokens = normalizedTokenSet(`${item.question} ${item.expectedAnswer}`);
  const objectiveTokens = new Set(objectiveKeywords.map((token) => token.toLowerCase()));
  return tokenOverlapScore(itemTokens, objectiveTokens);
}

function detectItemBloomLevel(
  item: GenerationItemContent,
  difficulty: DifficultyLevel
): BloomTaxonomyLevel {
  const detected =
    detectBloomLevelFromText(item.question) ??
    detectBloomLevelFromText(item.expectedAnswer);
  return detected ?? bloomFloorByDifficulty(difficulty);
}

function normalizeQuestionForSimilarity(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeComplexityRatios(levels: BloomTaxonomyLevel[]): {
  applyPlus: number;
  analyzePlus: number;
  evaluatePlus: number;
} {
  if (levels.length === 0) {
    return { applyPlus: 0, analyzePlus: 0, evaluatePlus: 0 };
  }

  const applyPlus = levels.filter((level) => bloomRank(level) >= bloomRank("APPLY")).length / levels.length;
  const analyzePlus = levels.filter((level) => bloomRank(level) >= bloomRank("ANALYZE")).length / levels.length;
  const evaluatePlus = levels.filter((level) => bloomRank(level) >= bloomRank("EVALUATE")).length / levels.length;

  return { applyPlus, analyzePlus, evaluatePlus };
}

function issue(code: GenerationQualityIssueCode, message: string): GenerationQualityIssue {
  return { code, message };
}

function dedupeIssueCodes(codes: GenerationQualityIssueCode[]): GenerationQualityIssueCode[] {
  return [...new Set(codes)];
}

function pickAlternativeType(
  dominantType: GenerationItemContent["type"] | undefined,
  ordinal: number
): GenerationItemContent["type"] | undefined {
  if (!dominantType) return undefined;
  const options = ITEM_TYPES.filter((type) => type !== dominantType);
  if (options.length === 0) return undefined;
  return options[ordinal % options.length];
}

function leastCoveredObjectiveId(
  objectiveCoverage: Record<string, number>,
  intent: ParsedGenerationIntent
): string | undefined {
  const withCoverage = intent.objectives.map((objective) => ({
    id: objective.id,
    coverage: objectiveCoverage[objective.id] ?? 0,
  }));

  withCoverage.sort((a, b) => a.coverage - b.coverage);
  return withCoverage[0]?.id;
}

export interface QualityEvaluation {
  report: GenerationQualityReport;
  issueCodes: GenerationQualityIssueCode[];
  uncoveredObjectiveIds: string[];
  missingCount: number;
  dominantType?: GenerationItemContent["type"];
}

export interface QualityRepairTarget {
  kind: "REPLACE" | "APPEND";
  index?: number;
  objectiveId?: string;
  preferredBloomLevel: BloomTaxonomyLevel;
  preferredType?: GenerationItemContent["type"];
  reasonCodes: GenerationQualityIssueCode[];
}

export function evaluateGenerationQuality(opts: {
  content: GenerationContent;
  constraints: GenerationConstraints;
  intent: ParsedGenerationIntent;
  passCount?: number;
}): QualityEvaluation {
  const passCount = opts.passCount ?? 0;
  const items = opts.content.items;
  const expectedCount = opts.constraints.questionCount;
  const missingCount = Math.max(0, expectedCount - items.length);
  const itemReports: GenerationItemQualityReport[] = [];
  const issueCodes: GenerationQualityIssueCode[] = [];
  const objectiveCoverage: Record<string, number> = Object.fromEntries(
    opts.intent.objectives.map((objective) => [objective.id, 0])
  );

  const bloomLevels = items.map((item) =>
    detectItemBloomLevel(item, opts.constraints.difficulty)
  );
  const complexityRatios = computeComplexityRatios(bloomLevels);
  const floor = bloomFloorByDifficulty(opts.constraints.difficulty);
  const floorRank = bloomRank(floor);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const itemIssues: GenerationQualityIssue[] = [];
    const bloomLevel = bloomLevels[index];

    if (
      (opts.constraints.difficulty === "MEDIUM" || opts.constraints.difficulty === "HARD") &&
      bloomRank(bloomLevel) < floorRank
    ) {
      itemIssues.push(
        issue(
          "quality.low_complexity",
          `Question ${item.order} is below the ${opts.constraints.difficulty} cognitive floor (${floor}).`
        )
      );
    }

    const bestObjective = opts.intent.objectives
      .map((objective) => {
        const defaultKeywords =
          objective.keywords.length > 0
            ? objective.keywords
            : extractSignalKeywords(objective.statement, 8);

        return {
          objectiveId: objective.id,
          score: objectiveMatchScore(item, defaultKeywords),
        };
      })
      .sort((a, b) => b.score - a.score)[0];

    const bestScore = bestObjective?.score ?? 0;
    const bestObjectiveId = bestObjective?.objectiveId;
    if (bestObjectiveId && bestScore >= 0.06) {
      objectiveCoverage[bestObjectiveId] = (objectiveCoverage[bestObjectiveId] ?? 0) + 1;
    } else if (opts.intent.objectives.length > 0) {
      itemIssues.push(
        issue(
          "quality.objective_coverage_partial",
          `Question ${item.order} weakly maps to educational objectives.`
        )
      );
    }

    itemReports.push({
      order: item.order,
      bloomLevel,
      objectiveId: bestObjectiveId,
      issues: itemIssues,
    });
  }

  const normalizedQuestions = items.map((item) =>
    normalizeQuestionForSimilarity(item.question)
  );

  for (let i = 0; i < normalizedQuestions.length; i += 1) {
    for (let j = i + 1; j < normalizedQuestions.length; j += 1) {
      const a = normalizedTokenSet(normalizedQuestions[i]);
      const b = normalizedTokenSet(normalizedQuestions[j]);
      const similarity = tokenOverlapScore(a, b);

      if (similarity >= 0.82 || normalizedQuestions[i] === normalizedQuestions[j]) {
        itemReports[j].issues.push(
          issue(
            "quality.duplicate_item",
            `Question ${itemReports[j].order} is too similar to question ${itemReports[i].order}.`
          )
        );
      }
    }
  }

  const typeCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
  const uniqueTypes = Object.keys(typeCounts).length;
  const dominantTypeEntry = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  const dominantType = dominantTypeEntry?.[0] as GenerationItemContent["type"] | undefined;

  if (Math.max(expectedCount, items.length) >= 4 && uniqueTypes < 2) {
    issueCodes.push("quality.low_type_diversity");
    for (let index = 1; index < itemReports.length; index += 1) {
      itemReports[index].issues.push(
        issue(
          "quality.low_type_diversity",
          "Question types are too uniform; use at least two formats."
        )
      );
    }
  }

  const targets = BLOOM_TARGETS_BY_DIFFICULTY[opts.constraints.difficulty];
  if (
    complexityRatios.applyPlus < targets.applyPlusMin ||
    complexityRatios.analyzePlus < targets.analyzePlusMin ||
    complexityRatios.evaluatePlus < targets.evaluatePlusMin
  ) {
    issueCodes.push("quality.low_complexity");
  }

  const requiredObjectiveCoverageCount = Math.min(
    opts.intent.objectives.length,
    Math.max(1, Math.min(expectedCount, items.length || expectedCount))
  );
  const coveredObjectiveCount = Object.values(objectiveCoverage).filter(
    (count) => count > 0
  ).length;
  if (coveredObjectiveCount < requiredObjectiveCoverageCount) {
    issueCodes.push("quality.objective_coverage_partial");
  }

  if (missingCount > 0) {
    issueCodes.push("quality.missing_questions");
  }

  for (const report of itemReports) {
    for (const currentIssue of report.issues) {
      issueCodes.push(currentIssue.code);
    }
  }

  const dedupedIssueCodes = dedupeIssueCodes(issueCodes);
  const uncoveredObjectiveIds = opts.intent.objectives
    .filter((objective) => (objectiveCoverage[objective.id] ?? 0) === 0)
    .map((objective) => objective.id);

  const report: GenerationQualityReport = {
    passed: dedupedIssueCodes.length === 0,
    passCount,
    itemReports,
    summary: {
      issueCodes: dedupedIssueCodes,
      missingCount,
      objectiveCoverage,
      complexityRatios: {
        applyPlus: Number(complexityRatios.applyPlus.toFixed(3)),
        analyzePlus: Number(complexityRatios.analyzePlus.toFixed(3)),
        evaluatePlus: Number(complexityRatios.evaluatePlus.toFixed(3)),
      },
      typeDiversity: uniqueTypes,
    },
  };

  return {
    report,
    issueCodes: dedupedIssueCodes,
    uncoveredObjectiveIds,
    missingCount,
    dominantType,
  };
}

export function planQualityRepairs(opts: {
  evaluation: QualityEvaluation;
  content: GenerationContent;
  constraints: GenerationConstraints;
  intent: ParsedGenerationIntent;
}): QualityRepairTarget[] {
  const targets: QualityRepairTarget[] = [];
  const uncoveredQueue = [...opts.evaluation.uncoveredObjectiveIds];
  const targetBloom = bloomTargetByDifficulty(opts.constraints.difficulty);
  const lowDiversity =
    opts.evaluation.issueCodes.includes("quality.low_type_diversity");

  for (let i = 0; i < opts.evaluation.missingCount; i += 1) {
    const uncoveredObjectiveId = uncoveredQueue[i];
    const objectiveId =
      uncoveredObjectiveId ??
      leastCoveredObjectiveId(
        opts.evaluation.report.summary.objectiveCoverage,
        opts.intent
      );

    targets.push({
      kind: "APPEND",
      objectiveId,
      preferredBloomLevel: targetBloom,
      preferredType: lowDiversity
        ? pickAlternativeType(opts.evaluation.dominantType, i)
        : undefined,
      reasonCodes: dedupeIssueCodes([
        "quality.missing_questions",
        objectiveId ? "quality.objective_coverage_partial" : "quality.missing_questions",
      ]),
    });
  }

  const replacableEntries = opts.evaluation.report.itemReports
    .map((report, index) => ({ report, index }))
    .filter(({ report }) => report.issues.length > 0)
    .sort((a, b) => b.report.issues.length - a.report.issues.length);

  const maxReplacements = Math.max(
    1,
    Math.ceil(opts.constraints.questionCount * QUALITY_REPAIR_MAX_REPLACEMENTS_RATIO)
  );

  for (const entry of replacableEntries) {
    if (targets.filter((target) => target.kind === "REPLACE").length >= maxReplacements) {
      break;
    }

    const reasonCodes = dedupeIssueCodes(entry.report.issues.map((current) => current.code));
    const objectiveId =
      uncoveredQueue.shift() ??
      leastCoveredObjectiveId(
        opts.evaluation.report.summary.objectiveCoverage,
        opts.intent
      );

    targets.push({
      kind: "REPLACE",
      index: entry.index,
      objectiveId,
      preferredBloomLevel:
        reasonCodes.includes("quality.low_complexity")
          ? targetBloom
          : entry.report.bloomLevel,
      preferredType:
        reasonCodes.includes("quality.low_type_diversity") || lowDiversity
          ? pickAlternativeType(
              opts.evaluation.dominantType,
              targets.length
            )
          : undefined,
      reasonCodes,
    });
  }

  return targets;
}
