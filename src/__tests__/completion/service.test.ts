import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Prisma ────────────────────────────────────────────────────────────

const mockTx = {
  attempt: { create: vi.fn(), update: vi.fn() },
  assignmentRecipient: { update: vi.fn() },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    assignmentRecipient: { findUnique: vi.fn() },
    attempt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import { getOrCreateAttempt, saveDraft, submitAttempt, getAttempt } from "@/modules/completion/service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  assignmentRecipient: { findUnique: ReturnType<typeof vi.fn> };
  attempt: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const fakeDistContext = {
  aiHelpMode: "NO_HELP",
  deadline: null,
  isGraded: true,
  status: "MANDATORY",
  version: {
    content: {
      title: "Photosynthesis Quiz",
      instructions: "Answer all questions.",
      items: [
        {
          order: 1,
          type: "SHORT_ANSWER",
          question: "What is photosynthesis?",
          expectedAnswer: "The process by which plants use sunlight",
        },
      ],
    },
  },
};

const fakeRecipient = {
  id: "rec_01",
  recipientAccountId: "student_01",
  distributionId: "dist_01",
  status: "PENDING",
  distribution: fakeDistContext,
  attempt: null,
};

const fakeAttempt = {
  id: "att_01",
  recipientId: "rec_01",
  learnerAccountId: "student_01",
  answers: [],
  status: "DRAFT",
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  recipient: { distribution: fakeDistContext },
};

// ── getOrCreateAttempt ────────────────────────────────────────────────────

describe("getOrCreateAttempt", () => {
  it("creates a new attempt on first access", async () => {
    mockPrisma.assignmentRecipient.findUnique.mockResolvedValue(fakeRecipient);
    mockTx.attempt.create.mockResolvedValue(fakeAttempt);
    mockTx.assignmentRecipient.update.mockResolvedValue({});

    const result = await getOrCreateAttempt("rec_01", "student_01");

    expect(mockTx.attempt.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("att_01");
    expect(result.status).toBe("DRAFT");
  });

  it("returns existing attempt without creating a new one", async () => {
    mockPrisma.assignmentRecipient.findUnique.mockResolvedValue({
      ...fakeRecipient,
      attempt: fakeAttempt,
    });

    const result = await getOrCreateAttempt("rec_01", "student_01");

    expect(mockTx.attempt.create).not.toHaveBeenCalled();
    expect(result.id).toBe("att_01");
  });

  it("throws NotFoundError when recipient does not exist", async () => {
    mockPrisma.assignmentRecipient.findUnique.mockResolvedValue(null);
    await expect(getOrCreateAttempt("missing", "student_01")).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when student is not the recipient", async () => {
    mockPrisma.assignmentRecipient.findUnique.mockResolvedValue(fakeRecipient);
    await expect(getOrCreateAttempt("rec_01", "other_student")).rejects.toThrow(ForbiddenError);
  });
});

// ── saveDraft ─────────────────────────────────────────────────────────────

describe("saveDraft", () => {
  const newAnswers = [{ itemOrder: 1, text: "My answer" }];

  beforeEach(() => {
    mockPrisma.attempt.findUnique.mockResolvedValue(fakeAttempt);
    mockPrisma.attempt.update.mockResolvedValue({
      ...fakeAttempt,
      answers: newAnswers,
      recipient: { distribution: fakeDistContext },
    });
  });

  it("saves draft answers", async () => {
    const result = await saveDraft("att_01", "student_01", newAnswers);
    expect(mockPrisma.attempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "att_01" },
        data: expect.objectContaining({ answers: newAnswers }),
      })
    );
    expect(result.answers).toEqual(newAnswers);
  });

  it("throws ForbiddenError when different student tries to save", async () => {
    await expect(saveDraft("att_01", "other_student", newAnswers)).rejects.toThrow(ForbiddenError);
  });

  it("throws ValidationError when attempt is SUBMITTED", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      ...fakeAttempt,
      status: "SUBMITTED",
    });
    await expect(saveDraft("att_01", "student_01", newAnswers)).rejects.toThrow(ValidationError);
  });
});

// ── submitAttempt ─────────────────────────────────────────────────────────

describe("submitAttempt", () => {
  const submittedAt = new Date();

  beforeEach(() => {
    mockPrisma.attempt.findUnique.mockResolvedValue(fakeAttempt);
    mockTx.attempt.update.mockResolvedValue({
      ...fakeAttempt,
      status: "SUBMITTED",
      submittedAt,
      recipient: { distribution: fakeDistContext },
    });
    mockTx.assignmentRecipient.update.mockResolvedValue({});
  });

  it("transitions attempt to SUBMITTED", async () => {
    const result = await submitAttempt("att_01", "student_01");
    expect(mockTx.attempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUBMITTED" }),
      })
    );
    expect(result.status).toBe("SUBMITTED");
    expect(result.submittedAt).toBeDefined();
  });

  it("marks recipient as SUBMITTED", async () => {
    await submitAttempt("att_01", "student_01");
    expect(mockTx.assignmentRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SUBMITTED" } })
    );
  });

  it("throws ValidationError when attempt is already SUBMITTED", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue({
      ...fakeAttempt,
      status: "SUBMITTED",
    });
    await expect(submitAttempt("att_01", "student_01")).rejects.toThrow(ValidationError);
  });

  it("throws ForbiddenError when different student submits", async () => {
    await expect(submitAttempt("att_01", "other_student")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when attempt does not exist", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(null);
    await expect(submitAttempt("missing", "student_01")).rejects.toThrow(NotFoundError);
  });
});

// ── getAttempt ────────────────────────────────────────────────────────────

describe("getAttempt", () => {
  it("returns attempt detail for the owning student", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(fakeAttempt);
    const result = await getAttempt("att_01", "student_01");
    expect(result.id).toBe("att_01");
    expect(result.assignmentContent.title).toBe("Photosynthesis Quiz");
    // Expected answers stripped from items
    const item = result.assignmentContent.items[0] as { expectedAnswer?: string };
    expect(item.expectedAnswer).toBeUndefined();
  });

  it("throws ForbiddenError for a different student", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(fakeAttempt);
    await expect(getAttempt("att_01", "other_student")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when attempt does not exist", async () => {
    mockPrisma.attempt.findUnique.mockResolvedValue(null);
    await expect(getAttempt("missing", "student_01")).rejects.toThrow(NotFoundError);
  });
});
