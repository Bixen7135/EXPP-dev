import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { auditLog } from "@/lib/audit/logger";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import type { AssignmentContent, AssignmentItemContent, RubricCriterion } from "@/modules/assignments/types";
import type { AttemptAnswer } from "@/modules/completion/types";
import { autoCheck } from "./auto-check";
import { analyzeAttemptWithAi, ASSESSMENT_AI_PROMPT_VERSION } from "./ai-analysis";
import { enqueueAssessmentAiJob } from "./queue";
import type {
  AssessmentDetail,
  StudentResult,
  AssessmentAiRunSummary,
  AssessmentAiRunTrigger,
  ItemScoreOverride,
  ConfidenceLevel,
} from "./types";

const DEFAULT_AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

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

  const traceId = opts.traceId || run.traceId || "unknown";
  console.info("[assessment-ai] processing started", {
    runId: run.id,
    assessmentId: run.assessmentId,
    attemptId: run.assessment.attemptId,
    trigger: run.trigger,
    traceId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.assessmentAiRun.update({
      where: { id: run.id },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
      },
    });

    await tx.assessment.update({
      where: { id: run.assessmentId },
      data: {
        autoCheckStatus: "PROCESSING",
        latestAiRunId: run.id,
      },
    });
  });

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
          maxGrade: run.assessment.maxGrade ?? recommendation.maxTotal,
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

  await enqueueAssessmentAiJob({
    runId: run.id,
    assessmentId: opts.assessmentId,
    attemptId: opts.attemptId,
    reviewerAccountId: opts.reviewerAccountId,
    trigger: opts.trigger,
    traceId: opts.traceId,
    idempotencyKey: `${opts.assessmentId}:${inputHash}:${opts.trigger}`,
  });

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
      maxScore: item.maxScore ?? 1,
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
  const maxScore =
    typeof item.maxScore === "number" && Number.isFinite(item.maxScore) && item.maxScore > 0
      ? item.maxScore
      : 1;

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

