import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock dependencies ──────────────────────────────────────────────────────

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    generationPlan: {
      upsert: vi.fn(),
    },
    generationResult: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/modules/generation/context-retrieval", () => ({
  buildMaterialContext: vi.fn().mockResolvedValue("material context text"),
}));

vi.mock("@/modules/generation/planner", () => ({
  generatePlan: vi.fn().mockResolvedValue({
    title: "Test Plan",
    sections: [{ title: "Section 1", items: ["question idea"] }],
    totalQuestions: 2,
    rationale: "test",
  }),
}));

vi.mock("@/modules/generation/generator", () => ({
  generateContent: vi.fn().mockResolvedValue({
    title: "Test Assignment",
    instructions: "Answer all questions",
    items: [
      { order: 1, type: "SHORT_ANSWER", question: "Q1?", expectedAnswer: "A1" },
      { order: 2, type: "SHORT_ANSWER", question: "Q2?", expectedAnswer: "A2" },
    ],
  }),
}));

afterEach(() => { vi.clearAllMocks(); });

import { prisma } from "@/lib/db/prisma";
import { runGenerationPipeline } from "@/modules/generation/pipeline";

const mockPrisma = prisma as unknown as {
  generationRequest: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  generationPlan: { upsert: ReturnType<typeof vi.fn> };
  generationResult: { upsert: ReturnType<typeof vi.fn> };
};

const fakeRequest = {
  id: "req_01",
  teacherId: "teacher_01",
  status: "PENDING",
  materialIds: ["mat_01"],
  constraints: {
    topic: "Fractions",
    difficulty: "EASY",
    format: "SINGLE_ASSIGNMENT",
    questionCount: 2,
  },
};

describe("runGenerationPipeline", () => {
  beforeEach(() => {
    mockPrisma.generationRequest.findUnique.mockResolvedValue(fakeRequest);
    mockPrisma.generationRequest.update.mockResolvedValue({});
    mockPrisma.generationPlan.upsert.mockResolvedValue({});
    mockPrisma.generationResult.upsert.mockResolvedValue({});
  });

  it("transitions through PLANNING → GENERATING → READY", async () => {
    await runGenerationPipeline("req_01");

    const updateCalls = mockPrisma.generationRequest.update.mock.calls;
    const statuses = updateCalls.map(
      (c: [{ where: unknown; data: { status: string } }]) => c[0].data.status
    );
    expect(statuses).toContain("PLANNING");
    expect(statuses).toContain("GENERATING");
    expect(statuses).toContain("READY");
  });

  it("saves the plan outline to DB", async () => {
    await runGenerationPipeline("req_01");
    expect(mockPrisma.generationPlan.upsert).toHaveBeenCalledOnce();
    const call = mockPrisma.generationPlan.upsert.mock.calls[0][0] as {
      where: { requestId: string };
      create: { outline: unknown };
    };
    expect(call.where.requestId).toBe("req_01");
    expect(call.create.outline).toBeTruthy();
  });

  it("saves the generated content to DB and never auto-publishes", async () => {
    await runGenerationPipeline("req_01");
    expect(mockPrisma.generationResult.upsert).toHaveBeenCalledOnce();
    const call = mockPrisma.generationResult.upsert.mock.calls[0][0] as {
      create: { content: unknown; format: string };
    };
    expect(call.create.content).toBeTruthy();
    // Result has no "published" or assignment status — only the generation status
    const finalUpdate = mockPrisma.generationRequest.update.mock.calls.at(-1)[0] as {
      data: { status: string };
    };
    expect(finalUpdate.data.status).toBe("READY");
    // Ensure there's no call that sets status to something like "PUBLISHED"
    const allStatuses = mockPrisma.generationRequest.update.mock.calls.map(
      (c: [{ data: { status: string } }]) => c[0].data.status
    );
    expect(allStatuses).not.toContain("PUBLISHED");
    expect(allStatuses).not.toContain("ASSIGNED");
  });

  it("sets ERROR status when generation fails", async () => {
    const { generateContent } = await import("@/modules/generation/generator");
    (generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("AI unavailable")
    );

    await expect(runGenerationPipeline("req_01")).rejects.toThrow("AI unavailable");

    const statuses = mockPrisma.generationRequest.update.mock.calls.map(
      (c: [{ data: { status: string } }]) => c[0].data.status
    );
    expect(statuses).toContain("ERROR");
  });

  it("throws if request not found", async () => {
    mockPrisma.generationRequest.findUnique.mockResolvedValueOnce(null);
    await expect(runGenerationPipeline("missing")).rejects.toThrow(
      "GenerationRequest missing not found"
    );
  });
});
