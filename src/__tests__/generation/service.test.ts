import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/modules/generation/queue", () => ({
  enqueueGenerationJob: vi.fn().mockResolvedValue(undefined),
  removeGenerationJob: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/modules/generation/source-profiles", () => ({
  getExternalSourceProfileOrThrow: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db/prisma";
import {
  cancelGenerationRequest,
  createGenerationRequest,
  getGenerationRequest,
  listGenerationRequests,
  regenerateRequest,
} from "@/modules/generation/service";
import { enqueueGenerationJob, removeGenerationJob } from "@/modules/generation/queue";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  generationRequest: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const validConstraints = {
  topic: "Photosynthesis",
  difficulty: "MEDIUM" as const,
  format: "SINGLE_ASSIGNMENT" as const,
  questionCount: 3,
  knowledgeMode: "INTERNAL_ONLY" as const,
};

const fakeRequestDetail = {
  id: "req_01",
  ownerAccountId: "teacher_01",
  status: "QUEUED",
  constraints: validConstraints,
  materialIds: [],
  runToken: 1,
  metadata: null,
  cancelRequestedAt: null,
  cancelReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  plan: {
    outline: {
      title: "Plan",
      sections: [],
      totalQuestions: 3,
    },
  },
  result: {
    id: "res_01",
    content: {
      title: "Test",
      instructions: "Answer all",
      items: [],
    },
    format: "SINGLE_ASSIGNMENT",
    metadata: null,
    createdAt: new Date(),
  },
};

describe("generation service", () => {
  beforeEach(() => {
    mockPrisma.generationRequest.create.mockResolvedValue({
      id: "req_01",
      ownerAccountId: "teacher_01",
      status: "QUEUED",
      constraints: validConstraints,
      materialIds: [],
      runToken: 1,
      metadata: null,
      cancelRequestedAt: null,
      cancelReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.generationRequest.findUnique.mockResolvedValue(fakeRequestDetail);
    mockPrisma.generationRequest.findMany.mockResolvedValue([fakeRequestDetail]);
    mockPrisma.generationRequest.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a request and enqueues async generation", async () => {
    const result = await createGenerationRequest({
      ownerAccountId: "teacher_01",
      constraints: validConstraints,
      materialIds: [],
    });

    expect(result.id).toBe("req_01");
    expect(mockPrisma.generationRequest.create).toHaveBeenCalledOnce();
    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_01", runToken: 1 })
    );
  });

  it("throws ValidationError on invalid constraints", async () => {
    await expect(
      createGenerationRequest({
        ownerAccountId: "teacher_01",
        constraints: { ...validConstraints, topic: "" },
        materialIds: [],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("lists requests by owner", async () => {
    const result = await listGenerationRequests("teacher_01");
    expect(result).toHaveLength(1);
    expect(mockPrisma.generationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerAccountId: "teacher_01" } })
    );
  });

  it("returns detail for owner", async () => {
    const result = await getGenerationRequest("req_01", "teacher_01");
    expect(result.id).toBe("req_01");
  });

  it("throws ForbiddenError for non-owner detail request", async () => {
    await expect(getGenerationRequest("req_01", "teacher_02")).rejects.toThrow(
      ForbiddenError
    );
  });

  it("throws NotFoundError for missing request", async () => {
    mockPrisma.generationRequest.findUnique.mockResolvedValueOnce(null);
    await expect(getGenerationRequest("missing", "teacher_01")).rejects.toThrow(
      NotFoundError
    );
  });

  it("regenerates by bumping runToken and re-enqueueing", async () => {
    mockPrisma.generationRequest.findUnique
      .mockResolvedValueOnce({
        ...fakeRequestDetail,
        status: "READY",
        runToken: 7,
      })
      .mockResolvedValueOnce({
        ...fakeRequestDetail,
        runToken: 8,
      });

    await regenerateRequest("req_01", "teacher_01");

    expect(mockPrisma.generationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "QUEUED",
          runToken: 8,
        }),
      })
    );

    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_01", runToken: 8 })
    );
  });

  it("cancel queued request sets CANCELLED", async () => {
    mockPrisma.generationRequest.findUnique
      .mockResolvedValueOnce({
        ...fakeRequestDetail,
        status: "QUEUED",
      })
      .mockResolvedValueOnce({
        ...fakeRequestDetail,
        status: "CANCELLED",
      });

    await cancelGenerationRequest({
      id: "req_01",
      ownerAccountId: "teacher_01",
    });

    expect(removeGenerationJob).toHaveBeenCalledWith("req_01", 1);
    expect(mockPrisma.generationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("cancel running request only marks cancelRequestedAt", async () => {
    (removeGenerationJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    mockPrisma.generationRequest.findUnique
      .mockResolvedValueOnce({
        ...fakeRequestDetail,
        status: "GENERATING",
      })
      .mockResolvedValueOnce({
        ...fakeRequestDetail,
        status: "GENERATING",
      });

    await cancelGenerationRequest({
      id: "req_01",
      ownerAccountId: "teacher_01",
      reason: "manual",
    });

    expect(mockPrisma.generationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cancelReason: "manual",
        }),
      })
    );
  });
});
