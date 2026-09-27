import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockTx = {
  assignment: { update: vi.fn() },
  assignmentDistribution: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    assignment: { findUnique: vi.fn() },
    assignmentVersion: { findUnique: vi.fn() },
    account: { findMany: vi.fn() },
    formalEntityMember: { findMany: vi.fn() },
    targetGroupMember: { findMany: vi.fn() },
    practiceGroupMember: { findMany: vi.fn() },
    assignmentDistribution: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    assignmentRecipient: { findMany: vi.fn() },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import {
  createDistribution,
  listAssignableStudents,
  listDistributions,
  listStudentAssignments,
} from "@/modules/distribution/service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  assignment: { findUnique: ReturnType<typeof vi.fn> };
  assignmentVersion: { findUnique: ReturnType<typeof vi.fn> };
  account: { findMany: ReturnType<typeof vi.fn> };
  formalEntityMember: { findMany: ReturnType<typeof vi.fn> };
  targetGroupMember: { findMany: ReturnType<typeof vi.fn> };
  practiceGroupMember: { findMany: ReturnType<typeof vi.fn> };
  assignmentDistribution: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  assignmentRecipient: { findMany: ReturnType<typeof vi.fn> };
};

const fakeAssignment = {
  id: "asgn_01",
  ownerAccountId: "teacher_01",
  status: "PUBLISHABLE",
  title: "Test Assignment",
  currentVersionId: "ver_01",
};

const fakeVersion = {
  id: "ver_01",
  assignmentId: "asgn_01",
  versionNumber: 1,
};

const fakeStudents = [{ id: "student_01" }, { id: "student_02" }];

const fakeDistribution = {
  id: "dist_01",
  assignmentId: "asgn_01",
  versionId: "ver_01",
  creatorUserId: "teacher_01",
  deadline: null,
  status: "MANDATORY",
  isGraded: true,
  aiHelpMode: "NO_HELP",
  createdAt: new Date(),
  updatedAt: new Date(),
  recipients: [
    {
      id: "rec_01",
      recipientAccountId: "student_01",
      status: "PENDING",
      createdAt: new Date(),
      recipientAccount: { displayName: "Student 01" },
    },
    {
      id: "rec_02",
      recipientAccountId: "student_02",
      status: "PENDING",
      createdAt: new Date(),
      recipientAccount: { displayName: "Student 02" },
    },
  ],
  assignment: { title: "Test Assignment" },
};

describe("createDistribution", () => {
  beforeEach(() => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    mockPrisma.assignmentVersion.findUnique.mockResolvedValue(fakeVersion);
    mockPrisma.account.findMany.mockResolvedValue(fakeStudents);
    mockPrisma.formalEntityMember.findMany.mockResolvedValue([]);
    mockPrisma.targetGroupMember.findMany.mockResolvedValue([]);
    mockPrisma.practiceGroupMember.findMany.mockResolvedValue([]);
    mockTx.assignment.update.mockResolvedValue({ ...fakeAssignment, status: "ASSIGNED" });
    mockTx.assignmentDistribution.create.mockResolvedValue(fakeDistribution);
  });

  it("creates distribution and transitions assignment to ASSIGNED", async () => {
    const result = await createDistribution({
      assignmentId: "asgn_01",
      versionId: "ver_01",
      creatorUserId: "teacher_01",
      distributionStatus: "MANDATORY",
      isGraded: true,
      aiHelpMode: "NO_HELP",
      recipientUserIds: ["student_01", "student_02"],
    });

    expect(mockTx.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ASSIGNED" } })
    );
    expect(mockTx.assignmentDistribution.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("dist_01");
    expect(result.recipients).toHaveLength(2);
  });

  it("does not re-transition ASSIGNED assignment", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "ASSIGNED",
    });
    mockPrisma.account.findMany.mockResolvedValue([{ id: "student_01" }]);

    await createDistribution({
      assignmentId: "asgn_01",
      versionId: "ver_01",
      creatorUserId: "teacher_01",
      distributionStatus: "PRACTICE",
      isGraded: false,
      aiHelpMode: "GUIDED",
      recipientUserIds: ["student_01"],
    });

    expect(mockTx.assignment.update).not.toHaveBeenCalled();
  });

  it("throws ValidationError if assignment is DRAFT", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "DRAFT",
    });
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        creatorUserId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientUserIds: ["student_01"],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ForbiddenError if different teacher", async () => {
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        creatorUserId: "other_teacher",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientUserIds: ["student_01"],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when assignment not found", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null);
    await expect(
      createDistribution({
        assignmentId: "missing",
        versionId: "ver_01",
        creatorUserId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientUserIds: ["student_01"],
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError for GUIDED mode on mandatory graded", async () => {
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        creatorUserId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "GUIDED",
        recipientUserIds: ["student_01"],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("allows GUIDED mode for practice assignment", async () => {
    mockPrisma.account.findMany.mockResolvedValue([{ id: "student_01" }]);
    await createDistribution({
      assignmentId: "asgn_01",
      versionId: "ver_01",
      creatorUserId: "teacher_01",
      distributionStatus: "PRACTICE",
      isGraded: true,
      aiHelpMode: "GUIDED",
      recipientUserIds: ["student_01"],
    });
    expect(mockTx.assignmentDistribution.create).toHaveBeenCalledOnce();
  });

  it("throws ValidationError if no recipients provided", async () => {
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        creatorUserId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientUserIds: [],
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe("listDistributions", () => {
  it("returns only distributions for the given teacher", async () => {
    mockPrisma.assignmentDistribution.findMany.mockResolvedValue([fakeDistribution]);
    const result = await listDistributions("teacher_01");
    expect(result).toHaveLength(1);
    expect(mockPrisma.assignmentDistribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creatorAccountId: "teacher_01" } })
    );
  });
});

describe("listAssignableStudents", () => {
  it("returns active students for assignment selection", async () => {
    const rows = [
      {
        id: "student_01",
        displayName: "Student One",
        domain: "GLOBAL",
        organizationId: null,
        user: { email: "student1@ex.com" },
      },
    ];
    mockPrisma.account.findMany.mockResolvedValue(rows);

    const result = await listAssignableStudents();

    expect(result).toEqual([
      {
        id: "student_01",
        name: "Student One",
        email: "student1@ex.com",
        domain: "GLOBAL",
        organizationId: null,
      },
    ]);
    expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });
});

describe("listStudentAssignments", () => {
  it("returns only the student's recipient records", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      {
        id: "rec_01",
        distributionId: "dist_01",
        recipientAccountId: "student_01",
        status: "PENDING",
        createdAt: new Date(),
        distribution: {
          aiHelpMode: "NO_HELP",
          deadline: null,
          isGraded: true,
          status: "MANDATORY",
          assignment: { title: "Test Assignment" },
          creatorAccount: { displayName: "Teacher One" },
        },
        attempt: null,
      },
    ]);

    const result = await listStudentAssignments("student_01");
    expect(result).toHaveLength(1);
    expect(result[0].assignmentTitle).toBe("Test Assignment");
    expect(result[0].attemptStatus).toBeNull();
    expect(mockPrisma.assignmentRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipientAccountId: "student_01" } })
    );
  });
});

