import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignmentRecipient: { findMany: vi.fn() },
    studentAnalyticsInsight: { findFirst: vi.fn() },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import { getStudentAnalytics } from "@/modules/analytics/student";

const mockPrisma = prisma as unknown as {
  assignmentRecipient: { findMany: ReturnType<typeof vi.fn> };
  studentAnalyticsInsight: { findFirst: ReturnType<typeof vi.fn> };
};

let recipientCounter = 0;
const makeRecipient = (opts: {
  status: "PENDING" | "ACTIVE" | "SUBMITTED";
  attemptStatus?: "DRAFT" | "SUBMITTED";
  assessmentStatus?: "AUTO_CHECKED" | "REVIEWED" | "PUBLISHED";
  manualGrade?: number;
  maxGrade?: number;
}) => {
  recipientCounter += 1;
  return {
    id: `rec_${recipientCounter}`,
    distributionId: "dist_01",
    status: opts.status,
    createdAt: new Date("2026-01-01"),
    distribution: {
      creatorAccountId: "teacher_01",
      status: "MANDATORY",
      isGraded: true,
      aiHelpMode: "NO_HELP",
      deadline: null,
      creatorAccount: { id: "teacher_01", displayName: "Teacher T" },
      version: {
        content: { items: [{ order: 1, type: "SHORT_ANSWER" }] },
      },
      assignment: {
        title: "Test Assignment",
        tags: [],
        generationResult: null,
      },
    },
    attempt: opts.attemptStatus
      ? {
          status: opts.attemptStatus,
          submittedAt: new Date("2026-01-02"),
          helpRequests: [],
          assessment: opts.assessmentStatus
            ? {
                status: opts.assessmentStatus,
                manualGrade: opts.manualGrade ?? null,
                maxGrade: opts.maxGrade ?? null,
                publishedAt:
                  opts.assessmentStatus === "PUBLISHED"
                    ? new Date("2026-01-03")
                    : null,
                aiRecommendation: null,
                autoCheckResult: null,
              }
            : null,
        }
      : null,
  };
};

describe("getStudentAnalytics", () => {
  it("returns correct totals for mixed statuses", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      makeRecipient({ status: "PENDING" }),
      makeRecipient({ status: "ACTIVE", attemptStatus: "DRAFT" }),
      makeRecipient({ status: "SUBMITTED", attemptStatus: "SUBMITTED" }),
    ]);
    mockPrisma.studentAnalyticsInsight.findFirst.mockResolvedValue(null);

    const result = await getStudentAnalytics("student_01");

    expect(result.totals.total).toBe(3);
    expect(result.totals.notStarted).toBe(1);
    expect(result.totals.inProgress).toBe(1);
    expect(result.totals.submitted).toBe(1);
    expect(result.totals.resultsPublished).toBe(0);
    expect(result.recommendationStatus).toBe("INSUFFICIENT_DATA");
  });

  it("includes grade when assessment is PUBLISHED", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      makeRecipient({
        status: "SUBMITTED",
        attemptStatus: "SUBMITTED",
        assessmentStatus: "PUBLISHED",
        manualGrade: 8,
        maxGrade: 10,
      }),
    ]);
    mockPrisma.studentAnalyticsInsight.findFirst.mockResolvedValue({
      status: "READY",
      recommendationJson: {
        summary: "keep it up",
        improvementAreas: [],
        studyPlan: [],
        confidence: "MEDIUM",
        evidenceRefs: [],
        generatedAt: "2026-01-03T00:00:00.000Z",
      },
    });

    const result = await getStudentAnalytics("student_01");
    const a = result.assignments[0];

    expect(a.resultPublished).toBe(true);
    expect(a.grade).toBe(8);
    expect(a.maxGrade).toBe(10);
    expect(a.percentage).toBe(80);
    expect(result.totals.resultsPublished).toBe(1);
  });

  it("does not expose grade when assessment is not PUBLISHED", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      makeRecipient({
        status: "SUBMITTED",
        attemptStatus: "SUBMITTED",
        assessmentStatus: "AUTO_CHECKED",
        manualGrade: 7,
        maxGrade: 10,
      }),
    ]);
    mockPrisma.studentAnalyticsInsight.findFirst.mockResolvedValue(null);

    const result = await getStudentAnalytics("student_01");
    const a = result.assignments[0];

    expect(a.resultPublished).toBe(false);
    expect(a.grade).toBeNull();
    expect(a.maxGrade).toBeNull();
    expect(a.percentage).toBeNull();
  });

  it("returns empty analytics when student has no assignments", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([]);
    mockPrisma.studentAnalyticsInsight.findFirst.mockResolvedValue(null);

    const result = await getStudentAnalytics("student_01");

    expect(result.assignments).toHaveLength(0);
    expect(result.totals.total).toBe(0);
    expect(result.overview.totalAssignments).toBe(0);
    expect(result.recommendationStatus).toBe("INSUFFICIENT_DATA");
  });

  it("sets attemptStatus null when no attempt exists (PENDING recipient)", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      makeRecipient({ status: "PENDING" }),
    ]);
    mockPrisma.studentAnalyticsInsight.findFirst.mockResolvedValue(null);

    const result = await getStudentAnalytics("student_01");
    expect(result.assignments[0].attemptStatus).toBeNull();
  });
});
