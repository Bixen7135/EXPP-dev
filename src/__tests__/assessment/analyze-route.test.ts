import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  resolveSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  canAccessTeacherWorkspace: vi.fn(),
}));

vi.mock("@/modules/assessment/service", () => ({
  triggerAssessmentAnalysis: vi.fn(),
}));

vi.mock("@/lib/audit/logger", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { QueueUnavailableError } from "@/lib/errors";
import { triggerAssessmentAnalysis } from "@/modules/assessment/service";
import { POST } from "@/app/api/assessment/[attemptId]/analyze/route";

describe("POST /api/assessment/[attemptId]/analyze", () => {
  it("returns 503 QUEUE_UNAVAILABLE when queue is unavailable", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "teacher_01",
      permissions: ["workspace.teacher"],
    } as never);
    vi.mocked(canAccessTeacherWorkspace).mockReturnValue(true);
    vi.mocked(triggerAssessmentAnalysis).mockRejectedValueOnce(
      new QueueUnavailableError("Queue down")
    );

    const req = new NextRequest("http://localhost/api/assessment/att_01/analyze", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ attemptId: "att_01" }),
    });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      code: "QUEUE_UNAVAILABLE",
    });
  });
});
