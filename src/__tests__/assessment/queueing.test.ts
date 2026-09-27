import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findUnique: vi.fn() },
    assessment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assessmentAiRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    assignmentDistribution: { findUnique: vi.fn() },
    assignmentRecipient: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/audit/logger", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/assessment/queue", () => ({
  enqueueAssessmentAiJob: vi.fn().mockResolvedValue(undefined),
  removeAssessmentAiJob: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/modules/assessment/auto-worker", () => ({
  ensureAssessmentWorkerAutoStarted: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db/prisma";
import { QueueUnavailableError } from "@/lib/errors";
import {
  enqueueAssessmentAiJob,
  removeAssessmentAiJob,
} from "@/modules/assessment/queue";
import { ensureAssessmentWorkerAutoStarted } from "@/modules/assessment/auto-worker";
import {
  cancelAssessmentAnalysis,
  queueAutoAnalysisForAttempt,
  triggerAssessmentAnalysis,
} from "@/modules/assessment/service";

const fakeContent = {
  title: "Quiz",
  instructions: "Answer all.",
  items: [
    { order: 1, type: "MULTIPLE_CHOICE", question: "Q1?", options: ["A", "B"], expectedAnswer: "A" },
    { order: 2, type: "SHORT_ANSWER", question: "Q2?", expectedAnswer: "Paris" },
  ],
};

const fakeAssessment = {
  id: "asmnt_01",
  attemptId: "att_01",
  reviewerAccountId: "teacher_01",
  autoCheckResult: { items: [], autoScore: 1, autoMaxScore: 2 },
  autoCheckStatus: "NOT_STARTED",
  aiRecommendation: null,
  confidence: null,
  warnings: null,
  itemOverrides: [],
  latestAiRun: null,
  manualGrade: null,
  maxGrade: null,
  comment: null,
  status: "AUTO_CHECKED",
  reviewedAt: null,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const submittedAttemptContext = {
  id: "att_01",
  status: "SUBMITTED",
  updatedAt: new Date("2026-03-26T08:00:00.000Z"),
  answers: [
    { itemOrder: 1, text: "A" },
    { itemOrder: 2, text: "Paris" },
  ],
  recipient: {
    distribution: {
      creatorAccountId: "teacher_01",
      version: { content: fakeContent },
    },
  },
  assessment: fakeAssessment,
};

const mockPrisma = prisma as unknown as {
  attempt: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  assessment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  assessmentAiRun: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("assessment queueing behavior", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalTimeout = process.env.ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS;

  beforeEach(() => {
    delete mutableEnv.ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS;

    mockPrisma.attempt.findUnique.mockResolvedValue(submittedAttemptContext);
    mockPrisma.assessmentAiRun.findFirst.mockResolvedValue(null);
    mockPrisma.assessmentAiRun.create.mockResolvedValue({ id: "run_01" });
    mockPrisma.assessmentAiRun.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.assessment.update.mockResolvedValue({});
    mockPrisma.assessment.findUnique.mockResolvedValue({
      ...fakeAssessment,
      id: "asmnt_01",
      autoCheckStatus: "QUEUED",
    });
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        assessmentAiRun: {
          updateMany: mockPrisma.assessmentAiRun.updateMany,
        },
        assessment: {
          update: mockPrisma.assessment.update,
        },
      })
    );
  });

  afterEach(() => {
    mutableEnv.ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS = originalTimeout;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("throws QueueUnavailableError on Redis connectivity failure for manual analyze", async () => {
    const queueError = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
    vi.mocked(enqueueAssessmentAiJob).mockRejectedValueOnce(queueError);

    await expect(
      triggerAssessmentAnalysis("att_01", "teacher_01", "trace-1")
    ).rejects.toBeInstanceOf(QueueUnavailableError);

    expect(ensureAssessmentWorkerAutoStarted).toHaveBeenCalledOnce();
  });

  it("throws QueueUnavailableError fast on enqueue timeout for manual analyze", async () => {
    mutableEnv.ASSESSMENT_AI_ENQUEUE_TIMEOUT_MS = "5";
    vi.mocked(enqueueAssessmentAiJob).mockImplementationOnce(
      () => new Promise<void>(() => undefined)
    );

    vi.useFakeTimers();
    const pending = triggerAssessmentAnalysis("att_01", "teacher_01", "trace-timeout");
    const assertion = expect(pending).rejects.toBeInstanceOf(QueueUnavailableError);
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it("reuses active run and does not enqueue duplicates", async () => {
    mockPrisma.assessmentAiRun.findFirst.mockResolvedValueOnce({
      id: "run_existing",
      status: "QUEUED",
      createdAt: new Date(),
    });
    mockPrisma.assessment.findUnique.mockResolvedValueOnce({
      ...fakeAssessment,
      autoCheckStatus: "QUEUED",
      latestAiRun: {
        id: "run_existing",
        assessmentId: "asmnt_01",
        trigger: "MANUAL_RERUN",
        status: "QUEUED",
        model: "gpt-4o-mini",
        promptVersion: "assessment-v1",
        inputHash: "hash",
        confidence: null,
        warnings: [],
        error: null,
        traceId: "trace-2",
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await triggerAssessmentAnalysis("att_01", "teacher_01", "trace-2");

    expect(result.autoCheckStatus).toBe("QUEUED");
    expect(mockPrisma.assessmentAiRun.create).not.toHaveBeenCalled();
    expect(enqueueAssessmentAiJob).not.toHaveBeenCalled();
  });

  it("skips auto-queue when attempt is not submitted", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValueOnce({
      ...submittedAttemptContext,
      status: "DRAFT",
    });

    await queueAutoAnalysisForAttempt("att_01", "trace-3");

    expect(mockPrisma.assessmentAiRun.create).not.toHaveBeenCalled();
    expect(enqueueAssessmentAiJob).not.toHaveBeenCalled();
  });

  it("cancels queued analysis run and marks assessment as failed", async () => {
    const latestAiRun = {
      id: "run_cancel_1",
      assessmentId: "asmnt_01",
      trigger: "AUTO_ON_SUBMIT",
      status: "QUEUED",
      model: "gpt-4o-mini",
      promptVersion: "assessment-v1",
      inputHash: "hash",
      confidence: null,
      warnings: [],
      error: null,
      traceId: "trace-cancel",
      queuedAt: new Date(),
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.assessment.findUnique
      .mockResolvedValueOnce({
        ...fakeAssessment,
        latestAiRun,
      })
      .mockResolvedValueOnce({
        ...fakeAssessment,
        autoCheckStatus: "FAILED",
        warnings: ["AI analysis cancelled by teacher"],
        latestAiRun: {
          ...latestAiRun,
          status: "FAILED",
          error: "AI analysis cancelled by teacher",
          completedAt: new Date(),
        },
      });

    const result = await cancelAssessmentAnalysis("att_01", "teacher_01", "trace-cancel");

    expect(result.autoCheckStatus).toBe("FAILED");
    expect(removeAssessmentAiJob).toHaveBeenCalledWith("run_cancel_1");
    expect(mockPrisma.assessmentAiRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "run_cancel_1",
        }),
      })
    );
  });

  it("returns unchanged assessment when no active run exists for cancellation", async () => {
    const readyAssessment = {
      ...fakeAssessment,
      autoCheckStatus: "READY",
      latestAiRun: {
        id: "run_ready",
        assessmentId: "asmnt_01",
        trigger: "AUTO_ON_SUBMIT",
        status: "READY",
        model: "gpt-4o-mini",
        promptVersion: "assessment-v1",
        inputHash: "hash",
        confidence: "HIGH",
        warnings: [],
        error: null,
        traceId: "trace-ready",
        queuedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    mockPrisma.assessment.findUnique.mockResolvedValueOnce(readyAssessment);

    const result = await cancelAssessmentAnalysis("att_01", "teacher_01", "trace-ready");

    expect(result.autoCheckStatus).toBe("READY");
    expect(mockPrisma.assessmentAiRun.updateMany).not.toHaveBeenCalled();
    expect(removeAssessmentAiJob).not.toHaveBeenCalled();
  });
});
