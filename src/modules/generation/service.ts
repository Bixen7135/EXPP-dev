import { prisma } from "@/lib/db/prisma";
import { validateConstraints } from "./constraints";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { enqueueGenerationJob, removeGenerationJob } from "./queue";
import { getExternalSourceProfileOrThrow } from "./source-profiles";
import { ensureGenerationWorkerAutoStarted } from "./auto-worker";
import type {
  GenerationConstraints,
  GenerationContent,
  GenerationPlanOutline,
  GenerationRequestSummary,
  GenerationRequestDetail,
  GenerationStatus,
  GenerationRunMetadata,
} from "./types";

export { validateConstraints };

function createQueuedMetadata(now = new Date()): GenerationRunMetadata {
  const ts = now.toISOString();
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

function coerceMetadata(raw: unknown): GenerationRunMetadata | null {
  if (!raw || typeof raw !== "object") return null;

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
        ? data.parsedIntent
        : undefined,
    qualityReport:
      data.qualityReport && typeof data.qualityReport === "object"
        ? data.qualityReport
        : undefined,
    partial: Boolean(data.partial),
  };
}

function withWarningMetadata(raw: unknown, warning: string): GenerationRunMetadata {
  const base = coerceMetadata(raw) ?? createQueuedMetadata();
  return {
    ...base,
    warnings: [...base.warnings, warning],
  };
}

async function ensureExternalSourceProfileOwnership(
  constraints: GenerationConstraints,
  ownerAccountId: string
): Promise<void> {
  if (constraints.externalSourceProfileId) {
    await getExternalSourceProfileOrThrow(constraints.externalSourceProfileId, ownerAccountId);
  }
}

export async function createGenerationRequest(opts: {
  ownerAccountId: string;
  constraints: unknown;
  materialIds: string[];
}): Promise<GenerationRequestDetail> {
  const { ownerAccountId, materialIds } = opts;
  const constraints = validateConstraints(opts.constraints);
  await ensureExternalSourceProfileOwnership(constraints, ownerAccountId);

  const request = await prisma.generationRequest.create({
    data: {
      ownerAccountId,
      status: "QUEUED",
      constraints: constraints as object,
      materialIds,
      runToken: 1,
      externalSourceProfileId: constraints.externalSourceProfileId ?? null,
      metadata: createQueuedMetadata() as object,
    },
  });

  await ensureGenerationWorkerAutoStarted();
  await enqueueGenerationJob({
    requestId: request.id,
    runToken: request.runToken,
    traceId: `generation-create:${request.id}`,
  });

  return getGenerationRequest(request.id, ownerAccountId);
}

export async function listGenerationRequests(
  ownerAccountId: string
): Promise<GenerationRequestSummary[]> {
  await ensureGenerationWorkerAutoStarted();

  const rows = await prisma.generationRequest.findMany({
    where: { ownerAccountId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function getGenerationRequest(
  id: string,
  ownerAccountId: string
): Promise<GenerationRequestDetail> {
  await ensureGenerationWorkerAutoStarted();

  const request = await prisma.generationRequest.findUnique({
    where: { id },
    include: { plan: true, result: true },
  });
  if (!request) throw new NotFoundError("Generation request not found");
  if (request.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  return toDetail(request);
}

export async function regenerateRequest(
  id: string,
  ownerAccountId: string,
  newConstraints?: unknown
): Promise<GenerationRequestDetail> {
  const request = await prisma.generationRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Generation request not found");
  if (request.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  const constraints =
    newConstraints !== undefined
      ? validateConstraints(newConstraints)
      : (request.constraints as unknown as GenerationConstraints);

  await ensureExternalSourceProfileOwnership(constraints, ownerAccountId);

  const nextRunToken = request.runToken + 1;

  await prisma.generationRequest.update({
    where: { id },
    data: {
      constraints: constraints as object,
      externalSourceProfileId: constraints.externalSourceProfileId ?? null,
      status: "QUEUED",
      runToken: nextRunToken,
      metadata: createQueuedMetadata() as object,
      cancelRequestedAt: null,
      cancelReason: null,
    },
  });

  await ensureGenerationWorkerAutoStarted();
  await enqueueGenerationJob({
    requestId: id,
    runToken: nextRunToken,
    traceId: `generation-regenerate:${id}`,
  });

  return getGenerationRequest(id, ownerAccountId);
}

export async function cancelGenerationRequest(opts: {
  id: string;
  ownerAccountId: string;
  reason?: string;
}): Promise<GenerationRequestDetail> {
  const { id, ownerAccountId, reason } = opts;

  const request = await prisma.generationRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Generation request not found");
  if (request.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  if (request.status === "READY" || request.status === "ERROR" || request.status === "CANCELLED") {
    return getGenerationRequest(id, ownerAccountId);
  }

  const now = new Date();

  const cancelledQueued =
    request.status === "QUEUED" || request.status === "PENDING"
      ? await removeGenerationJob(id, request.runToken)
      : false;

  if (cancelledQueued) {
    const metadata = withWarningMetadata(
      request.metadata,
      "Generation cancelled before execution"
    );

    await prisma.generationRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelRequestedAt: now,
        cancelReason: reason ?? null,
        metadata: {
          ...metadata,
          currentStage: "CANCELLED",
          progressPercent: metadata.progressPercent ?? 0,
          stageProgress: [
            ...metadata.stageProgress,
            {
              stage: "CANCELLED",
              startedAt: now.toISOString(),
              finishedAt: now.toISOString(),
              detail: "Request cancelled before worker start",
            },
          ],
        } as object,
      },
    });

    return getGenerationRequest(id, ownerAccountId);
  }

  await prisma.generationRequest.update({
    where: { id },
    data: {
      cancelRequestedAt: now,
      cancelReason: reason ?? null,
      metadata: withWarningMetadata(request.metadata, "Cancellation requested") as object,
    },
  });

  return getGenerationRequest(id, ownerAccountId);
}

// -- Mapping helpers --------------------------------------------------------

type RequestRow = {
  id: string;
  ownerAccountId: string;
  status: string;
  constraints: unknown;
  materialIds: string[];
  runToken: number;
  metadata: unknown;
  cancelRequestedAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RequestWithRelations = RequestRow & {
  plan: { outline: unknown } | null;
  result: {
    id: string;
    content: unknown;
    format: string;
    metadata: unknown;
    createdAt: Date;
  } | null;
};

function toSummary(r: RequestRow): GenerationRequestSummary {
  return {
    id: r.id,
    ownerAccountId: r.ownerAccountId,
    status: r.status as GenerationStatus,
    constraints: r.constraints as unknown as GenerationConstraints,
    materialIds: r.materialIds,
    runToken: r.runToken,
    metadata: coerceMetadata(r.metadata),
    cancelRequestedAt: r.cancelRequestedAt,
    cancelReason: r.cancelReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toDetail(r: RequestWithRelations): GenerationRequestDetail {
  return {
    ...toSummary(r),
    plan: r.plan ? (r.plan.outline as unknown as GenerationPlanOutline) : null,
    result: r.result
      ? {
          id: r.result.id,
          content: r.result.content as unknown as GenerationContent,
          format: r.result.format,
          metadata: r.result.metadata as unknown as Record<string, unknown> | null,
          createdAt: r.result.createdAt,
        }
      : null,
  };
}
