import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignmentDistribution: { findMany: vi.fn() },
    assignmentRecipient: { findMany: vi.fn() },
    studentAnalyticsInsight: { findMany: vi.fn() },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import { getTeacherAnalytics } from "@/modules/analytics/teacher";

const mockPrisma = prisma as unknown as {
  assignmentDistribution: { findMany: ReturnType<typeof vi.fn> };
  assignmentRecipient: { findMany: ReturnType<typeof vi.fn> };
  studentAnalyticsInsight: { findMany: ReturnType<typeof vi.fn> };
};

const makeRecipient = (
  status: "PENDING" | "ACTIVE" | "SUBMITTED",
  helpAllowed = 0,
  helpBlocked = 0,
  assessmentPublished = false
) => ({
  id: Math.random().toString(36).slice(2),
  status,
  attempt:
    status === "PENDING"
      ? null
      : {
          submittedAt: new Date("2026-01-02"),
          helpRequests: [
            ...Array.from({ length: helpAllowed }, () => ({ status: "ALLOWED" })),
            ...Array.from({ length: helpBlocked }, () => ({ status: "BLOCKED" })),
          ],
          assessment: assessmentPublished
            ? {
                status: "PUBLISHED",
                manualGrade: 8,
                maxGrade: 10,
                publishedAt: new Date("2026-01-03"),
                aiRecommendation: null,
                autoCheckResult: null,
              }
            : {
                status: "AUTO_CHECKED",
                manualGrade: null,
                maxGrade: null,
                publishedAt: null,
                aiRecommendation: null,
                autoCheckResult: null,
              },
        },
});

const makeDistribution = (recipients: ReturnType<typeof makeRecipient>[]) => ({
  id: "dist_01",
  creatorAccountId: "teacher_01",
  aiHelpMode: "GUIDED",
  isGraded: false,
  status: "PRACTICE",
  deadline: null,
  createdAt: new Date("2026-01-01"),
  assignment: {
    title: "Test Assignment",
    tags: [],
    generationResult: null,
  },
  recipients,
});

function mockEmptyStudentInsights() {
  mockPrisma.assignmentRecipient.findMany.mockResolvedValue([]);
  mockPrisma.studentAnalyticsInsight.findMany.mockResolvedValue([]);
}

describe("getTeacherAnalytics", () => {
  it("counts recipients by status correctly", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([
      makeDistribution([
        makeRecipient("PENDING"),
        makeRecipient("ACTIVE"),
        makeRecipient("SUBMITTED"),
        makeRecipient("SUBMITTED"),
      ]),
    ]);
    mockEmptyStudentInsights();

    const result = await getTeacherAnalytics("teacher_01");
    const d = result.distributions[0];

    expect(d.totalRecipients).toBe(4);
    expect(d.notStarted).toBe(1);
    expect(d.started).toBe(1);
    expect(d.submitted).toBe(2);
  });

  it("aggregates AI help counts across recipients", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([
      makeDistribution([
        makeRecipient("SUBMITTED", 3, 1),
        makeRecipient("SUBMITTED", 0, 2),
      ]),
    ]);
    mockEmptyStudentInsights();

    const result = await getTeacherAnalytics("teacher_01");
    const d = result.distributions[0];

    expect(d.aiHelpAllowed).toBe(3);
    expect(d.aiHelpBlocked).toBe(3);
  });

  it("counts published results", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([
      makeDistribution([
        makeRecipient("SUBMITTED", 0, 0, true),
        makeRecipient("SUBMITTED", 0, 0, false),
      ]),
    ]);
    mockEmptyStudentInsights();

    const result = await getTeacherAnalytics("teacher_01");
    expect(result.distributions[0].publishedResults).toBe(1);
  });

  it("aggregates totals across multiple distributions", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([
      makeDistribution([makeRecipient("SUBMITTED"), makeRecipient("PENDING")]),
      makeDistribution([makeRecipient("ACTIVE")]),
    ]);
    mockEmptyStudentInsights();

    const result = await getTeacherAnalytics("teacher_01");

    expect(result.totals.distributions).toBe(2);
    expect(result.totals.recipients).toBe(3);
    expect(result.totals.submitted).toBe(1);
  });

  it("returns empty analytics when teacher has no distributions", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([]);
    mockEmptyStudentInsights();

    const result = await getTeacherAnalytics("teacher_01");

    expect(result.distributions).toHaveLength(0);
    expect(result.students).toHaveLength(0);
    expect(result.totals.distributions).toBe(0);
    expect(result.totals.recipients).toBe(0);
  });

  it("handles recipients with no attempt (PENDING) - no AI help counted", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([
      makeDistribution([makeRecipient("PENDING")]),
    ]);
    mockEmptyStudentInsights();

    const result = await getTeacherAnalytics("teacher_01");
    const d = result.distributions[0];

    expect(d.aiHelpAllowed).toBe(0);
    expect(d.aiHelpBlocked).toBe(0);
    expect(d.publishedResults).toBe(0);
  });
});
