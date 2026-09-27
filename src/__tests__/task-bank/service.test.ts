import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  taskBankItem: {
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  taskBankTag: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    taskBankItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    taskBankTag: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createTaskBankItem,
  deleteTaskBankItem,
  listTaskBankItems,
  updateTaskBankItem,
} from "@/modules/task-bank/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  taskBankItem: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  taskBankTag: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

const baseRow = {
  id: "task_01",
  ownerAccountId: "teacher_01",
  title: "Quadratic equation basics",
  content: {
    type: "SHORT_ANSWER",
    question: "What is a quadratic equation?",
    expectedAnswer: "A polynomial equation of degree two",
    maxScore: 1,
  },
  tags: [{ key: "topic", value: "algebra" }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("task-bank service", () => {
  it("creates a task bank item", async () => {
    mockPrisma.taskBankItem.create.mockResolvedValue(baseRow);

    const result = await createTaskBankItem({
      ownerAccountId: "teacher_01",
      title: "Quadratic equation basics",
      content: {
        type: "SHORT_ANSWER",
        question: "What is a quadratic equation?",
        expectedAnswer: "A polynomial equation of degree two",
      },
      tags: [{ key: "topic", value: "algebra" }],
    });

    expect(result.id).toBe("task_01");
    expect(result.tags).toHaveLength(1);
    expect(mockPrisma.taskBankItem.create).toHaveBeenCalledOnce();
  });

  it("filters by search text after loading list", async () => {
    mockPrisma.taskBankItem.findMany.mockResolvedValue([
      baseRow,
      {
        ...baseRow,
        id: "task_02",
        title: "Biology fundamentals",
        content: {
          ...baseRow.content,
          question: "What is a cell?",
          expectedAnswer: "Basic unit of life",
        },
        tags: [{ key: "topic", value: "biology" }],
      },
    ]);

    const result = await listTaskBankItems("teacher_01", { search: "algebra" });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("task_01");
  });

  it("throws ForbiddenError when editing another teacher's item", async () => {
    mockPrisma.taskBankItem.findUnique.mockResolvedValue({
      ...baseRow,
      ownerAccountId: "teacher_02",
    });

    await expect(
      updateTaskBankItem("task_01", "teacher_01", {
        title: "Updated title",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("replaces tags on update when tags are provided", async () => {
    mockPrisma.taskBankItem.findUnique.mockResolvedValue(baseRow);
    mockTx.taskBankItem.update.mockResolvedValue(baseRow);
    mockTx.taskBankTag.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.taskBankTag.createMany.mockResolvedValue({ count: 1 });
    mockTx.taskBankItem.findUniqueOrThrow.mockResolvedValue({
      ...baseRow,
      tags: [{ key: "grade", value: "8" }],
    });

    const result = await updateTaskBankItem("task_01", "teacher_01", {
      tags: [{ key: "grade", value: "8" }],
    });

    expect(mockTx.taskBankTag.deleteMany).toHaveBeenCalledWith({
      where: { taskBankItemId: "task_01" },
    });
    expect(mockTx.taskBankTag.createMany).toHaveBeenCalledOnce();
    expect(result.tags[0]).toEqual({ key: "grade", value: "8" });
  });

  it("throws NotFoundError when deleting missing item", async () => {
    mockPrisma.taskBankItem.findUnique.mockResolvedValue(null);

    await expect(deleteTaskBankItem("missing", "teacher_01")).rejects.toThrow(
      NotFoundError
    );
    expect(mockPrisma.taskBankItem.delete).not.toHaveBeenCalled();
  });
});
