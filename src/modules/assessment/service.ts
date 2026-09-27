import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { auditLog } from "@/lib/audit/logger";
import { resolveAiModel } from "@/lib/ai/models";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  QueueUnavailableError,
} from "@/lib/errors";
import { normalizeMaxScoreByQuestionType } from "@/lib/question-scoring";
import type { AssignmentContent, AssignmentItemContent, RubricCriterion } from "@/modules/assignments/types";
import type { AttemptAnswer } from "@/modules/completion/types";
import { autoCheck } from "./auto-check";
import { analyzeAttemptWithAi, ASSESSMENT_AI_PROMPT_VERSION } from "./ai-analysis";
import { ensureAssessmentWorkerAutoStarted } from "./auto-worker";
import {
  enqueueAssessmentAiJob,
  removeAssessmentAiJob,
  type AssessmentAiJobData,
} from "./queue";
import type {
  AssessmentDetail,
  StudentResult,
  StudentAiReview,
  AssessmentAiRunSummary,
  AssessmentAiRunTrigger,
  ItemScoreOverride,
  ConfidenceLevel,
} from "./types";
import { enqueueInsightRecomputeForPublishedAttempt } from "@/modules/analytics/insight-service";

const DEFAULT_AI_MODEL = resolveAiModel();
const DEFAULT_ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS = 1_500;
const ASSESSMENT_AI_CANCELLED_ERROR = "AI analysis cancelled by teacher";

// -- Get or Create Assessment (deterministic auto-check only) --

export async function getOrCreateAssessment(
  attemptId: string,
  reviewerAccountId: string
): Promise<AssessmentDetail> {
  const context = await loadAttemptWithAssessmentContext(attemptId);
  if (!context) throw new NotFoundError("Attempt not found");
  if (context.recipient.distribution.creatorAccountId !== reviewerAccountId) {
    throw new ForbiddenError();
  }

  const { assessment } = await ensureAssessmentExists(context);
  return toAssessmentDetail(assessment);
}

// -- Get Assessment for Teacher --

export async function getAssessmentForTeacher(
  attemptId: string,
  reviewerAccountId: string
): Promise<AssessmentDetail> {
  const assessment = await prisma.assessment.findUnique({
    where: { attemptId },
    include: { latestAiRun: true },
  });

  if (!assessment) throw new NotFoundError("Assessment not found");
  if (assessment.reviewerAccountId !== reviewerAccountId) throw new ForbiddenError();

  return toAssessmentDetail(assessment);
}

// -- List Submissions for a Distribution --

export interface SubmissionSummary {
  attemptId: string;
  recipientAccountId: string;
  submittedAt: Date | null;
  recipientId: string;
  assessmentStatus: string | null;
  autoCheckStatus: string | null;
}

export async function listSubmissionsForDistribution(
  distributionId: string,
  creatorAccountId: string
): Promise<SubmissionSummary[]> {
  const distribution = await prisma.assignmentDistribution.findUnique({
    where: { id: distributionId },
    select: { creatorAccountId: true },
  });

  if (!distribution) throw new NotFoundError("Distribution not found");
  if (distribution.creatorAccountId !== creatorAccountId) throw new ForbiddenError();

  const recipients = await prisma.assignmentRecipient.findMany({
    where: { distributionId },
    include: {
      attempt: {
        include: {
          assessment: { select: { status: true, autoCheckStatus: true } },
        },
      },
    },
  });

  return recipients.map((recipient) => ({
    recipientId: recipient.id,
    recipientAccountId: recipient.recipientAccountId,
    submittedAt: recipient.attempt?.submittedAt ?? null,
    attemptId: recipient.attempt?.id ?? "",
    assessmentStatus: recipient.attempt?.assessment?.status ?? null,
    autoCheckStatus: recipient.attempt?.assessment?.autoCheckStatus ?? null,
  }));
}

// -- Queue AI analysis --

export async function queueAutoAnalysisForAttempt(
  attemptId: string,
  traceId: string
): Promise<void> {
  const context = await loadAttemptWithAssessmentContext(attemptId);
  if (!context) throw new NotFoundError("Attempt not found");
  if (context.status !== "SUBMITTED") {
    return;
  }

  const { assessment } = await ensureAssessmentExists(context);
  await enqueueAssessmentRun({
    attemptId,
    reviewerAccountId: context.recipient.distribution.creatorAccountId,
    assessmentId: assessment.id,
    trigger: "AUTO_ON_SUBMIT",
    traceId,
    context,
  });
}

export async function triggerAssessmentAnalysis(
  attemptId: string,
  reviewerAccountId: string,
  traceId: string
): Promise<AssessmentDetail> {
  const context = await loadAttemptWithAssessmentContext(attemptId);
  if (!context) throw new NotFoundError("Attempt not found");
  if (context.recipient.distribution.creatorAccountId !== reviewerAccountId) throw new ForbiddenError();

  const { assessment } = await ensureAssessmentExists(context);
  await enqueueAssessmentRun({
    attemptId,
    reviewerAccountId,
    assessmentId: assessment.id,
    trigger: "MANUAL_RERUN",
    traceId,
    context,
  });

  const refreshed = await prisma.assessment.findUnique({
    where: { id: assessment.id },
    include: { latestAiRun: true },
  });

  return toAssessmentDetail(refreshed!);
}

export async function cancelAssessmentAnalysis(
  attemptId: string,
  reviewerAccountId: string,
  traceId: string
): Promise<AssessmentDetail> {
  const assessment = await prisma.assessment.findUnique({
    where: { attemptId },
    include: { latestAiRun: true },
  });

  if (!assessment) throw new NotFoundError("Assessment not found");
  if (assessment.reviewerAccountId !== reviewerAccountId) throw new ForbiddenError();

  const latestRun = assessment.latestAiRun;
  const isActive =
    latestRun !== null &&
    (latestRun.status === "QUEUED" || latestRun.status === "PROCESSING");

  if (!isActive) {
    return toAssessmentDetail(assessment);
  }

  let removedFromQueue = false;
  if (latestRun.status === "QUEUED") {
    try {
      removedFromQueue = await removeAssessmentAiJob(latestRun.id);
    } catch (error) {
      console.warn("[assessment-ai] failed to remove queued job during cancellation", {
        runId: latestRun.id,
        attemptId,
        traceId,
        error: summarizeQueueError(error),
      });
    }
  }

  const cancelledAt = new Date();
  const cancelled = await prisma.$transaction(async (tx) => {
    const runUpdate = await tx.assessmentAiRun.updateMany({
      where: {
        id: latestRun.id,
        status: { in: ["QUEUED", "PROCESSING"] },
      },
      data: {
        status: "FAILED",
        error: ASSESSMENT_AI_CANCELLED_ERROR,
        completedAt: cancelledAt,
      },
    });

    if (runUpdate.count === 0) return false;

    await tx.assessment.update({
      where: { id: assessment.id },
      data: {
        autoCheckStatus: "FAILED",
        confidence: null,
        warnings: [ASSESSMENT_AI_CANCELLED_ERROR],
        latestAiRunId: latestRun.id,
      },
    });

    return true;
  });

  if (cancelled) {
    await auditLog({
      actorAccountId: reviewerAccountId,
      action: "assessment.ai_cancelled",
      entityType: "AssessmentAiRun",
      entityId: latestRun.id,
      context: {
        assessmentId: assessment.id,
        attemptId,
        previousStatus: latestRun.status,
        removedFromQueue,
      },
      traceId,
    });
  }

  const refreshed = await prisma.assessment.findUnique({
    where: { id: assessment.id },
    include: { latestAiRun: true },
  });

  return toAssessmentDetail(refreshed!);
}

export async function processAssessmentAiJob(opts: {
  runId: string;
  traceId: string;
}): Promise<void> {
  const run = await prisma.assessmentAiRun.findUnique({
    where: { id: opts.runId },
    include: {
      assessment: {
        include: {
          attempt: {
            include: {
              recipient: {
                include: {
                  distribution: {
                    include: {
                      version: { select: { content: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!run) {
    console.warn("[assessment-ai] run not found", {
      runId: opts.runId,
      traceId: opts.traceId,
    });
    return;
  }

  if (isCancelledAssessmentRun(run)) {
    console.info("[assessment-ai] skipped cancelled run", {
      runId: run.id,
      assessmentId: run.assessmentId,
      traceId: opts.traceId,
    });
    return;
  }

  const traceId = opts.traceId || run.traceId || "unknown";
  console.info("[assessment-ai] processing started", {
    runId: run.id,
    assessmentId: run.assessmentId,
    attemptId: run.assessment.attemptId,
    trigger: run.trigger,
    traceId,
  });

  const processingStarted = await prisma.$transaction(async (tx) => {
    const promoted = await tx.assessmentAiRun.updateMany({
      where: {
        id: run.id,
        OR: [
          { status: "QUEUED" },
          {
            status: "FAILED",
            error: { not: ASSESSMENT_AI_CANCELLED_ERROR },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        error: null,
      },
    });

    if (promoted.count === 0) return false;

    await tx.assessment.update({
      where: { id: run.assessmentId },
      data: {
        autoCheckStatus: "PROCESSING",
        latestAiRunId: run.id,
      },
    });

    return true;
  });

  if (!processingStarted) {
    console.info("[assessment-ai] processing skipped due to non-runnable status", {
      runId: run.id,
      assessmentId: run.assessmentId,
      traceId,
    });
    return;
  }

  await auditLog({
    actorAccountId: run.assessment.reviewerAccountId,
    action: "assessment.ai_started",
    entityType: "AssessmentAiRun",
    entityId: run.id,
    context: { assessmentId: run.assessmentId, attemptId: run.assessment.attemptId },
    traceId,
  });

  const assignmentContent = normalizeAssignmentContent(
    run.assessment.attempt.recipient.distribution.version.content as unknown as AssignmentContent
  );
  const answers = (run.assessment.attempt.answers as unknown as AttemptAnswer[]) ?? [];

  const deterministic = autoCheck(assignmentContent.items, answers);

  try {
    const recommendation = await analyzeAttemptWithAi({
      items: assignmentContent.items,
      answers,
      autoCheckResult: deterministic,
      modelId: run.model,
    });
    const preserveManualMaxGrade =
      run.assessment.status === "REVIEWED" || run.assessment.status === "PUBLISHED";

    const runStateBeforePersist = await prisma.assessmentAiRun.findUnique({
      where: { id: run.id },
      select: { status: true, error: true },
    });
    if (isCancelledAssessmentRun(runStateBeforePersist)) {
      console.info("[assessment-ai] processing result discarded due to cancellation", {
        runId: run.id,
        assessmentId: run.assessmentId,
        traceId,
      });
      return;
    }

    const persisted = await prisma.$transaction(async (tx) => {
      const updatedRun = await tx.assessmentAiRun.update({
        where: { id: run.id },
        data: {
          status: "READY",
          resultJson: recommendation as object,
          confidence: recommendation.confidence,
          warnings: recommendation.warnings,
          completedAt: new Date(),
          error: null,
        },
        select: {
          id: true,
          status: true,
          confidence: true,
          completedAt: true,
        },
      });

      const updatedAssessment = await tx.assessment.update({
        where: { id: run.assessmentId },
        data: {
          autoCheckResult: deterministic as object,
          autoCheckStatus: "READY",
          aiRecommendation: recommendation as object,
          confidence: recommendation.confidence,
          warnings: recommendation.warnings,
          latestAiRunId: run.id,
          status: run.assessment.status === "PENDING" ? "AUTO_CHECKED" : run.assessment.status,
          maxGrade: preserveManualMaxGrade
            ? run.assessment.maxGrade
            : recommendation.maxTotal,
        },
        select: {
          id: true,
          status: true,
          autoCheckStatus: true,
          maxGrade: true,
          updatedAt: true,
        },
      });

      return { updatedRun, updatedAssessment };
    });

    console.info("[assessment-ai] processing persisted", {
      runId: persisted.updatedRun.id,
      runStatus: persisted.updatedRun.status,
      assessmentId: persisted.updatedAssessment.id,
      assessmentStatus: persisted.updatedAssessment.status,
      autoCheckStatus: persisted.updatedAssessment.autoCheckStatus,
      recommendedTotal: recommendation.recommendedTotal,
      maxTotal: recommendation.maxTotal,
      confidence: persisted.updatedRun.confidence,
      completedAt: persisted.updatedRun.completedAt?.toISOString() ?? null,
      traceId,
    });

    await auditLog({
      actorAccountId: run.assessment.reviewerAccountId,
      action: "assessment.ai_ready",
      entityType: "AssessmentAiRun",
      entityId: run.id,
      context: {
        assessmentId: run.assessmentId,
        attemptId: run.assessment.attemptId,
        recommendedTotal: recommendation.recommendedTotal,
        maxTotal: recommendation.maxTotal,
        confidence: recommendation.confidence,
      },
      traceId,
    });
  } catch (error) {
    const runStateOnError = await prisma.assessmentAiRun.findUnique({
      where: { id: run.id },
      select: { status: true, error: true },
    });
    if (isCancelledAssessmentRun(runStateOnError)) {
      console.info("[assessment-ai] processing aborted after cancellation", {
        runId: run.id,
        assessmentId: run.assessmentId,
        traceId,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown AI analysis error";

    await prisma.$transaction(async (tx) => {
      await tx.assessmentAiRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      await tx.assessment.update({
        where: { id: run.assessmentId },
        data: {
          autoCheckStatus: "FAILED",
          confidence: null,
          warnings: [errorMessage],
          latestAiRunId: run.id,
        },
      });
    });

    await auditLog({
      actorAccountId: run.assessment.reviewerAccountId,
      action: "assessment.ai_failed",
      entityType: "AssessmentAiRun",
      entityId: run.id,
      context: {
        assessmentId: run.assessmentId,
        attemptId: run.assessment.attemptId,
        error: errorMessage,
      },
      traceId,
    });

    console.error("[assessment-ai] processing failed", {
      runId: run.id,
      assessmentId: run.assessmentId,
      attemptId: run.assessment.attemptId,
      error: errorMessage,
      traceId,
    });

    throw error;
  }
}

// -- Review Assessment (teacher final decision) --

export async function reviewAssessment(
  attemptId: string,
  reviewerAccountId: string,
  opts: {
    manualGrade: number;
    maxGrade: number;
    comment?: string;
    itemOverrides?: ItemScoreOverride[];
  }
): Promise<AssessmentDetail> {
  const assessment = await prisma.assessment.findUnique({
    where: { attemptId },
    include: { latestAiRun: true },
  });

  if (!assessment) throw new NotFoundError("Assessment not found");
  if (assessment.reviewerAccountId !== reviewerAccountId) throw new ForbiddenError();
  if (assessment.status === "PUBLISHED") {
    throw new ValidationError("Cannot modify a published assessment. Re-publish to update.");
  }

  if (opts.maxGrade <= 0) {
    throw new ValidationError("maxGrade must be greater than 0");
  }

  if (opts.manualGrade < 0 || opts.manualGrade > opts.maxGrade) {
    throw new ValidationError("Grade must be between 0 and maxGrade");
  }

  const updated = await prisma.assessment.update({
    where: { attemptId },
    data: {
      manualGrade: opts.manualGrade,
      maxGrade: opts.maxGrade,
      comment: opts.comment ?? null,
      itemOverrides: (opts.itemOverrides ?? []) as object[],
      status: "REVIEWED",
      reviewedAt: new Date(),
    },
    include: { latestAiRun: true },
  });

  return toAssessmentDetail(updated);
}

// -- Publish Assessment --

export async function publishAssessment(
  attemptId: string,
  reviewerAccountId: string
): Promise<AssessmentDetail> {
  const assessment = await prisma.assessment.findUnique({
    where: { attemptId },
    include: { latestAiRun: true },
  });

  if (!assessment) throw new NotFoundError("Assessment not found");
  if (assessment.reviewerAccountId !== reviewerAccountId) throw new ForbiddenError();

  if (assessment.status !== "REVIEWED") {
    throw new ValidationError("Assessment must be in REVIEWED status to publish");
  }

  const updated = await prisma.assessment.update({
    where: { attemptId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    include: { latestAiRun: true },
  });

  try {
    await enqueueInsightRecomputeForPublishedAttempt({
      attemptId,
      traceId: `assessment_publish_${attemptId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[student-analytics-insight] enqueue failed after publish", {
      attemptId,
      assessmentId: updated.id,
      reviewerAccountId,
      error: message,
    });

    await auditLog({
      actorAccountId: reviewerAccountId,
      action: "analytics.insight_enqueue_failed",
      entityType: "Assessment",
      entityId: updated.id,
      context: {
        attemptId,
        error: message,
      },
      traceId: `assessment_publish_${attemptId}`,
    });
  }

  return toAssessmentDetail(updated);
}

// -- Get Student Result (only if PUBLISHED) --

export async function getStudentResult(
  attemptId: string,
  learnerAccountId: string
): Promise<StudentResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { learnerAccountId: true, assessment: true },
  });

  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.learnerAccountId !== learnerAccountId) throw new ForbiddenError();

  const assessment = attempt.assessment;
  if (!assessment || assessment.status !== "PUBLISHED") {
    throw new NotFoundError("Result not yet published");
  }

  return {
    assessmentId: assessment.id,
    attemptId,
    grade: assessment.manualGrade,
    maxGrade: assessment.maxGrade,
    comment: assessment.comment,
    aiReview: toStudentAiReview(assessment.aiRecommendation),
    publishedAt: assessment.publishedAt!,
  };
}

// -- Helpers --

type AttemptWithAssessmentContext = {
  id: string;
  status: string;
  updatedAt: Date;
  answers: unknown;
  recipient: {
    distribution: {
      creatorAccountId: string;
      version: { content: unknown };
    };
  };
  assessment: AssessmentRow | null;
};

async function loadAttemptWithAssessmentContext(
  attemptId: string
): Promise<AttemptWithAssessmentContext | null> {
  return prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      recipient: {
        include: {
          distribution: {
            include: {
              version: { select: { content: true } },
            },
          },
        },
      },
      assessment: {
        include: { latestAiRun: true },
      },
    },
  }) as unknown as AttemptWithAssessmentContext | null;
}

async function ensureAssessmentExists(context: AttemptWithAssessmentContext): Promise<{
  assessment: AssessmentRowWithRun;
}> {
  if (context.assessment) {
    return {
      assessment: context.assessment as AssessmentRowWithRun,
    };
  }

  const content = normalizeAssignmentContent(
    context.recipient.distribution.version.content as unknown as AssignmentContent
  );
  const answers = (context.answers as unknown as AttemptAnswer[]) ?? [];
  const autoCheckResult = autoCheck(content.items, answers);

  const created = await prisma.assessment.create({
    data: {
      attemptId: context.id,
      reviewerAccountId: context.recipient.distribution.creatorAccountId,
      autoCheckResult: autoCheckResult as object,
      autoCheckStatus: "NOT_STARTED",
      status: "AUTO_CHECKED",
    },
    include: { latestAiRun: true },
  });

  return {
    assessment: created as unknown as AssessmentRowWithRun,
  };
}

async function enqueueAssessmentRun(opts: {
  assessmentId: string;
  attemptId: string;
  reviewerAccountId: string;
  trigger: AssessmentAiRunTrigger;
  traceId: string;
  context: AttemptWithAssessmentContext;
}): Promise<void> {
  const assignmentContent = normalizeAssignmentContent(
    opts.context.recipient.distribution.version.content as unknown as AssignmentContent
  );
  const inputHash = buildAssessmentInputHash({
    attemptId: opts.attemptId,
    attemptUpdatedAt: opts.context.updatedAt,
    answers: (opts.context.answers as unknown as AttemptAnswer[]) ?? [],
    items: assignmentContent.items,
    promptVersion: ASSESSMENT_AI_PROMPT_VERSION,
  });

  const existingActive = await prisma.assessmentAiRun.findFirst({
    where: {
      assessmentId: opts.assessmentId,
      inputHash,
      status: { in: ["QUEUED", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingActive) {
    await prisma.assessment.update({
      where: { id: opts.assessmentId },
      data: {
        autoCheckStatus: existingActive.status,
        latestAiRunId: existingActive.id,
      },
    });
    console.info("[assessment-ai] existing active run reused", {
      existingRunId: existingActive.id,
      assessmentId: opts.assessmentId,
      attemptId: opts.attemptId,
      trigger: opts.trigger,
      status: existingActive.status,
      traceId: opts.traceId,
    });
    return;
  }

  const run = await prisma.assessmentAiRun.create({
    data: {
      assessmentId: opts.assessmentId,
      trigger: opts.trigger,
      status: "QUEUED",
      model: DEFAULT_AI_MODEL,
      promptVersion: ASSESSMENT_AI_PROMPT_VERSION,
      inputHash,
      traceId: opts.traceId,
    },
  });

  await prisma.assessment.update({
    where: { id: opts.assessmentId },
    data: {
      autoCheckStatus: "QUEUED",
      latestAiRunId: run.id,
    },
  });

  const jobData = {
    runId: run.id,
    assessmentId: opts.assessmentId,
    attemptId: opts.attemptId,
    reviewerAccountId: opts.reviewerAccountId,
    trigger: opts.trigger,
    traceId: opts.traceId,
    idempotencyKey: `${opts.assessmentId}:${inputHash}:${opts.trigger}`,
  } satisfies AssessmentAiJobData;

  await ensureAssessmentWorkerAutoStarted();
  await enqueueAssessmentAiJobWithTimeout(jobData);

  await auditLog({
    actorAccountId: opts.reviewerAccountId,
    action: opts.trigger === "MANUAL_RERUN" ? "assessment.ai_rerun" : "assessment.ai_queued",
    entityType: "AssessmentAiRun",
    entityId: run.id,
    context: {
      assessmentId: opts.assessmentId,
      attemptId: opts.attemptId,
      trigger: opts.trigger,
    },
    traceId: opts.traceId,
  });

  console.info("[assessment-ai] run queued", {
    runId: run.id,
    assessmentId: opts.assessmentId,
    attemptId: opts.attemptId,
    trigger: opts.trigger,
    traceId: opts.traceId,
    promptVersion: ASSESSMENT_AI_PROMPT_VERSION,
  });
}

async function enqueueAssessmentAiJobWithTimeout(data: AssessmentAiJobData): Promise<void> {
  const timeoutMs = getAssessmentAiEnqueueTimeoutMs();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  await new Promise<void>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new QueueUnavailableError(
          `Assessment queue enqueue timed out after ${timeoutMs}ms`
        )
      );
    }, timeoutMs);

    enqueueAssessmentAiJob(data)
      .then(() => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      })
      .catch((error: unknown) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (settled) {
          console.warn(
            "[assessment-ai] enqueue failed after timeout",
            summarizeQueueError(error)
          );
          return;
        }

        settled = true;
        if (isQueueConnectivityError(error)) {
          reject(
            new QueueUnavailableError(
              "Assessment queue service is unavailable. Please retry shortly."
            )
          );
          return;
        }

        reject(error);
      });
  });
}

function getAssessmentAiEnqueueTimeoutMs(): number {
  const raw = process.env.ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS;
  }

  return parsed;
}

function isCancelledAssessmentRun(
  run:
    | { status: string; error: string | null }
    | null
    | undefined
): boolean {
  return (
    run?.status === "FAILED" && run.error === ASSESSMENT_AI_CANCELLED_ERROR
  );
}

function isQueueConnectivityError(error: unknown): boolean {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code.toUpperCase()
      : "";

  const connectivityCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "ECONNABORTED",
  ]);

  if (connectivityCodes.has(code)) return true;

  const message = summarizeQueueError(error).toLowerCase();
  return (
    message.includes("redis") ||
    message.includes("connection is closed") ||
    message.includes("max retries per request")
  );
}

function summarizeQueueError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function buildAssessmentInputHash(opts: {
  attemptId: string;
  attemptUpdatedAt: Date;
  answers: AttemptAnswer[];
  items: AssignmentItemContent[];
  promptVersion: string;
}): string {
  const payload = {
    attemptId: opts.attemptId,
    attemptUpdatedAt: opts.attemptUpdatedAt.toISOString(),
    promptVersion: opts.promptVersion,
    answers: opts.answers,
    items: opts.items.map((item) => ({
      order: item.order,
      type: item.type,
      question: item.question,
      expectedAnswer: item.expectedAnswer,
      maxScore: normalizeMaxScoreByQuestionType(item.type, item.maxScore),
      rubricCriteria: item.rubricCriteria ?? [],
    })),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function normalizeAssignmentContent(content: AssignmentContent): AssignmentContent {
  return {
    ...content,
    items: content.items.map((item) => normalizeItem(item)),
  };
}

function normalizeItem(item: AssignmentItemContent): AssignmentItemContent {
  const maxScore = normalizeMaxScoreByQuestionType(item.type, item.maxScore);

  let rubricCriteria: RubricCriterion[];
  if (item.rubricCriteria && item.rubricCriteria.length > 0) {
    const total = item.rubricCriteria.reduce((sum, criterion) => sum + Math.max(criterion.weight, 0), 0);
    if (total > 0) {
      const scale = maxScore / total;
      rubricCriteria = item.rubricCriteria.map((criterion, index) => ({
        id: criterion.id || `criterion_${index + 1}`,
        title: criterion.title,
        description: criterion.description,
        type: criterion.type === "PENALTY" ? "PENALTY" : "EXPECTATION",
        weight: Number((Math.max(criterion.weight, 0) * scale).toFixed(2)),
      }));
    } else {
      rubricCriteria = [];
    }
  } else {
    rubricCriteria = [];
  }

  if (rubricCriteria.length === 0) {
    rubricCriteria = [
      {
        id: "criterion_main",
        title: "Expected answer coverage",
        description:
          item.expectedAnswer || "Response demonstrates expected understanding for this prompt.",
        weight: maxScore,
        type: "EXPECTATION",
      },
    ];
  }

  return {
    ...item,
    maxScore,
    rubricCriteria,
  };
}

function toStudentAiReview(raw: unknown): StudentAiReview | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const gradeRationale =
    typeof record.gradeRationale === "string" ? record.gradeRationale : null;
  const reviewPriority = Array.isArray(record.reviewPriority)
    ? record.reviewPriority.filter((item): item is string => typeof item === "string")
    : [];
  const itemsRaw = Array.isArray(record.items) ? record.items : [];

  if (!gradeRationale) return null;

  const items = itemsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const itemOrder =
        typeof row.itemOrder === "number" ? Math.trunc(row.itemOrder) : null;
      if (!itemOrder || itemOrder <= 0) return null;
      return {
        itemOrder,
        whatIsCorrect: Array.isArray(row.whatIsCorrect)
          ? row.whatIsCorrect.filter(
              (value): value is string => typeof value === "string"
            )
          : [],
        whatIsIncorrect: Array.isArray(row.whatIsIncorrect)
          ? row.whatIsIncorrect.filter(
              (value): value is string => typeof value === "string"
            )
          : [],
        whatIsMissing: Array.isArray(row.whatIsMissing)
          ? row.whatIsMissing.filter(
              (value): value is string => typeof value === "string"
            )
          : [],
      };
    })
    .filter(
      (
        item
      ): item is {
        itemOrder: number;
        whatIsCorrect: string[];
        whatIsIncorrect: string[];
        whatIsMissing: string[];
      } => item !== null
    );

  return {
    gradeRationale,
    reviewPriority,
    items,
  };
}

type AssessmentAiRunRow = {
  id: string;
  assessmentId: string;
  trigger: string;
  status: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  confidence: string | null;
  warnings: unknown;
  error: string | null;
  traceId: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssessmentRow = {
  id: string;
  attemptId: string;
  reviewerAccountId: string;
  autoCheckResult: unknown;
  autoCheckStatus: string;
  aiRecommendation: unknown;
  confidence: string | null;
  warnings: unknown;
  itemOverrides: unknown;
  latestAiRun: AssessmentAiRunRow | null;
  manualGrade: number | null;
  maxGrade: number | null;
  comment: string | null;
  status: string;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssessmentRowWithRun = AssessmentRow;

function toAssessmentDetail(row: AssessmentRow): AssessmentDetail {
  return {
    id: row.id,
    attemptId: row.attemptId,
    reviewerAccountId: row.reviewerAccountId,
    status: row.status as AssessmentDetail["status"],
    autoCheckStatus: row.autoCheckStatus as AssessmentDetail["autoCheckStatus"],
    autoCheckResult: row.autoCheckResult as AssessmentDetail["autoCheckResult"],
    aiRecommendation: row.aiRecommendation as AssessmentDetail["aiRecommendation"],
    latestAiRun: row.latestAiRun ? toAssessmentAiRunSummary(row.latestAiRun) : null,
    manualGrade: row.manualGrade,
    maxGrade: row.maxGrade,
    itemOverrides: ((row.itemOverrides as ItemScoreOverride[] | null) ?? []),
    comment: row.comment,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssessmentAiRunSummary(row: AssessmentAiRunRow): AssessmentAiRunSummary {
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    trigger: row.trigger as AssessmentAiRunSummary["trigger"],
    status: row.status as AssessmentAiRunSummary["status"],
    model: row.model,
    promptVersion: row.promptVersion,
    inputHash: row.inputHash,
    confidence: (row.confidence as ConfidenceLevel | null) ?? null,
    warnings: ((row.warnings as string[] | null) ?? []),
    error: row.error,
    traceId: row.traceId,
    queuedAt: row.queuedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

