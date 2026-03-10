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
    user: { findMany: vi.fn() },
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
  user: { findMany: ReturnType<typeof vi.fn> };
  assignmentDistribution: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  assignmentRecipient: { findMany: ReturnType<typeof vi.fn> };
};

const fakeAssignment = {
  id: "asgn_01",
  teacherId: "teacher_01",
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
  teacherId: "teacher_01",
  deadline: null,
  status: "MANDATORY",
  isGraded: true,
  aiHelpMode: "NO_HELP",
  createdAt: new Date(),
  updatedAt: new Date(),
  recipients: [
    { id: "rec_01", studentId: "student_01", status: "PENDING", createdAt: new Date() },
    { id: "rec_02", studentId: "student_02", status: "PENDING", createdAt: new Date() },
  ],
  assignment: { title: "Test Assignment" },
};

describe("createDistribution", () => {
  beforeEach(() => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    mockPrisma.assignmentVersion.findUnique.mockResolvedValue(fakeVersion);
    mockPrisma.user.findMany.mockResolvedValue(fakeStudents);
    mockTx.assignment.update.mockResolvedValue({ ...fakeAssignment, status: "ASSIGNED" });
    mockTx.assignmentDistribution.create.mockResolvedValue(fakeDistribution);
  });

  it("creates distribution and transitions assignment to ASSIGNED", async () => {
    const result = await createDistribution({
      assignmentId: "asgn_01",
      versionId: "ver_01",
      teacherId: "teacher_01",
      distributionStatus: "MANDATORY",
      isGraded: true,
      aiHelpMode: "NO_HELP",
      recipientStudentIds: ["student_01", "student_02"],
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
    mockPrisma.user.findMany.mockResolvedValue([{ id: "student_01" }]);

    await createDistribution({
      assignmentId: "asgn_01",
      versionId: "ver_01",
      teacherId: "teacher_01",
      distributionStatus: "PRACTICE",
      isGraded: false,
      aiHelpMode: "GUIDED",
      recipientStudentIds: ["student_01"],
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
        teacherId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientStudentIds: ["student_01"],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ForbiddenError if different teacher", async () => {
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        teacherId: "other_teacher",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientStudentIds: ["student_01"],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when assignment not found", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null);
    await expect(
      createDistribution({
        assignmentId: "missing",
        versionId: "ver_01",
        teacherId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientStudentIds: ["student_01"],
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError for GUIDED mode on mandatory graded", async () => {
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        teacherId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "GUIDED",
        recipientStudentIds: ["student_01"],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("allows GUIDED mode for practice assignment", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "student_01" }]);
    await createDistribution({
      assignmentId: "asgn_01",
      versionId: "ver_01",
      teacherId: "teacher_01",
      distributionStatus: "PRACTICE",
      isGraded: true,
      aiHelpMode: "GUIDED",
      recipientStudentIds: ["student_01"],
    });
    expect(mockTx.assignmentDistribution.create).toHaveBeenCalledOnce();
  });

  it("throws ValidationError if no recipients provided", async () => {
    await expect(
      createDistribution({
        assignmentId: "asgn_01",
        versionId: "ver_01",
        teacherId: "teacher_01",
        distributionStatus: "MANDATORY",
        isGraded: true,
        aiHelpMode: "NO_HELP",
        recipientStudentIds: [],
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
      expect.objectContaining({ where: { teacherId: "teacher_01" } })
    );
  });
});

describe("listAssignableStudents", () => {
  it("returns active students for assignment selection", async () => {
    const rows = [{ id: "student_01", name: "Student One", email: "student1@ex.com" }];
    mockPrisma.user.findMany.mockResolvedValue(rows);

    const result = await listAssignableStudents();

    expect(result).toEqual(rows);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "STUDENT", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
  });
});

describe("listStudentAssignments", () => {
  it("returns only the student's recipient records", async () => {
    mockPrisma.assignmentRecipient.findMany.mockResolvedValue([
      {
        id: "rec_01",
        distributionId: "dist_01",
        studentId: "student_01",
        status: "PENDING",
        createdAt: new Date(),
        distribution: {
          aiHelpMode: "NO_HELP",
          deadline: null,
          isGraded: true,
          status: "MANDATORY",
          assignment: { title: "Test Assignment" },
          teacher: { name: "Teacher One" },
        },
        attempt: null,
      },
    ]);

    const result = await listStudentAssignments("student_01");
    expect(result).toHaveLength(1);
    expect(result[0].assignmentTitle).toBe("Test Assignment");
    expect(result[0].attemptStatus).toBeNull();
    expect(mockPrisma.assignmentRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: "student_01" } })
    );
  });
});
