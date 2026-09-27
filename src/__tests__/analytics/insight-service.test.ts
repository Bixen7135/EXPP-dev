import { describe, expect, it, vi } from "vitest";
import type { AnalyticsRow } from "@/modules/analytics/insight-service";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/ai/gateway", () => ({ aiGenerate: vi.fn() }));
vi.mock("@/lib/ai/models", () => ({ resolveAiModel: vi.fn(() => "test-model") }));
vi.mock("@/modules/analytics/insight-auto-worker", () => ({
  ensureStudentAnalyticsInsightWorkerAutoStarted: vi.fn(),
}));
vi.mock("@/modules/analytics/insight-queue", () => ({
  enqueueStudentAnalyticsInsightJob: vi.fn(),
}));

import {
  buildInsightScopes,
  calculateOverview,
  resolveSubjectFromAssignmentContext,
} from "@/modules/analytics/insight-service";

function makeRow(partial: Partial<AnalyticsRow>): AnalyticsRow {
  return {
    recipientId: "rec_1",
    assignmentTitle: "A1",
    distributionId: "dist_1",
    deadline: null,
    recipientStatus: "SUBMITTED",
    teacherId: "teacher_1",
    teacherName: "Teacher 1",
    subjectKey: "math",
    subjectLabel: "Math",
    submittedAt: new Date("2026-01-02T00:00:00.000Z"),
    attemptStatus: "SUBMITTED",
    helpRequestStatuses: [],
    assessmentStatus: "PUBLISHED",
    manualGrade: 8,
    maxGrade: 10,
    publishedAt: new Date("2026-01-03T00:00:00.000Z"),
    itemScores: [],
    ...partial,
  };
}

describe("resolveSubjectFromAssignmentContext", () => {
  it("uses assignment subject tag first", () => {
    const result = resolveSubjectFromAssignmentContext({
      tags: [{ key: "subject", value: "Mathematics" }],
      generationConstraints: { topic: "History" },
    });

    expect(result.subjectKey).toBe("mathematics");
    expect(result.subjectLabel).toBe("Mathematics");
  });

  it("falls back to generation topic then default", () => {
    const fromTopic = resolveSubjectFromAssignmentContext({
      tags: [],
      generationConstraints: { topic: "Physics" },
    });
    const defaultSubject = resolveSubjectFromAssignmentContext({
      tags: [],
      generationConstraints: null,
    });

    expect(fromTopic.subjectKey).toBe("physics");
    expect(fromTopic.subjectLabel).toBe("Physics");
    expect(defaultSubject.subjectKey).toBe("\u043E\u0431\u0449\u0438\u0439");
    expect(defaultSubject.subjectLabel).toBe("\u041E\u0431\u0449\u0438\u0439");
  });
});

describe("buildInsightScopes", () => {
  it("builds four unique scope combinations", () => {
    const scopes = buildInsightScopes({
      learnerAccountId: "student_1",
      teacherAccountId: "teacher_1",
      subjectKey: "math",
    });

    expect(scopes).toHaveLength(4);
    expect(scopes).toEqual(
      expect.arrayContaining([
        {
          learnerAccountId: "student_1",
          teacherAccountId: null,
          subjectKey: null,
          period: "all_time",
        },
        {
          learnerAccountId: "student_1",
          teacherAccountId: "teacher_1",
          subjectKey: null,
          period: "all_time",
        },
        {
          learnerAccountId: "student_1",
          teacherAccountId: null,
          subjectKey: "math",
          period: "all_time",
        },
        {
          learnerAccountId: "student_1",
          teacherAccountId: "teacher_1",
          subjectKey: "math",
          period: "all_time",
        },
      ])
    );
  });
});

describe("calculateOverview", () => {
  it("calculates 360 metrics from mixed rows", () => {
    const rows: AnalyticsRow[] = [
      makeRow({
        recipientId: "rec_1",
        deadline: new Date("2026-01-04T00:00:00.000Z"),
        submittedAt: new Date("2026-01-03T00:00:00.000Z"),
        manualGrade: 8,
        maxGrade: 10,
        publishedAt: new Date("2026-01-04T00:00:00.000Z"),
        helpRequestStatuses: ["ALLOWED"],
        itemScores: [{ type: "SHORT_ANSWER", ratio: 0.6 }],
      }),
      makeRow({
        recipientId: "rec_2",
        deadline: new Date("2026-01-05T00:00:00.000Z"),
        submittedAt: new Date("2026-01-06T00:00:00.000Z"),
        manualGrade: 6,
        maxGrade: 10,
        publishedAt: new Date("2026-01-10T00:00:00.000Z"),
        helpRequestStatuses: ["BLOCKED"],
        itemScores: [{ type: "SHORT_ANSWER", ratio: 0.5 }],
      }),
      makeRow({
        recipientId: "rec_3",
        recipientStatus: "ACTIVE",
        attemptStatus: "DRAFT",
        submittedAt: null,
        assessmentStatus: null,
        manualGrade: null,
        maxGrade: null,
        publishedAt: null,
      }),
    ];

    const overview = calculateOverview(rows);

    expect(overview.avgPercent).toBe(70);
    expect(overview.completionRate).toBe(66.7);
    expect(overview.publishedCount).toBe(2);
    expect(overview.onTimeRate).toBe(50);
    expect(overview.trendDelta).toBe(-20);
    expect(overview.weakQuestionTypes[0]).toMatchObject({
      type: "SHORT_ANSWER",
      lowCount: 2,
      total: 2,
      lowRate: 100,
    });
    expect(overview.aiHelpUsage).toEqual({ allowed: 1, blocked: 1, total: 2 });
  });
});
