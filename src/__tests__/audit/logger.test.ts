import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing logger
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    auditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { auditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/prisma";

describe("auditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes an audit event with all fields", async () => {
    await auditLog({
      userId: "user-1",
      action: "auth.login",
      entityType: "user",
      entityId: "user-1",
      context: { ip: "1.2.3.4" },
      traceId: "trace-abc",
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "auth.login",
        entityType: "user",
        entityId: "user-1",
        context: { ip: "1.2.3.4" },
        traceId: "trace-abc",
      },
    });
  });

  it("writes event without userId (anonymous)", async () => {
    await auditLog({ action: "auth.login_failed", traceId: "trace-xyz" });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null, action: "auth.login_failed" }),
    });
  });

  it("does not throw if DB write fails", async () => {
    vi.mocked(prisma.auditEvent.create).mockRejectedValueOnce(
      new Error("DB down")
    );
    await expect(
      auditLog({ action: "auth.login", traceId: "t" })
    ).resolves.not.toThrow();
  });
});
