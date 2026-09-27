import { z } from "zod";
import { aiGenerate } from "@/lib/ai/gateway";
import { resolveAiModel } from "@/lib/ai/models";
import {
  buildAssemblySystemPrompt,
  buildAssemblyUserPrompt,
  buildQualityRepairSystemPrompt,
  buildQualityRepairUserPrompt,
  buildSectionDraftSystemPrompt,
  buildSectionDraftUserPrompt,
  buildValidationSystemPrompt,
  buildValidationUserPrompt,
  generationOrchestrationConstants,
  type QualityRepairPromptTarget,
} from "./prompts";
import type {
  GenerationConstraints,
  GenerationContent,
  GenerationItemContent,
  GenerationPlanOutline,
  GenerationQualityReport,
  ParsedGenerationIntent,
} from "./types";
import { ValidationError } from "@/lib/errors";
import { normalizeMaxScoreByQuestionType } from "@/lib/question-scoring";
import { parseAiJson } from "./ai-json";
import { normalizeMarkSchemeForItem } from "./mark-scheme";
import {
  evaluateGenerationQuality,
  planQualityRepairs,
  type QualityRepairTarget,
} from "./quality";
import { parseGenerationIntent } from "./intent-parser";

const sectionDraftItemSchema = z.object({
  order: z.number().int().positive().optional(),
  type: z.enum(["SHORT_ANSWER", "MULTIPLE_CHOICE", "LONG_ANSWER"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  expectedAnswer: z.string().min(1),
  maxScore: z.number().positive().optional(),
  rubricCriteria: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        weight: z.number().positive(),
        type: z.enum(["EXPECTATION", "PENALTY"]).optional(),
      })
    )
    .optional(),
});

const sectionDraftSchema = z.object({
  items: z.array(sectionDraftItemSchema),
});

const generationContentSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  items: sectionDraftSchema.shape.items,
});

const validationBatchSchema = z.object({
  warnings: z.array(z.string()).default([]),
  normalizedItems: sectionDraftSchema.shape.items,
});

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const result: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      result[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return result;
}

function normalizeDraftItem(
  item: z.infer<typeof sectionDraftSchema>["items"][number]
): GenerationItemContent {
  const maxScore = normalizeMaxScoreByQuestionType(item.type, item.maxScore);
  return {
    order: item.order ?? 1,
    type: item.type,
    question: item.question,
    options: item.options,
    expectedAnswer: item.expectedAnswer,
    maxScore,
    rubricCriteria: normalizeMarkSchemeForItem({
      type: item.type,
      maxScore,
      expectedAnswer: item.expectedAnswer,
      rubricCriteria: item.rubricCriteria,
    }),
  };
}

function normalizeSectionDraftPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return { items: payload };
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const asRecord = payload as Record<string, unknown>;

  if (Array.isArray(asRecord.items)) {
    return { items: asRecord.items };
  }

  if (Array.isArray(asRecord.normalizedItems)) {
    return { items: asRecord.normalizedItems };
  }

  const singleItem = sectionDraftItemSchema.safeParse(asRecord);
  if (singleItem.success) {
    return { items: [singleItem.data] };
  }

  if (asRecord.items && typeof asRecord.items === "object" && !Array.isArray(asRecord.items)) {
    const nestedItem = sectionDraftItemSchema.safeParse(asRecord.items);
    if (nestedItem.success) {
      return { items: [nestedItem.data] };
    }
  }

  return payload;
}

function buildFallbackSectionDraft(opts: {
  section: GenerationPlanOutline["sections"][number];
  constraints: GenerationConstraints;
  requiredItemCount: number;
}): GenerationItemContent[] {
  const requiredItemCount = Math.max(1, opts.requiredItemCount);
  const topic = opts.constraints.topic.trim() || "the topic";
  const sectionIdeas = opts.section.items
    .map((idea) => idea.trim())
    .filter((idea) => idea.length > 0);
  const fallbackIdeas =
    sectionIdeas.length > 0
      ? sectionIdeas
      : [`Explain the most important concepts of ${topic}.`];

  return Array.from({ length: requiredItemCount }, (_, index) => {
    const idea = fallbackIdeas[Math.min(index, fallbackIdeas.length - 1)] ?? fallbackIdeas[0];
    const type: GenerationItemContent["type"] =
      requiredItemCount >= 4 && index === requiredItemCount - 1
        ? "LONG_ANSWER"
        : "SHORT_ANSWER";
    const maxScore = normalizeMaxScoreByQuestionType(type, undefined);
    const expectedAnswer = `A complete answer should address: ${idea}`;

    return {
      order: index + 1,
      type,
      question: idea,
      expectedAnswer,
      maxScore,
      rubricCriteria: normalizeMarkSchemeForItem({
        type,
        maxScore,
        expectedAnswer,
      }),
    };
  });
}

export function normalizeContentForConstraints(
  content: GenerationContent,
  constraints: GenerationConstraints
): GenerationContent {
  let items = [...content.items].map((item) => ({
    ...item,
    maxScore: normalizeMaxScoreByQuestionType(item.type, item.maxScore),
  })).map((item) => ({
    ...item,
    rubricCriteria: normalizeMarkSchemeForItem({
      type: item.type,
      maxScore: item.maxScore ?? 1,
      expectedAnswer: item.expectedAnswer,
      rubricCriteria: item.rubricCriteria,
    }),
  }));

  if (items.length > constraints.questionCount) {
    items = items.slice(0, constraints.questionCount);
  }

  items = items.map((item, idx) => ({
    ...item,
    order: idx + 1,
  }));

  return {
    ...content,
    items,
  };
}

export async function generateSectionDraft(opts: {
  section: GenerationPlanOutline["sections"][number];
  sectionIndex: number;
  constraints: GenerationConstraints;
  materialContext: string;
  parsedIntent?: ParsedGenerationIntent;
  traceId?: string;
}): Promise<GenerationItemContent[]> {
  const requiredItemCount = Math.max(1, opts.section.items.length);
  const maxAttempts = generationOrchestrationConstants.SECTION_DRAFT_MAX_ATTEMPTS;
  let lastValidationError: ValidationError | null = null;
  let lastRuntimeError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await aiGenerate({
        modelId: resolveAiModel({ scopedEnvKey: "AI_MODEL_GENERATOR" }),
        label:
          attempt === 1
            ? `generation.section_draft.${opts.sectionIndex + 1}`
            : `generation.section_draft.${opts.sectionIndex + 1}.retry_${attempt - 1}`,
        traceId: opts.traceId,
        messages: [
          { role: "system", content: buildSectionDraftSystemPrompt() },
          {
            role: "user",
            content: buildSectionDraftUserPrompt({
              section: opts.section,
              sectionIndex: opts.sectionIndex,
              constraints: opts.constraints,
              materialContext: opts.materialContext,
              parsedIntent: opts.parsedIntent,
              requiredItemCount,
              retryAttempt: attempt - 1,
            }),
          },
        ],
        maxTokens: generationOrchestrationConstants.SECTION_DRAFT_MAX_TOKENS,
        temperature: attempt === 1 ? 0.55 : 0.25,
      });

      const parsedJson = parseAiJson<unknown>(result.text, "section draft");
      const parsed = sectionDraftSchema.safeParse(
        normalizeSectionDraftPayload(parsedJson)
      );

      if (!parsed.success) {
        lastValidationError = new ValidationError(
          `AI returned invalid section draft: ${parsed.error.message}`
        );
        continue;
      }

      const normalizedItems = parsed.data.items.map(normalizeDraftItem);
      if (normalizedItems.length === 0) {
        lastValidationError = new ValidationError(
          "AI returned invalid section draft: section contains 0 items"
        );
        continue;
      }

      if (normalizedItems.length < requiredItemCount && attempt < maxAttempts) {
        lastValidationError = new ValidationError(
          `AI returned invalid section draft: expected at least ${requiredItemCount} items, received ${normalizedItems.length}`
        );
        continue;
      }

      return normalizedItems;
    } catch (error) {
      if (error instanceof ValidationError) {
        lastValidationError = error;
      } else {
        lastRuntimeError = error;
      }
    }
  }

  if (lastRuntimeError) {
    if (lastRuntimeError instanceof Error) throw lastRuntimeError;
    throw new Error(String(lastRuntimeError));
  }

  if (lastValidationError) {
    return buildFallbackSectionDraft({
      section: opts.section,
      constraints: opts.constraints,
      requiredItemCount,
    });
  }

  throw new ValidationError("AI returned invalid section draft");
}

export async function assembleGeneratedContent(opts: {
  outline: GenerationPlanOutline;
  constraints: GenerationConstraints;
  sectionDrafts: GenerationItemContent[][];
  materialContext: string;
  parsedIntent?: ParsedGenerationIntent;
  traceId?: string;
}): Promise<GenerationContent> {
  const result = await aiGenerate({
    modelId: resolveAiModel({ scopedEnvKey: "AI_MODEL_GENERATOR" }),
    label: "generation.assemble",
    traceId: opts.traceId,
    messages: [
      { role: "system", content: buildAssemblySystemPrompt() },
      {
        role: "user",
        content: buildAssemblyUserPrompt({
          outline: opts.outline,
          constraints: opts.constraints,
          sectionDrafts: opts.sectionDrafts,
          materialContext: opts.materialContext,
          parsedIntent: opts.parsedIntent,
        }),
      },
    ],
    maxTokens: 3200,
    temperature: 0.55,
  });

  const parsed = generationContentSchema.safeParse(
    parseAiJson<unknown>(result.text, "assembled content")
  );
  if (!parsed.success) {
    throw new ValidationError(`AI returned invalid content structure: ${parsed.error.message}`);
  }

  return normalizeContentForConstraints(parsed.data as GenerationContent, opts.constraints);
}

export async function generateContentFromOutline(opts: {
  outline: GenerationPlanOutline;
  constraints: GenerationConstraints;
  materialContext: string;
  parsedIntent?: ParsedGenerationIntent;
  traceId?: string;
  onSectionCompleted?: (completed: number, total: number) => Promise<void> | void;
}): Promise<GenerationContent> {
  let completedSections = 0;

  const sectionDrafts = await mapWithConcurrency(
    opts.outline.sections,
    generationOrchestrationConstants.SECTION_CONCURRENCY,
    async (section, sectionIndex) => {
      const draft = await generateSectionDraft({
        section,
        sectionIndex,
        constraints: opts.constraints,
        materialContext: opts.materialContext,
        parsedIntent: opts.parsedIntent,
        traceId: opts.traceId,
      });

      if (opts.onSectionCompleted) {
        completedSections += 1;
        await opts.onSectionCompleted(completedSections, opts.outline.sections.length);
      }

      return draft;
    }
  );

  return assembleGeneratedContent({
    outline: opts.outline,
    constraints: opts.constraints,
    sectionDrafts,
    materialContext: opts.materialContext,
    parsedIntent: opts.parsedIntent,
    traceId: opts.traceId,
  });
}

export async function validateContentBatched(opts: {
  content: GenerationContent;
  constraints: GenerationConstraints;
  parsedIntent?: ParsedGenerationIntent;
  traceId?: string;
  onBatchCompleted?: (completed: number, total: number) => Promise<void> | void;
}): Promise<{ content: GenerationContent; warnings: string[] }> {
  const batchSize = generationOrchestrationConstants.VALIDATION_BATCH_SIZE;
  const batches: GenerationItemContent[][] = [];

  for (let i = 0; i < opts.content.items.length; i += batchSize) {
    batches.push(opts.content.items.slice(i, i + batchSize));
  }

  const warnings: string[] = [];
  const normalizedItems: GenerationItemContent[] = [];

  for (let index = 0; index < batches.length; index += 1) {
    const batchItems = batches[index];

    try {
      const result = await aiGenerate({
        modelId: resolveAiModel({ scopedEnvKey: "AI_MODEL_PLANNER" }),
        label: `generation.validate_batch.${index + 1}`,
        traceId: opts.traceId,
        messages: [
          { role: "system", content: buildValidationSystemPrompt() },
          {
            role: "user",
            content: buildValidationUserPrompt({
              constraints: opts.constraints,
              batchItems,
              parsedIntent: opts.parsedIntent,
            }),
          },
        ],
        maxTokens: 1600,
        temperature: 0.2,
      });

      const parsed = validationBatchSchema.safeParse(
        parseAiJson<unknown>(result.text, `validation batch ${index + 1}`)
      );
      if (!parsed.success) {
        warnings.push(`validation.batch_${index + 1}.parse_failed`);
        normalizedItems.push(...batchItems);
      } else {
        warnings.push(...parsed.data.warnings);
        normalizedItems.push(...parsed.data.normalizedItems.map(normalizeDraftItem));
      }
    } catch {
      warnings.push(`validation.batch_${index + 1}.failed`);
      normalizedItems.push(...batchItems);
    }

    if (opts.onBatchCompleted) {
      await opts.onBatchCompleted(index + 1, batches.length);
    }
  }

  const normalized = normalizeContentForConstraints(
    {
      ...opts.content,
      items: normalizedItems,
    },
    opts.constraints
  );

  return {
    content: normalized,
    warnings,
  };
}

function toPromptRepairTarget(target: QualityRepairTarget): QualityRepairPromptTarget {
  return {
    kind: target.kind,
    index: target.index,
    objectiveId: target.objectiveId,
    preferredBloomLevel: target.preferredBloomLevel,
    preferredType: target.preferredType,
    reasonCodes: target.reasonCodes,
  };
}

async function regenerateQualityTargets(opts: {
  constraints: GenerationConstraints;
  intent: ParsedGenerationIntent;
  content: GenerationContent;
  targets: QualityRepairTarget[];
  materialContext: string;
  traceId?: string;
  passNumber: number;
}): Promise<GenerationItemContent[]> {
  const result = await aiGenerate({
    modelId: resolveAiModel({ scopedEnvKey: "AI_MODEL_GENERATOR" }),
    label: `generation.quality_repair.pass_${opts.passNumber}`,
    traceId: opts.traceId,
    messages: [
      { role: "system", content: buildQualityRepairSystemPrompt() },
      {
        role: "user",
        content: buildQualityRepairUserPrompt({
          constraints: opts.constraints,
          parsedIntent: opts.intent,
          currentItems: opts.content.items,
          targets: opts.targets.map(toPromptRepairTarget),
          materialContext: opts.materialContext,
        }),
      },
    ],
    maxTokens: 2200,
    temperature: 0.45,
  });

  const parsed = sectionDraftSchema.safeParse(
    parseAiJson<unknown>(result.text, `quality repair pass ${opts.passNumber}`)
  );

  if (!parsed.success) {
    throw new ValidationError(
      `AI returned invalid quality repair draft: ${parsed.error.message}`
    );
  }

  const items = parsed.data.items.map(normalizeDraftItem);
  if (items.length < opts.targets.length) {
    throw new ValidationError(
      `AI returned ${items.length} repaired items, expected at least ${opts.targets.length}`
    );
  }

  return items.slice(0, opts.targets.length);
}

function applyQualityRepairs(opts: {
  content: GenerationContent;
  constraints: GenerationConstraints;
  targets: QualityRepairTarget[];
  repairedItems: GenerationItemContent[];
}): GenerationContent {
  const nextItems = [...opts.content.items];
  let cursor = 0;

  for (const target of opts.targets) {
    const candidate = opts.repairedItems[cursor];
    cursor += 1;
    if (!candidate) continue;

    if (
      target.kind === "REPLACE" &&
      typeof target.index === "number" &&
      target.index >= 0 &&
      target.index < nextItems.length
    ) {
      nextItems[target.index] = candidate;
      continue;
    }

    nextItems.push(candidate);
  }

  return normalizeContentForConstraints(
    {
      ...opts.content,
      items: nextItems,
    },
    opts.constraints
  );
}

function buildQualityWarnings(opts: {
  report: GenerationQualityReport;
  reachedRetryLimit: boolean;
  repairFailures: number;
}): string[] {
  const warnings = [...opts.report.summary.issueCodes];

  if (!opts.report.passed && opts.reachedRetryLimit) {
    warnings.push("quality.best_effort_after_retries");
  }

  if (opts.repairFailures > 0) {
    warnings.push("quality.repair_failed");
  }

  return [...new Set(warnings)];
}

export async function enforceContentQuality(opts: {
  content: GenerationContent;
  constraints: GenerationConstraints;
  intent?: ParsedGenerationIntent;
  materialContext: string;
  traceId?: string;
  maxPasses?: number;
}): Promise<{
  content: GenerationContent;
  warnings: string[];
  qualityReport: GenerationQualityReport;
}> {
  const maxPasses = Math.max(0, opts.maxPasses ?? 2);
  const intent = opts.intent ?? parseGenerationIntent(opts.constraints);

  let passCount = 0;
  let repairFailures = 0;
  let content = normalizeContentForConstraints(opts.content, opts.constraints);
  let evaluation = evaluateGenerationQuality({
    content,
    constraints: opts.constraints,
    intent,
    passCount,
  });

  while (!evaluation.report.passed && passCount < maxPasses) {
    const repairTargets = planQualityRepairs({
      evaluation,
      content,
      constraints: opts.constraints,
      intent,
    });

    if (repairTargets.length === 0) {
      break;
    }

    try {
      const repairedItems = await regenerateQualityTargets({
        constraints: opts.constraints,
        intent,
        content,
        targets: repairTargets,
        materialContext: opts.materialContext,
        traceId: opts.traceId,
        passNumber: passCount + 1,
      });

      content = applyQualityRepairs({
        content,
        constraints: opts.constraints,
        targets: repairTargets,
        repairedItems,
      });

      passCount += 1;
      evaluation = evaluateGenerationQuality({
        content,
        constraints: opts.constraints,
        intent,
        passCount,
      });
    } catch {
      repairFailures += 1;
      break;
    }
  }

  const qualityReport: GenerationQualityReport = {
    ...evaluation.report,
    passCount,
  };

  return {
    content,
    warnings: buildQualityWarnings({
      report: qualityReport,
      reachedRetryLimit: !qualityReport.passed && passCount >= maxPasses,
      repairFailures,
    }),
    qualityReport,
  };
}

export async function generateContent(
  outline: GenerationPlanOutline,
  constraints: GenerationConstraints,
  materialContext: string,
  parsedIntent?: ParsedGenerationIntent
): Promise<GenerationContent> {
  return generateContentFromOutline({
    outline,
    constraints,
    materialContext,
    parsedIntent,
  });
}
