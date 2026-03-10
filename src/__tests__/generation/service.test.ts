import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock dependencies ──────────────────────────────────────────────────────

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

vi.mock("@/modules/generation/pipeline", () => ({
  runGenerationPipeline: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => { vi.clearAllMocks(); });

import { prisma } from "@/lib/db/prisma";
import {
  createGenerationRequest,
  listGenerationRequests,
  getGenerationRequest,
  regenerateRequest,
} from "@/modules/generation/service";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";

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
};

const fakeRequest = {
  id: "req_01",
  teacherId: "teacher_01",
  status: "READY",
  constraints: validConstraints,
  materialIds: [],
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

describe("createGenerationRequest", () => {
  beforeEach(() => {
    mockPrisma.generationRequest.create.mockResolvedValue({
      id: "req_01",
      teacherId: "teacher_01",
      status: "PENDING",
      constraints: validConstraints,
      materialIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.generationRequest.findUnique.mockResolvedValue(fakeRequest);
  });

  it("validates constraints and creates a request", async () => {
    const result = await createGenerationRequest({
      teacherId: "teacher_01",
      constraints: validConstraints,
      materialIds: [],
    });

    expect(mockPrisma.generationRequest.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("req_01");
    expect(result.status).toBe("READY");
  });

  it("throws ValidationError for invalid constraints without creating a DB record", async () => {
    await expect(
      createGenerationRequest({
        teacherId: "teacher_01",
        constraints: { topic: "", difficulty: "MEDIUM", format: "SINGLE_ASSIGNMENT", questionCount: 3 },
        materialIds: [],
      })
    ).rejects.toThrow(ValidationError);

    expect(mockPrisma.generationRequest.create).not.toHaveBeenCalled();
  });

  it("throws ValidationError when questionCount is out of range", async () => {
    await expect(
      createGenerationRequest({
        teacherId: "teacher_01",
        constraints: { ...validConstraints, questionCount: 25 },
        materialIds: [],
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe("listGenerationRequests", () => {
  it("returns only requests for the given teacher", async () => {
    const rows = [
      { id: "req_01", teacherId: "t1", status: "READY", constraints: validConstraints, materialIds: [], createdAt: new Date(), updatedAt: new Date() },
    ];
    mockPrisma.generationRequest.findMany.mockResolvedValue(rows);

    const result = await listGenerationRequests("t1");

    expect(result).toHaveLength(1);
    expect(mockPrisma.generationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: "t1" } })
    );
  });
});

describe("getGenerationRequest", () => {
  it("returns the request for the owning teacher", async () => {
    mockPrisma.generationRequest.findUnique.mockResolvedValue(fakeRequest);
    const result = await getGenerationRequest("req_01", "teacher_01");
    expect(result.id).toBe("req_01");
    expect(result.plan).not.toBeNull();
    expect(result.result).not.toBeNull();
  });

  it("throws ForbiddenError when a different teacher requests it", async () => {
    mockPrisma.generationRequest.findUnique.mockResolvedValue(fakeRequest);
    await expect(getGenerationRequest("req_01", "other_teacher")).rejects.toThrow(
      ForbiddenError
    );
  });

  it("throws NotFoundError when request does not exist", async () => {
    mockPrisma.generationRequest.findUnique.mockResolvedValue(null);
    await expect(getGenerationRequest("missing", "teacher_01")).rejects.toThrow(
      NotFoundError
    );
  });
});

describe("regenerateRequest", () => {
  beforeEach(() => {
    mockPrisma.generationRequest.findUnique.mockResolvedValue({
      id: "req_01",
      teacherId: "teacher_01",
      status: "READY",
      constraints: validConstraints,
      materialIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: null,
      result: null,
    });
    mockPrisma.generationRequest.update.mockResolvedValue({});
  });

  it("re-runs pipeline preserving the same request ID", async () => {
    const { runGenerationPipeline } = await import("@/modules/generation/pipeline");
    mockPrisma.generationRequest.findUnique
      .mockResolvedValueOnce({
        id: "req_01",
        teacherId: "teacher_01",
        status: "READY",
        constraints: validConstraints,
        materialIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(fakeRequest);

    await regenerateRequest("req_01", "teacher_01");

    expect(runGenerationPipeline).toHaveBeenCalledWith("req_01");
  });

  it("throws ForbiddenError when a different teacher tries to regenerate", async () => {
    await expect(
      regenerateRequest("req_01", "other_teacher")
    ).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when request does not exist", async () => {
    mockPrisma.generationRequest.findUnique.mockResolvedValueOnce(null);
    await expect(
      regenerateRequest("missing", "teacher_01")
    ).rejects.toThrow(NotFoundError);
  });

  it("validates new constraints when provided and updates the request", async () => {
    const newConstraints = { ...validConstraints, questionCount: 10 };
    mockPrisma.generationRequest.findUnique
      .mockResolvedValueOnce({
        id: "req_01",
        teacherId: "teacher_01",
        status: "READY",
        constraints: validConstraints,
        materialIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(fakeRequest);

    await regenerateRequest("req_01", "teacher_01", newConstraints);

    expect(mockPrisma.generationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ constraints: newConstraints }),
      })
    );
  });
});
