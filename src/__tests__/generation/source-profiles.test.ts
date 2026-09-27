import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    externalSourceProfile: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    externalSourceProfileUrl: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/modules/generation/external-sources", () => ({
  validateAndNormalizeExternalUrl: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import { validateAndNormalizeExternalUrl } from "@/modules/generation/external-sources";
import {
  createExternalSourceProfile,
  updateExternalSourceProfile,
} from "@/modules/generation/source-profiles";

const mockPrisma = prisma as unknown as {
  externalSourceProfile: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  externalSourceProfileUrl: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockValidateUrl = validateAndNormalizeExternalUrl as unknown as ReturnType<typeof vi.fn>;

describe("source profile URL validation", () => {
  beforeEach(() => {
    mockValidateUrl.mockImplementation(async (url: string) => url);

    mockPrisma.externalSourceProfile.create.mockResolvedValue({
      id: "sp_1",
      ownerAccountId: "teacher_1",
      name: "Profile",
      includeWhitelist: true,
      urls: [{ url: "https://example.com/a" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.externalSourceProfile.findUnique.mockResolvedValue({
      id: "sp_1",
      ownerAccountId: "teacher_1",
      name: "Profile",
      includeWhitelist: true,
      urls: [{ url: "https://example.com/a" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.externalSourceProfile.update.mockResolvedValue({
      id: "sp_1",
      ownerAccountId: "teacher_1",
      name: "Updated",
      includeWhitelist: false,
      urls: [{ url: "https://example.com/a" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        externalSourceProfileUrl: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        externalSourceProfile: {
          update: mockPrisma.externalSourceProfile.update,
        },
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates and validates URLs before profile creation", async () => {
    await createExternalSourceProfile({
      ownerAccountId: "teacher_1",
      name: " Profile ",
      urls: [
        "https://example.com/a",
        "https://example.com/a",
        "https://example.com/b",
      ],
      includeWhitelist: true,
    });

    expect(mockValidateUrl).toHaveBeenCalledTimes(2);
    expect(mockPrisma.externalSourceProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          urls: {
            create: [{ url: "https://example.com/a" }, { url: "https://example.com/b" }],
          },
        }),
      })
    );
  });

  it("throws ValidationError when URL fails SSRF-safe validation", async () => {
    mockValidateUrl.mockRejectedValueOnce(new Error("Private/internal IP is not allowed"));

    await expect(
      createExternalSourceProfile({
        ownerAccountId: "teacher_1",
        name: "Unsafe",
        urls: ["https://169.254.1.1/resource"],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("validates updated URL list with the same security checks", async () => {
    await updateExternalSourceProfile({
      id: "sp_1",
      ownerAccountId: "teacher_1",
      urls: ["https://example.com/a", "https://example.com/c"],
      includeWhitelist: false,
    });

    expect(mockValidateUrl).toHaveBeenCalledTimes(2);
    expect(mockPrisma.externalSourceProfile.update).toHaveBeenCalled();
  });
});

