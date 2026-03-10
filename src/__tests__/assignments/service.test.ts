import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Prisma ─────────────────────────────────────────────────────────────

const mockTx = {
  assignment: {
    create: vi.fn(),
    update: vi.fn(),
  },
  assignmentVersion: {
    create: vi.fn(),
    count: vi.fn(),
  },
  assignmentItem: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    generationResult: { findUnique: vi.fn() },
    assignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    assignmentVersion: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    assignmentItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { prisma } from "@/lib/db/prisma";
import {
  createAssignment,
  listAssignments,
  getAssignment,
  getAssignmentVersion,
  updateAssignment,
  restoreVersion,
  publishAssignment,
  deleteAssignment,
} from "@/modules/assignments/service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  generationResult: { findUnique: ReturnType<typeof vi.fn> };
  assignment: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  assignmentVersion: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  assignmentItem: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

const fakeContent = {
  title: "Photosynthesis Quiz",
  instructions: "Answer all questions.",
  items: [
    { order: 1, type: "SHORT_ANSWER" as const, question: "What is photosynthesis?", expectedAnswer: "The process by which plants use sunlight" },
  ],
};

const fakeGenResult = {
  id: "genres_01",
  content: fakeContent,
  request: { teacherId: "teacher_01" },
};

const fakeAssignment = {
  id: "asgn_01",
  teacherId: "teacher_01",
  generationResultId: "genres_01",
  title: fakeContent.title,
  content: fakeContent,
  status: "DRAFT",
  currentVersionId: "ver_01",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeVersion = {
  id: "ver_01",
  assignmentId: "asgn_01",
  versionNumber: 1,
  content: fakeContent,
  authorId: "teacher_01",
  changeDescription: "Initial version from generation",
  createdAt: new Date(),
};

// ── createAssignment ─────────────────────────────────────────────────────────

describe("createAssignment", () => {
  beforeEach(() => {
    mockPrisma.generationResult.findUnique.mockResolvedValue(fakeGenResult);
    mockTx.assignment.create.mockResolvedValue(fakeAssignment);
    mockTx.assignmentVersion.create.mockResolvedValue(fakeVersion);
    mockTx.assignmentItem.deleteMany.mockResolvedValue({ count: 0 });
    mockTx.assignmentItem.createMany.mockResolvedValue({ count: 1 });
    mockTx.assignment.update.mockResolvedValue({
      ...fakeAssignment,
      currentVersionId: "ver_01",
      versions: [fakeVersion],
    });
  });

  it("creates assignment from generation result for the owning teacher", async () => {
    const result = await createAssignment({
      teacherId: "teacher_01",
      generationResultId: "genres_01",
    });

    expect(mockPrisma.generationResult.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "genres_01" } })
    );
    expect(mockTx.assignment.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("asgn_01");
    expect(result.status).toBe("DRAFT");
  });

  it("throws NotFoundError when generation result does not exist", async () => {
    mockPrisma.generationResult.findUnique.mockResolvedValue(null);
    await expect(
      createAssignment({ teacherId: "teacher_01", generationResultId: "missing" })
    ).rejects.toThrow(NotFoundError);
    expect(mockTx.assignment.create).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when generation result belongs to a different teacher", async () => {
    mockPrisma.generationResult.findUnique.mockResolvedValue({
      ...fakeGenResult,
      request: { teacherId: "other_teacher" },
    });
    await expect(
      createAssignment({ teacherId: "teacher_01", generationResultId: "genres_01" })
    ).rejects.toThrow(ForbiddenError);
  });
});

// ── listAssignments ───────────────────────────────────────────────────────────

describe("listAssignments", () => {
  it("returns only assignments for the given teacher", async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([fakeAssignment]);
    const result = await listAssignments("teacher_01");
    expect(result).toHaveLength(1);
    expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: "teacher_01" } })
    );
  });
});

// ── getAssignment ─────────────────────────────────────────────────────────────

describe("getAssignment", () => {
  it("returns assignment with versions for the owning teacher", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      versions: [fakeVersion],
    });
    const result = await getAssignment("asgn_01", "teacher_01");
    expect(result.id).toBe("asgn_01");
    expect(result.versions).toHaveLength(1);
  });

  it("throws ForbiddenError when a different teacher requests it", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      versions: [],
    });
    await expect(getAssignment("asgn_01", "other_teacher")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when assignment does not exist", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null);
    await expect(getAssignment("missing", "teacher_01")).rejects.toThrow(NotFoundError);
  });
});

// ── updateAssignment ─────────────────────────────────────────────────────────

describe("updateAssignment", () => {
  const newContent = { ...fakeContent, title: "Updated Title" };

  beforeEach(() => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    mockTx.assignmentVersion.count.mockResolvedValue(1);
    mockTx.assignmentVersion.create.mockResolvedValue({ ...fakeVersion, id: "ver_02", versionNumber: 2 });
    mockTx.assignmentItem.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.assignmentItem.createMany.mockResolvedValue({ count: 1 });
    mockTx.assignment.update.mockResolvedValue({
      ...fakeAssignment,
      title: newContent.title,
      content: newContent,
      currentVersionId: "ver_02",
      versions: [
        { ...fakeVersion, id: "ver_02", versionNumber: 2 },
        fakeVersion,
      ],
    });
  });

  it("creates a new version and updates assignment content", async () => {
    const result = await updateAssignment("asgn_01", "teacher_01", newContent, "Fixed typo");
    expect(mockTx.assignmentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 2,
          changeDescription: "Fixed typo",
        }),
      })
    );
    expect(result.title).toBe("Updated Title");
  });

  it("reverts PUBLISHABLE status to DRAFT on edit", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "PUBLISHABLE",
    });
    mockTx.assignment.update.mockResolvedValue({
      ...fakeAssignment,
      status: "DRAFT",
      versions: [fakeVersion],
    });

    const result = await updateAssignment("asgn_01", "teacher_01", newContent);
    expect(mockTx.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      })
    );
    expect(result.status).toBe("DRAFT");
  });

  it("throws ForbiddenError when a different teacher edits", async () => {
    await expect(
      updateAssignment("asgn_01", "other_teacher", newContent)
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws ValidationError when assignment is ASSIGNED", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "ASSIGNED",
    });
    await expect(
      updateAssignment("asgn_01", "teacher_01", newContent)
    ).rejects.toThrow(ValidationError);
  });
});

// ── restoreVersion ────────────────────────────────────────────────────────────

describe("restoreVersion", () => {
  beforeEach(() => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    mockPrisma.assignmentVersion.findUnique.mockResolvedValue(fakeVersion);
    mockTx.assignmentVersion.count.mockResolvedValue(1);
    mockTx.assignmentVersion.create.mockResolvedValue({
      ...fakeVersion,
      id: "ver_03",
      versionNumber: 2,
      changeDescription: "Restored from version 1",
    });
    mockTx.assignmentItem.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.assignmentItem.createMany.mockResolvedValue({ count: 1 });
    mockTx.assignment.update.mockResolvedValue({
      ...fakeAssignment,
      status: "DRAFT",
      currentVersionId: "ver_03",
      versions: [
        { ...fakeVersion, id: "ver_03", versionNumber: 2, changeDescription: "Restored from version 1" },
        fakeVersion,
      ],
    });
  });

  it("creates a new version with restored content (preserves history)", async () => {
    const result = await restoreVersion("asgn_01", "ver_01", "teacher_01");
    expect(mockTx.assignmentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeDescription: "Restored from version 1",
        }),
      })
    );
    expect(result.status).toBe("DRAFT");
  });

  it("throws ForbiddenError when a different teacher restores", async () => {
    await expect(
      restoreVersion("asgn_01", "ver_01", "other_teacher")
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when version does not belong to the assignment", async () => {
    mockPrisma.assignmentVersion.findUnique.mockResolvedValue({
      ...fakeVersion,
      assignmentId: "other_asgn",
    });
    await expect(
      restoreVersion("asgn_01", "ver_01", "teacher_01")
    ).rejects.toThrow(NotFoundError);
  });
});

// ── publishAssignment ─────────────────────────────────────────────────────────

describe("publishAssignment", () => {
  it("transitions DRAFT → PUBLISHABLE", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      versions: [fakeVersion],
    });
    mockPrisma.assignment.update.mockResolvedValue({
      ...fakeAssignment,
      status: "PUBLISHABLE",
      versions: [fakeVersion],
    });

    const result = await publishAssignment("asgn_01", "teacher_01");
    expect(result.status).toBe("PUBLISHABLE");
  });

  it("throws ValidationError when already PUBLISHABLE", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "PUBLISHABLE",
      versions: [fakeVersion],
    });
    await expect(publishAssignment("asgn_01", "teacher_01")).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when already ASSIGNED", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "ASSIGNED",
      versions: [fakeVersion],
    });
    await expect(publishAssignment("asgn_01", "teacher_01")).rejects.toThrow(ValidationError);
  });

  it("throws ForbiddenError when a different teacher publishes", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      versions: [fakeVersion],
    });
    await expect(publishAssignment("asgn_01", "other_teacher")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when assignment does not exist", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null);
    await expect(publishAssignment("missing", "teacher_01")).rejects.toThrow(NotFoundError);
  });
});

// —— deleteAssignment ————————————————————————————————————————————————————————————

describe("deleteAssignment", () => {
  it("deletes assignment for the owning teacher", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    mockPrisma.assignment.delete.mockResolvedValue(fakeAssignment);

    await deleteAssignment("asgn_01", "teacher_01");

    expect(mockPrisma.assignment.delete).toHaveBeenCalledWith({
      where: { id: "asgn_01" },
    });
  });

  it("throws ForbiddenError when a different teacher deletes", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);

    await expect(deleteAssignment("asgn_01", "other_teacher")).rejects.toThrow(ForbiddenError);
    expect(mockPrisma.assignment.delete).not.toHaveBeenCalled();
  });

  it("throws ValidationError when assignment is ASSIGNED", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...fakeAssignment,
      status: "ASSIGNED",
    });

    await expect(deleteAssignment("asgn_01", "teacher_01")).rejects.toThrow(ValidationError);
    expect(mockPrisma.assignment.delete).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when assignment does not exist", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null);

    await expect(deleteAssignment("missing", "teacher_01")).rejects.toThrow(NotFoundError);
    expect(mockPrisma.assignment.delete).not.toHaveBeenCalled();
  });
});

// ── getAssignmentVersion ──────────────────────────────────────────────────────

describe("getAssignmentVersion", () => {
  it("returns version detail for the owning teacher", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    mockPrisma.assignmentVersion.findUnique.mockResolvedValue(fakeVersion);
    const result = await getAssignmentVersion("asgn_01", "ver_01", "teacher_01");
    expect(result.versionNumber).toBe(1);
    expect(result.content.title).toBe(fakeContent.title);
  });

  it("throws ForbiddenError for a different teacher", async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(fakeAssignment);
    await expect(
      getAssignmentVersion("asgn_01", "ver_01", "other_teacher")
    ).rejects.toThrow(ForbiddenError);
  });
});
