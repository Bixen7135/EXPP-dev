import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationRequest: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
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
  retrieveInternalContext: vi.fn().mockResolvedValue({
    contextText: "internal context",
    sources: [
      {
        type: "INTERNAL",
        ref: "material:m1:chunk:c1",
        title: "Material 1",
        excerpt: "Chunk excerpt",
      },
    ],
    chunks: [
      {
        chunkId: "c1",
        materialId: "m1",
        materialTitle: "Material 1",
        text: "Chunk text",
        score: 0.8,
        startOffset: 0,
        endOffset: 50,
        keywords: ["photosynthesis"],
      },
    ],
  }),
}));

vi.mock("@/modules/generation/planner", () => ({
  generatePlan: vi.fn().mockResolvedValue({
    title: "Plan",
    sections: [
      { title: "Section A", items: ["Idea 1"] },
      { title: "Section B", items: ["Idea 2"] },
    ],
    totalQuestions: 2,
    rationale: "Rationale",
  }),
}));

vi.mock("@/modules/generation/generator", () => ({
  generateContentFromOutline: vi.fn().mockResolvedValue({
    title: "Generated",
    instructions: "Answer all",
    items: [
      {
        order: 1,
        type: "SHORT_ANSWER",
        question: "Q1",
        expectedAnswer: "A1",
        maxScore: 1,
      },
      {
        order: 2,
        type: "SHORT_ANSWER",
        question: "Q2",
        expectedAnswer: "A2",
        maxScore: 1,
      },
    ],
  }),
  validateContentBatched: vi.fn().mockResolvedValue({
    content: {
      title: "Generated",
      instructions: "Answer all",
      items: [
        {
          order: 1,
          type: "SHORT_ANSWER",
          question: "Q1",
          expectedAnswer: "A1",
          maxScore: 1,
        },
        {
          order: 2,
          type: "SHORT_ANSWER",
          question: "Q2",
          expectedAnswer: "A2",
          maxScore: 1,
        },
      ],
    },
    warnings: [],
  }),
  enforceContentQuality: vi.fn().mockImplementation(async ({ content }) => ({
    content,
    warnings: [],
    qualityReport: {
      passed: true,
      passCount: 0,
      itemReports: [],
      summary: {
        issueCodes: [],
        missingCount: 0,
        objectiveCoverage: {},
        complexityRatios: {
          applyPlus: 1,
          analyzePlus: 1,
          evaluatePlus: 1,
        },
        typeDiversity: 2,
      },
    },
  })),
}));

vi.mock("@/modules/generation/external-sources", () => ({
  fetchExternalKnowledge: vi.fn().mockResolvedValue({
    documents: [
      {
        url: "https://example.com/a",
        domain: "example.com",
        title: "Example",
        text: "External knowledge text",
        excerpt: "External knowledge",
      },
    ],
    warnings: [],
  }),
}));

vi.mock("@/modules/generation/link-extraction", () => ({
  extractLinksFromAdditionalInstructions: vi.fn().mockResolvedValue({
    explicitUrls: ["https://example.com/a"],
    suggestedUrls: ["https://example.com/b"],
    materialHints: ["chlorophyll"],
    warnings: [],
  }),
}));

vi.mock("@/modules/materials/indexing", () => ({
  extractKeywords: vi.fn().mockImplementation((text: string) =>
    text
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)
      .slice(0, 10)
  ),
}));

import { prisma } from "@/lib/db/prisma";
import { runGenerationPipeline } from "@/modules/generation/pipeline";
import { generateContentFromOutline } from "@/modules/generation/generator";

const mockPrisma = prisma as unknown as {
  generationRequest: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  generationPlan: {
    upsert: ReturnType<typeof vi.fn>;
  };
  generationResult: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

describe("runGenerationPipeline", () => {
  const initialRequestState = {
    id: "req_01",
    ownerAccountId: "teacher_01",
    status: "QUEUED",
    runToken: 1,
    cancelRequestedAt: null as Date | null,
    cancelReason: null as string | null,
    constraints: {
      topic: "Photosynthesis",
      difficulty: "MEDIUM",
      format: "SINGLE_ASSIGNMENT",
      questionCount: 2,
      knowledgeMode: "HYBRID_EXTERNAL",
      additionalInstructions: "Use https://example.com/a",
    },
    materialIds: ["m1"],
    metadata: null as unknown,
    externalSourceProfile: {
      id: "sp_1",
      includeWhitelist: true,
      urls: [{ url: "https://example.com/profile" }],
    },
  };

  let state = { ...initialRequestState };

  beforeEach(() => {
    state = { ...initialRequestState };

    mockPrisma.generationRequest.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id !== state.id) {
        return null;
      }

      if (args.include?.externalSourceProfile) {
        return { ...state };
      }

      if (args.select?.runToken && args.select?.cancelRequestedAt && args.select?.status) {
        return {
          runToken: state.runToken,
          cancelRequestedAt: state.cancelRequestedAt,
          status: state.status,
        };
      }

      if (args.select?.runToken && Object.prototype.hasOwnProperty.call(args.select, "metadata")) {
        return {
          runToken: state.runToken,
          metadata: state.metadata,
        };
      }

      return { ...state };
    });

    mockPrisma.generationRequest.updateMany.mockImplementation(async (args: any) => {
      const where = args.where ?? {};
      if (where.id !== state.id || (where.runToken !== undefined && where.runToken !== state.runToken)) {
        return { count: 0 };
      }

      const data = args.data ?? {};
      state = {
        ...state,
        ...data,
      };

      return { count: 1 };
    });

    mockPrisma.generationPlan.upsert.mockResolvedValue({});
    mockPrisma.generationResult.upsert.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs stage transitions to READY", async () => {
    await runGenerationPipeline("req_01", 1);

    const statusUpdates = mockPrisma.generationRequest.updateMany.mock.calls
      .map((call) => call[0]?.data?.status)
      .filter((value) => typeof value === "string");

    expect(statusUpdates).toContain("PLANNING");
    expect(statusUpdates).toContain("RETRIEVING");
    expect(statusUpdates).toContain("GENERATING");
    expect(statusUpdates).toContain("VALIDATING");
    expect(statusUpdates).toContain("READY");
  });

  it("persists plan and content", async () => {
    await runGenerationPipeline("req_01", 1);
    expect(mockPrisma.generationPlan.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.generationResult.upsert).toHaveBeenCalled();
  });

  it("stores dynamic progress and link extraction metadata", async () => {
    await runGenerationPipeline("req_01", 1);

    const metadata = state.metadata as Record<string, unknown>;
    expect(metadata.progressPercent).toBe(100);
    expect(metadata.currentStage).toBe("READY");
    expect(Array.isArray(metadata.stageProgress)).toBe(true);
    expect(metadata.linkExtraction).toEqual(
      expect.objectContaining({
        explicitUrls: ["https://example.com/a"],
        suggestedUrls: ["https://example.com/b"],
      })
    );
  });

  it("marks CANCELLED when cancellation is already requested", async () => {
    state = {
      ...state,
      cancelRequestedAt: new Date(),
    };

    await runGenerationPipeline("req_01", 1);

    const statusUpdates = mockPrisma.generationRequest.updateMany.mock.calls
      .map((call) => call[0]?.data?.status)
      .filter((value) => typeof value === "string");

    expect(statusUpdates).toContain("CANCELLED");
  });

  it("returns early for stale run token", async () => {
    await runGenerationPipeline("req_01", 2);

    expect(mockPrisma.generationPlan.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.generationResult.upsert).not.toHaveBeenCalled();
  });

  it("cooperatively cancels during run and preserves partial metadata", async () => {
    const generateContentMock = generateContentFromOutline as unknown as ReturnType<typeof vi.fn>;
    generateContentMock.mockImplementationOnce(async () => {
      state.cancelRequestedAt = new Date();
      return {
        title: "Generated",
        instructions: "Answer all",
        items: [
          {
            order: 1,
            type: "SHORT_ANSWER",
            question: "Q1",
            expectedAnswer: "A1",
            maxScore: 1,
          },
        ],
      };
    });

    await runGenerationPipeline("req_01", 1);

    expect(state.status).toBe("CANCELLED");
    const metadata = state.metadata as Record<string, unknown>;
    expect(metadata.currentStage).toBe("CANCELLED");
    expect(metadata.partial).toBe(true);
  });
});
