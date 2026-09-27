import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  resolveSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  canAccessStudentWorkspace: vi.fn(),
}));

vi.mock("@/modules/completion/service", () => ({
  submitAttempt: vi.fn(),
}));

vi.mock("@/modules/assessment/service", () => ({
  queueAutoAnalysisForAttempt: vi.fn(),
}));

vi.mock("@/lib/audit/logger", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { QueueUnavailableError } from "@/lib/errors";
import { submitAttempt } from "@/modules/completion/service";
import { queueAutoAnalysisForAttempt } from "@/modules/assessment/service";
import { POST } from "@/app/api/attempts/[id]/submit/route";

describe("POST /api/attempts/[id]/submit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns success even when auto-analysis queueing fails", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "student_01",
      permissions: ["workspace.student"],
    } as never);
    vi.mocked(canAccessStudentWorkspace).mockReturnValue(true);
    vi.mocked(submitAttempt).mockResolvedValue({
      id: "attempt_01",
      submittedAt: new Date("2026-03-26T08:04:23.401Z"),
    } as never);
    vi.mocked(queueAutoAnalysisForAttempt).mockRejectedValueOnce(
      new QueueUnavailableError("Queue down")
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const req = new NextRequest("http://localhost/api/attempts/attempt_01/submit", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "attempt_01" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(queueAutoAnalysisForAttempt).toHaveBeenCalledWith("attempt_01", "unknown");
    expect(consoleSpy).toHaveBeenCalled();
  });
});
