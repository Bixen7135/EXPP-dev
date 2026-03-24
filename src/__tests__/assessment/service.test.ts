import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// â”€â”€ Mock Prisma â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findUnique: vi.fn(), findFirst: vi.fn() },
    assessment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assignmentDistribution: { findUnique: vi.fn() },
    assignmentRecipient: { findMany: vi.fn() },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import {
  getOrCreateAssessment,
  getAssessmentForTeacher,
  reviewAssessment,
  publishAssessment,
  getStudentResult,
} from "@/modules/assessment/service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  attempt: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  assessment: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  assignmentDistribution: { findUnique: ReturnType<typeof vi.fn> };
  assignmentRecipient: { findMany: ReturnType<typeof vi.fn> };
};

const fakeContent = {
  title: "Quiz",
  instructions: "Answer all.",
  items: [
    { order: 1, type: "MULTIPLE_CHOICE", question: "Q1?", options: ["A", "B"], expectedAnswer: "A" },
    { order: 2, type: "SHORT_ANSWER", question: "Q2?", expectedAnswer: "Paris" },
  ],
};

const fakeAttempt = {
  id: "att_01",
  learnerAccountId: "student_01",
  answers: [
    { itemOrder: 1, text: "A" },  // correct
    { itemOrder: 2, text: "Berlin" }, // incorrect
  ],
  submittedAt: new Date(),
  assessment: null,
  recipient: {
    distribution: { creatorAccountId: "teacher_01",
      version: { content: fakeContent },
    },
  },
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

// â”€â”€ getOrCreateAssessment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getOrCreateAssessment", () => {
  it("creates assessment with auto-check when none exists", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(fakeAttempt);
    mockPrisma.assessment.create.mockResolvedValue(fakeAssessment);

    const result = await getOrCreateAssessment("att_01", "teacher_01");

    expect(mockPrisma.assessment.create).toHaveBeenCalledOnce();
    expect(result.status).toBe("AUTO_CHECKED");
    expect(result.attemptId).toBe("att_01");
  });

  it("returns existing assessment without running auto-check again", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      ...fakeAttempt,
      assessment: fakeAssessment,
    });

    const result = await getOrCreateAssessment("att_01", "teacher_01");

    expect(mockPrisma.assessment.create).not.toHaveBeenCalled();
    expect(result.id).toBe("asmnt_01");
  });

  it("throws NotFoundError when attempt does not exist", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(null);
    await expect(getOrCreateAssessment("missing", "teacher_01")).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when attempt belongs to different teacher's distribution", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      ...fakeAttempt,
      recipient: {
        distribution: { creatorAccountId: "other_teacher" },
      },
    });
    await expect(getOrCreateAssessment("att_01", "teacher_01")).rejects.toThrow(ForbiddenError);
  });
});

// â”€â”€ getAssessmentForTeacher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getAssessmentForTeacher", () => {
  it("returns assessment for the owning teacher", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue(fakeAssessment);
    const result = await getAssessmentForTeacher("att_01", "teacher_01");
    expect(result.id).toBe("asmnt_01");
  });

  it("throws ForbiddenError for different teacher", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue(fakeAssessment);
    await expect(getAssessmentForTeacher("att_01", "other_teacher")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when assessment missing", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue(null);
    await expect(getAssessmentForTeacher("missing", "teacher_01")).rejects.toThrow(NotFoundError);
  });
});

// â”€â”€ reviewAssessment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("reviewAssessment", () => {
  const reviewed = { ...fakeAssessment, manualGrade: 8, maxGrade: 10, status: "REVIEWED", reviewedAt: new Date() };

  beforeEach(() => {
    mockPrisma.assessment.findUnique.mockResolvedValue(fakeAssessment);
    mockPrisma.assessment.update.mockResolvedValue(reviewed);
  });

  it("saves grade and transitions to REVIEWED", async () => {
    const result = await reviewAssessment("att_01", "teacher_01", {
      manualGrade: 8,
      maxGrade: 10,
      comment: "Good work",
    });
    expect(mockPrisma.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVIEWED", manualGrade: 8, maxGrade: 10 }),
      })
    );
    expect(result.status).toBe("REVIEWED");
  });

  it("throws ForbiddenError for different teacher", async () => {
    await expect(
      reviewAssessment("att_01", "other_teacher", { manualGrade: 5, maxGrade: 10 })
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws ValidationError when grade exceeds maxGrade", async () => {
    await expect(
      reviewAssessment("att_01", "teacher_01", { manualGrade: 15, maxGrade: 10 })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when trying to modify PUBLISHED assessment", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue({
      ...fakeAssessment,
      status: "PUBLISHED",
    });
    await expect(
      reviewAssessment("att_01", "teacher_01", { manualGrade: 5, maxGrade: 10 })
    ).rejects.toThrow(ValidationError);
  });
});

// â”€â”€ publishAssessment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("publishAssessment", () => {
  it("transitions REVIEWED assessment to PUBLISHED", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue({
      ...fakeAssessment,
      status: "REVIEWED",
      manualGrade: 8,
      maxGrade: 10,
    });
    mockPrisma.assessment.update.mockResolvedValue({
      ...fakeAssessment,
      status: "PUBLISHED",
      publishedAt: new Date(),
    });

    const result = await publishAssessment("att_01", "teacher_01");

    expect(mockPrisma.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      })
    );
    expect(result.status).toBe("PUBLISHED");
  });

  it("blocks publishing AUTO_CHECKED assessment directly", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue(fakeAssessment); // AUTO_CHECKED
    await expect(publishAssessment("att_01", "teacher_01")).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when already PUBLISHED", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue({
      ...fakeAssessment,
      status: "PUBLISHED",
    });
    await expect(publishAssessment("att_01", "teacher_01")).rejects.toThrow(ValidationError);
  });

  it("throws ForbiddenError for different teacher", async () => {
    mockPrisma.assessment.findUnique.mockResolvedValue(fakeAssessment);
    await expect(publishAssessment("att_01", "other_teacher")).rejects.toThrow(ForbiddenError);
  });
});

// â”€â”€ getStudentResult â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getStudentResult", () => {
  const publishedAssessment = {
    ...fakeAssessment,
    status: "PUBLISHED",
    manualGrade: 8,
    maxGrade: 10,
    comment: "Well done",
    publishedAt: new Date(),
  };

  it("returns published result for the owning student", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      learnerAccountId: "student_01",
      assessment: publishedAssessment,
    });

    const result = await getStudentResult("att_01", "student_01");
    expect(result.grade).toBe(8);
    expect(result.maxGrade).toBe(10);
    expect(result.comment).toBe("Well done");
  });

  it("throws NotFoundError when result is not yet published", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      learnerAccountId: "student_01",
      assessment: fakeAssessment, // AUTO_CHECKED, not PUBLISHED
    });
    await expect(getStudentResult("att_01", "student_01")).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when no assessment exists", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      learnerAccountId: "student_01",
      assessment: null,
    });
    await expect(getStudentResult("att_01", "student_01")).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError for wrong student", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      learnerAccountId: "student_01",
      assessment: publishedAssessment,
    });
    await expect(getStudentResult("att_01", "other_student")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when attempt does not exist", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(null);
    await expect(getStudentResult("missing", "student_01")).rejects.toThrow(NotFoundError);
  });
});
