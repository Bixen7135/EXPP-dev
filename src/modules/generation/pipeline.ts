import { prisma } from "@/lib/db/prisma";
import { retrieveInternalContext, type InternalRetrievedChunk } from "./context-retrieval";
import { generatePlan } from "./planner";
import {
  enforceContentQuality,
  generateContentFromOutline,
  validateContentBatched,
} from "./generator";
import {
  fetchExternalKnowledge,
  type ExternalSourceDocument,
} from "./external-sources";
import { extractLinksFromAdditionalInstructions } from "./link-extraction";
import { extractSignalKeywords } from "./text-utils";
import {
  buildRetrievalMaterialHints,
  buildRetrievalTopicQuery,
  parseGenerationIntent,
} from "./intent-parser";
import type {
  GenerationConstraints,
  GenerationContent,
  GenerationIntentSnapshot,
  GenerationItemContent,
  GenerationRunMetadata,
  GenerationStatus,
  ParsedGenerationIntent,
} from "./types";

const STAGE_WEIGHTS: Record<"PLANNING" | "RETRIEVING" | "GENERATING" | "VALIDATING", number> = {
  PLANNING: 20,
  RETRIEVING: 25,
  GENERATING: 40,
  VALIDATING: 15,
};

const STAGE_BASE_PROGRESS: Record<"PLANNING" | "RETRIEVING" | "GENERATING" | "VALIDATING", number> = {
  PLANNING: 0,
  RETRIEVING: 20,
  GENERATING: 45,
  VALIDATING: 85,
};

const LOW_SIGNAL_DOC_THRESHOLD = 0.08;
const NOISE_KEYWORDS = [
  "privacy",
  "cookie",
  "subscribe",
  "advertising",
  "sign in",
  "all rights reserved",
  "terms of service",
  "navigation",
  "copyright",
  "youtube",
];

class StaleRunTokenError extends Error {
  constructor() {
    super("Stale generation run token");
  }
}

class CancellationRequestedError extends Error {
  constructor() {
    super("Generation cancelled by user");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultMetadata(): GenerationRunMetadata {
  const ts = nowIso();
  return {
    currentStage: "QUEUED",
    progressPercent: 0,
    stageProgress: [
      {
        stage: "QUEUED",
        startedAt: ts,
        finishedAt: ts,
        detail: "Request accepted and queued",
      },
    ],
    warnings: [],
    batchCounters: {},
  };
}

function normalizeMetadata(raw: unknown): GenerationRunMetadata {
  if (!raw || typeof raw !== "object") {
    return defaultMetadata();
  }

  const data = raw as Partial<GenerationRunMetadata>;

  return {
    currentStage: data.currentStage,
    progressPercent: data.progressPercent,
    stageProgress: Array.isArray(data.stageProgress) ? data.stageProgress : [],
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((value): value is string => typeof value === "string") : [],
    batchCounters:
      data.batchCounters && typeof data.batchCounters === "object"
        ? data.batchCounters
        : {},
    linkExtraction:
      data.linkExtraction && typeof data.linkExtraction === "object"
        ? data.linkExtraction
        : undefined,
    parsedIntent:
      data.parsedIntent && typeof data.parsedIntent === "object"
        ? (data.parsedIntent as GenerationIntentSnapshot)
        : undefined,
    qualityReport:
      data.qualityReport && typeof data.qualityReport === "object"
        ? data.qualityReport
        : undefined,
    partial: Boolean(data.partial),
  };
}

function toIntentSnapshot(intent: ParsedGenerationIntent): GenerationIntentSnapshot {
  return {
    fallbackObjectiveUsed: intent.fallbackObjectiveUsed,
    sectionTerms: intent.sectionTerms,
    topicTerms: intent.topicTerms,
    objectives: intent.objectives.map((objective) => ({
      id: objective.id,
      code: objective.code,
      bloomLevel: objective.bloomLevel,
      keywords: objective.keywords,
    })),
  };
}

async function readRequestState(requestId: string): Promise<{
  runToken: number;
  cancelRequestedAt: Date | null;
  status: GenerationStatus;
} | null> {
  const row = await prisma.generationRequest.findUnique({
    where: { id: requestId },
    select: {
      runToken: true,
      cancelRequestedAt: true,
      status: true,
    },
  });

  if (!row) return null;

  return {
    runToken: row.runToken,
    cancelRequestedAt: row.cancelRequestedAt,
    status: row.status as GenerationStatus,
  };
}

async function assertRunIsActive(requestId: string, runToken: number): Promise<void> {
  const state = await readRequestState(requestId);
  if (!state) throw new StaleRunTokenError();
  if (state.runToken !== runToken) throw new StaleRunTokenError();
  if (state.cancelRequestedAt) throw new CancellationRequestedError();
}

async function updateRequestStatus(
  requestId: string,
  runToken: number,
  status: GenerationStatus
): Promise<void> {
  const updated = await prisma.generationRequest.updateMany({
    where: {
      id: requestId,
      runToken,
    },
    data: {
      status,
    },
  });

  if (updated.count === 0) {
    throw new StaleRunTokenError();
  }
}

async function mutateMetadata(
  requestId: string,
  runToken: number,
  mutator: (current: GenerationRunMetadata) => GenerationRunMetadata
): Promise<GenerationRunMetadata> {
  const row = await prisma.generationRequest.findUnique({
    where: { id: requestId },
    select: {
      runToken: true,
      metadata: true,
    },
  });

  if (!row || row.runToken !== runToken) {
    throw new StaleRunTokenError();
  }

  const nextMetadata = mutator(normalizeMetadata(row.metadata));

  const updated = await prisma.generationRequest.updateMany({
    where: {
      id: requestId,
      runToken,
    },
    data: {
      metadata: nextMetadata as object,
    },
  });

  if (updated.count === 0) {
    throw new StaleRunTokenError();
  }

  return nextMetadata;
}

async function startStage(opts: {
  requestId: string;
  runToken: number;
  stage: "PLANNING" | "RETRIEVING" | "GENERATING" | "VALIDATING";
  detail: string;
}): Promise<void> {
  const stage = opts.stage;
  await updateRequestStatus(opts.requestId, opts.runToken, stage);

  await mutateMetadata(opts.requestId, opts.runToken, (meta) => {
    const startedAt = nowIso();
    return {
      ...meta,
      currentStage: stage,
      progressPercent: Math.max(meta.progressPercent ?? 0, STAGE_BASE_PROGRESS[stage]),
      stageProgress: [
        ...meta.stageProgress,
        {
          stage,
          startedAt,
          detail: opts.detail,
        },
      ],
    };
  });
}

async function finishStage(opts: {
  requestId: string;
  runToken: number;
  stage: "PLANNING" | "RETRIEVING" | "GENERATING" | "VALIDATING";
  detail?: string;
}): Promise<void> {
  await mutateMetadata(opts.requestId, opts.runToken, (meta) => {
    const finishedAt = nowIso();
    const stageProgress = [...meta.stageProgress];

    for (let i = stageProgress.length - 1; i >= 0; i -= 1) {
      if (stageProgress[i].stage === opts.stage && !stageProgress[i].finishedAt) {
        stageProgress[i] = {
          ...stageProgress[i],
          finishedAt,
          detail: opts.detail ?? stageProgress[i].detail,
        };
        break;
      }
    }

    return {
      ...meta,
      progressPercent: Math.max(
        meta.progressPercent ?? 0,
        STAGE_BASE_PROGRESS[opts.stage] + STAGE_WEIGHTS[opts.stage]
      ),
      stageProgress,
    };
  });
}

async function updateBatchProgress(opts: {
  requestId: string;
  runToken: number;
  stage: "GENERATING" | "VALIDATING";
  batchKey: string;
  completed: number;
  total: number;
}): Promise<void> {
  await mutateMetadata(opts.requestId, opts.runToken, (meta) => {
    const nextCounters = {
      ...(meta.batchCounters ?? {}),
      [opts.batchKey]: {
        completed: opts.completed,
        total: opts.total,
      },
    };

    const stageProgressRatio = opts.total > 0 ? opts.completed / opts.total : 0;
    const stagePercent = STAGE_BASE_PROGRESS[opts.stage] + STAGE_WEIGHTS[opts.stage] * stageProgressRatio;

    return {
      ...meta,
      batchCounters: nextCounters,
      progressPercent: Math.max(meta.progressPercent ?? 0, Math.floor(stagePercent)),
    };
  });
}

async function appendWarnings(
  requestId: string,
  runToken: number,
  warnings: string[]
): Promise<void> {
  if (warnings.length === 0) return;

  await mutateMetadata(requestId, runToken, (meta) => ({
    ...meta,
    warnings: [...meta.warnings, ...warnings],
  }));
}

function buildModelContext(opts: {
  internalChunks: InternalRetrievedChunk[];
  externalDocs: ExternalSourceDocument[];
}): string {
  const parts: string[] = [];

  for (const chunk of opts.internalChunks) {
    parts.push(`=== Internal: ${chunk.materialTitle} [${chunk.chunkId}] ===\n${chunk.text}`);
  }

  for (const doc of opts.externalDocs) {
    parts.push(`=== External: ${doc.title} (${doc.url}) ===\n${doc.text.slice(0, 1800)}`);
  }

  return parts.join("\n\n").slice(0, 40_000);
}

function scoreTextOverlap(queryKeywords: string[], candidate: string): number {
  if (queryKeywords.length === 0 || !candidate) return 0;
  const candidateKeywords = new Set(extractSignalKeywords(candidate, 32));
  const overlap = queryKeywords.filter((kw) => candidateKeywords.has(kw)).length;
  return overlap / queryKeywords.length;
}

function noiseScore(input: string): number {
  if (!input.trim()) return 1;
  const lower = input.toLowerCase();
  const hits = NOISE_KEYWORDS.filter((word) => lower.includes(word)).length;
  return hits / NOISE_KEYWORDS.length;
}

function filterExternalDocsBySignal(opts: {
  documents: ExternalSourceDocument[];
  constraints: GenerationConstraints;
  intent: ParsedGenerationIntent;
}): { documents: ExternalSourceDocument[]; warnings: string[] } {
  if (opts.documents.length === 0) {
    return { documents: [], warnings: [] };
  }

  const queryKeywords = [
    ...extractSignalKeywords(
      [opts.constraints.topic, opts.constraints.section ?? ""].join(" "),
      12
    ),
    ...opts.intent.topicTerms,
    ...opts.intent.sectionTerms,
    ...opts.intent.objectives.flatMap((objective) => objective.keywords),
  ];
  const dedupedQueryKeywords = [...new Set(queryKeywords)].slice(0, 36);

  const scored = opts.documents.map((doc) => {
    const overlap = scoreTextOverlap(
      dedupedQueryKeywords,
      `${doc.title} ${doc.text.slice(0, 2400)}`
    );
    const docNoise = noiseScore(`${doc.title} ${doc.excerpt} ${doc.text.slice(0, 1200)}`);
    return { doc, overlap, noise: docNoise };
  });

  const kept = scored.filter(
    (entry) =>
      entry.overlap >= LOW_SIGNAL_DOC_THRESHOLD &&
      !(entry.noise > 0.2 && entry.overlap < LOW_SIGNAL_DOC_THRESHOLD * 1.5)
  );

  const fallbackDoc = [...scored].sort((a, b) => b.overlap - a.overlap)[0];
  const finalDocs =
    kept.length > 0
      ? kept.map((entry) => entry.doc)
      : fallbackDoc
        ? [fallbackDoc.doc]
        : [];

  const filteredUrls = scored
    .filter((entry) => !finalDocs.some((doc) => doc.url === entry.doc.url))
    .map((entry) => `context.low_signal_external_filtered:${entry.doc.url}`);

  return {
    documents: finalDocs,
    warnings: [...new Set(filteredUrls)],
  };
}

function attachSourcesToItems(opts: {
  items: GenerationItemContent[];
  internalChunks: InternalRetrievedChunk[];
  externalDocs: ExternalSourceDocument[];
}): GenerationItemContent[] {
  return opts.items.map((item) => {
    const queryText = `${item.question} ${item.expectedAnswer}`;
    const queryKeywords = extractSignalKeywords(queryText, 18);

    const internalCandidates = opts.internalChunks
      .map((chunk) => ({
        source: {
          type: "INTERNAL" as const,
          ref: `material:${chunk.materialId}:chunk:${chunk.chunkId}`,
          title: chunk.materialTitle,
          excerpt: chunk.text.slice(0, 280),
        },
        score: scoreTextOverlap(queryKeywords, `${chunk.text} ${chunk.keywords.join(" ")}`),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((candidate) => candidate.source);

    const externalCandidates = opts.externalDocs
      .map((doc) => ({
        source: {
          type: "EXTERNAL" as const,
          ref: doc.url,
          title: doc.title,
          excerpt: doc.excerpt,
        },
        score: scoreTextOverlap(queryKeywords, `${doc.title} ${doc.text.slice(0, 1800)}`),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)
      .map((candidate) => candidate.source);

    return {
      ...item,
      sources: [...internalCandidates, ...externalCandidates],
    };
  });
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
}

async function markCancelled(
  requestId: string,
  runToken: number,
  detail: string
): Promise<void> {
  await prisma.generationRequest
    .updateMany({
      where: { id: requestId, runToken },
      data: {
        status: "CANCELLED",
      },
    })
    .catch(() => {});

  await mutateMetadata(requestId, runToken, (meta) => {
    const ts = nowIso();
    return {
      ...meta,
      currentStage: "CANCELLED",
      partial: true,
      stageProgress: [
        ...meta.stageProgress,
        {
          stage: "CANCELLED",
          startedAt: ts,
          finishedAt: ts,
          detail,
        },
      ],
      warnings: [...meta.warnings, detail],
    };
  }).catch(() => {});
}

/**
 * Async generation pipeline with run-token fencing and cooperative cancellation.
 */
export async function runGenerationPipeline(requestId: string, runToken: number): Promise<void> {
  const request = await prisma.generationRequest.findUnique({
    where: { id: requestId },
    include: {
      externalSourceProfile: {
        include: {
          urls: true,
        },
      },
    },
  });

  if (!request) return;
  if (request.runToken !== runToken) return;

  const constraints = request.constraints as unknown as GenerationConstraints;
  const parsedIntent = parseGenerationIntent(constraints);
  const aiTraceId = `generation_${requestId}_${runToken}`;
  const retrievalTopic = buildRetrievalTopicQuery(constraints, parsedIntent);

  let partialOutline: Record<string, unknown> | null = null;
  let partialContent: GenerationContent | null = null;

  try {
    if (request.cancelRequestedAt) {
      throw new CancellationRequestedError();
    }

    await mutateMetadata(requestId, runToken, (meta) => ({
      ...meta,
      parsedIntent: toIntentSnapshot(parsedIntent),
    }));

    await startStage({
      requestId,
      runToken,
      stage: "PLANNING",
      detail: "Building plan and extracting links",
    });

    const linkExtraction = await extractLinksFromAdditionalInstructions({
      topic: constraints.topic,
      additionalInstructions: constraints.additionalInstructions,
      traceId: aiTraceId,
    });

    await appendWarnings(requestId, runToken, linkExtraction.warnings);

    const planningHints = buildRetrievalMaterialHints(
      parsedIntent,
      linkExtraction.materialHints
    );
    const planningContext = await retrieveInternalContext({
      ownerAccountId: request.ownerAccountId,
      materialIds: request.materialIds,
      topic: retrievalTopic,
      materialHints: planningHints,
      limit: 12,
    });

    const outline = await generatePlan(
      constraints,
      planningContext.contextText,
      aiTraceId,
      parsedIntent
    );
    partialOutline = outline as unknown as Record<string, unknown>;

    await prisma.generationPlan.upsert({
      where: { requestId },
      create: { requestId, outline: outline as object },
      update: { outline: outline as object },
    });

    await mutateMetadata(requestId, runToken, (meta) => ({
      ...meta,
      linkExtraction: {
        explicitUrls: linkExtraction.explicitUrls,
        suggestedUrls: linkExtraction.suggestedUrls,
        usedUrls: [],
        materialHints: planningHints,
      },
    }));

    await finishStage({
      requestId,
      runToken,
      stage: "PLANNING",
      detail: "Plan generated",
    });

    await assertRunIsActive(requestId, runToken);

    await startStage({
      requestId,
      runToken,
      stage: "RETRIEVING",
      detail: "Retrieving internal and external knowledge",
    });

    const retrievalHints = buildRetrievalMaterialHints(
      parsedIntent,
      linkExtraction.materialHints
    );
    const internalContext = await retrieveInternalContext({
      ownerAccountId: request.ownerAccountId,
      materialIds: request.materialIds,
      topic: retrievalTopic,
      materialHints: retrievalHints,
      limit: 20,
    });

    const includeExternal = constraints.knowledgeMode === "HYBRID_EXTERNAL";
    const profileUrls = request.externalSourceProfile?.urls.map((entry) => entry.url) ?? [];

    const suggestedUrls = includeExternal ? linkExtraction.suggestedUrls : [];
    const teacherUrls = dedupeUrls([
      ...linkExtraction.explicitUrls,
      ...profileUrls,
      ...suggestedUrls,
    ]);

    const externalKnowledge = await fetchExternalKnowledge({
      topic: retrievalTopic,
      includeWhitelist: includeExternal
        ? request.externalSourceProfile?.includeWhitelist ?? true
        : false,
      teacherUrls,
    });

    await appendWarnings(requestId, runToken, externalKnowledge.warnings);

    const filteredExternal = filterExternalDocsBySignal({
      documents: externalKnowledge.documents,
      constraints,
      intent: parsedIntent,
    });
    await appendWarnings(requestId, runToken, filteredExternal.warnings);

    const usedUrls = filteredExternal.documents.map((doc) => doc.url);
    await mutateMetadata(requestId, runToken, (meta) => ({
      ...meta,
      linkExtraction: {
        explicitUrls: linkExtraction.explicitUrls,
        suggestedUrls: linkExtraction.suggestedUrls,
        usedUrls,
        materialHints: retrievalHints,
      },
    }));

    await finishStage({
      requestId,
      runToken,
      stage: "RETRIEVING",
      detail: "Context retrieval completed",
    });

    await assertRunIsActive(requestId, runToken);

    await startStage({
      requestId,
      runToken,
      stage: "GENERATING",
      detail: "Generating draft sections in parallel",
    });

    const mergedContext = buildModelContext({
      internalChunks: internalContext.chunks,
      externalDocs: filteredExternal.documents,
    });

    const generated = await generateContentFromOutline({
      outline,
      constraints,
      materialContext: mergedContext,
      parsedIntent,
      traceId: aiTraceId,
      onSectionCompleted: async (completed, total) => {
        await assertRunIsActive(requestId, runToken);
        await updateBatchProgress({
          requestId,
          runToken,
          stage: "GENERATING",
          batchKey: "sectionGeneration",
          completed,
          total,
        });
      },
    });

    const contentWithSources: GenerationContent = {
      ...generated,
      items: attachSourcesToItems({
        items: generated.items,
        internalChunks: internalContext.chunks,
        externalDocs: filteredExternal.documents,
      }),
    };

    partialContent = contentWithSources;

    await prisma.generationResult.upsert({
      where: { requestId },
      create: {
        requestId,
        content: contentWithSources as object,
        format: constraints.format,
        metadata: {
          materialIds: request.materialIds,
          generatedAt: nowIso(),
          partial: true,
        } as object,
      },
      update: {
        content: contentWithSources as object,
        format: constraints.format,
        metadata: {
          materialIds: request.materialIds,
          generatedAt: nowIso(),
          partial: true,
        } as object,
      },
    });

    await finishStage({
      requestId,
      runToken,
      stage: "GENERATING",
      detail: "Draft content generated",
    });

    await assertRunIsActive(requestId, runToken);

    await startStage({
      requestId,
      runToken,
      stage: "VALIDATING",
      detail: "Validating generated items in batches",
    });

    const validated = await validateContentBatched({
      content: contentWithSources,
      constraints,
      parsedIntent,
      traceId: aiTraceId,
      onBatchCompleted: async (completed, total) => {
        await assertRunIsActive(requestId, runToken);
        await updateBatchProgress({
          requestId,
          runToken,
          stage: "VALIDATING",
          batchKey: "validation",
          completed,
          total,
        });
      },
    });

    await appendWarnings(requestId, runToken, validated.warnings);

    const qualityResult = await enforceContentQuality({
      content: validated.content,
      constraints,
      intent: parsedIntent,
      materialContext: mergedContext,
      traceId: aiTraceId,
      maxPasses: 2,
    });
    await appendWarnings(requestId, runToken, qualityResult.warnings);
    await mutateMetadata(requestId, runToken, (meta) => ({
      ...meta,
      qualityReport: qualityResult.qualityReport,
    }));

    const finalWarnings = [...validated.warnings, ...qualityResult.warnings];
    const finalContent: GenerationContent = {
      ...qualityResult.content,
      items: attachSourcesToItems({
        items: qualityResult.content.items,
        internalChunks: internalContext.chunks,
        externalDocs: filteredExternal.documents,
      }),
    };

    await prisma.generationResult.upsert({
      where: { requestId },
      create: {
        requestId,
        content: finalContent as object,
        format: constraints.format,
        metadata: {
          materialIds: request.materialIds,
          generatedAt: nowIso(),
          partial: false,
          warnings: finalWarnings,
          qualityReport: qualityResult.qualityReport,
          usedExternalUrls: usedUrls,
        } as object,
      },
      update: {
        content: finalContent as object,
        format: constraints.format,
        metadata: {
          materialIds: request.materialIds,
          generatedAt: nowIso(),
          partial: false,
          warnings: finalWarnings,
          qualityReport: qualityResult.qualityReport,
          usedExternalUrls: usedUrls,
        } as object,
      },
    });

    await finishStage({
      requestId,
      runToken,
      stage: "VALIDATING",
      detail: "Validation and quality gate complete",
    });

    await mutateMetadata(requestId, runToken, (meta) => ({
      ...meta,
      currentStage: "READY",
      progressPercent: 100,
      partial: false,
      stageProgress: [
        ...meta.stageProgress,
        {
          stage: "READY",
          startedAt: nowIso(),
          finishedAt: nowIso(),
          detail: "Generation completed",
        },
      ],
    }));

    await updateRequestStatus(requestId, runToken, "READY");
  } catch (error) {
    if (error instanceof StaleRunTokenError) {
      return;
    }

    if (error instanceof CancellationRequestedError) {
      if (partialOutline) {
        await prisma.generationPlan
          .upsert({
            where: { requestId },
            create: { requestId, outline: partialOutline as object },
            update: { outline: partialOutline as object },
          })
          .catch(() => {});
      }

      if (partialContent) {
        await prisma.generationResult
          .upsert({
            where: { requestId },
            create: {
              requestId,
              content: partialContent as object,
              format: constraints.format,
              metadata: {
                materialIds: request.materialIds,
                generatedAt: nowIso(),
                partial: true,
              } as object,
            },
            update: {
              content: partialContent as object,
              format: constraints.format,
              metadata: {
                materialIds: request.materialIds,
                generatedAt: nowIso(),
                partial: true,
              } as object,
            },
          })
          .catch(() => {});
      }

      await markCancelled(requestId, runToken, "Generation cancelled by user");
      return;
    }

    await prisma.generationRequest
      .updateMany({
        where: { id: requestId, runToken },
        data: { status: "ERROR" },
      })
      .catch(() => {});

    await mutateMetadata(requestId, runToken, (meta) => ({
      ...meta,
      currentStage: "ERROR",
      partial: Boolean(partialContent),
      stageProgress: [
        ...meta.stageProgress,
        {
          stage: "ERROR",
          startedAt: nowIso(),
          finishedAt: nowIso(),
          detail: error instanceof Error ? error.message : "Unknown generation error",
        },
      ],
      warnings: [
        ...meta.warnings,
        error instanceof Error ? error.message : "Unknown generation error",
      ],
    })).catch(() => {});

    throw error;
  }
}
