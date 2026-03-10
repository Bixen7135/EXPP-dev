import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock Prisma ────────────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    assignmentRecipient: { findMany: vi.fn() },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import { getStudentAnalytics } from "@/modules/analytics/student";

const mockPrisma = prisma as unknown as {
  assignmentRecipient: { findMany: ReturnType<typeof vi.fn> };
};

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeRecipient = (opts: {
  status: "PENDING" | "ACTIVE" | "SUBMITTED";
  attemptStatus?: "DRAFT" | "SUBMITTED";
  assessmentStatus?: "AUTO_CHECKED" | "REVIEWED" | "PUBLISHED";
  manualGrade?: number;
  maxGrade?: number;
}) => ({
  id: "rec_" + Math.random().toString(36).slice(2),
  distributionId: "dist_01",
  status: opts.status,
  createdAt: new Date("2026-01-01"),
  distribution: {
    status: "MANDATORY",
    isGraded: true,
    aiHelpMode: "NO_HELP",
    deadline: null,
    assignment: { title: "Test Assignment" },
    teacher: { name: "Teacher T" },
  },
  attempt: opts.attemptStatus
    ? {
        status: opts.attemptStatus,
        assessment: opts.assessmentStatus
          ? {
              status: opts.assessmentStatus,
              manualGrade: opts.manualGrade ?? null,
              maxGrade: opts.maxGrade ?? null,
            }
          : null,
      }
    : null,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getStudentAnalytics", () => {
  it("returns correct totals for mixed statuses", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      makeRecipient({ status: "PENDING" }),
      makeRecipient({ status: "ACTIVE", attemptStatus: "DRAFT" }),
      makeRecipient({ status: "SUBMITTED", attemptStatus: "SUBMITTED" }),
    ]);

    const result = await getStudentAnalytics("student_01");

    expect(result.totals.total).toBe(3);
    expect(result.totals.notStarted).toBe(1);
    expect(result.totals.inProgress).toBe(1);
    expect(result.totals.submitted).toBe(1);
    expect(result.totals.resultsPublished).toBe(0);
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

    const result = await getStudentAnalytics("student_01");
    const a = result.assignments[0];

    expect(a.resultPublished).toBe(false);
    expect(a.grade).toBeNull();
    expect(a.maxGrade).toBeNull();
    expect(a.percentage).toBeNull();
  });

  it("returns empty analytics when student has no assignments", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([]);

    const result = await getStudentAnalytics("student_01");

    expect(result.assignments).toHaveLength(0);
    expect(result.totals.total).toBe(0);
  });

  it("sets attemptStatus null when no attempt exists (PENDING recipient)", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      makeRecipient({ status: "PENDING" }),
    ]);

    const result = await getStudentAnalytics("student_01");
    expect(result.assignments[0].attemptStatus).toBeNull();
  });
});
