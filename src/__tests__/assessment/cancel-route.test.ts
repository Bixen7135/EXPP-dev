import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  resolveSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  canAccessTeacherWorkspace: vi.fn(),
}));

vi.mock("@/modules/assessment/service", () => ({
  cancelAssessmentAnalysis: vi.fn(),
}));

vi.mock("@/lib/audit/logger", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { cancelAssessmentAnalysis } from "@/modules/assessment/service";
import { POST } from "@/app/api/assessment/[attemptId]/cancel/route";

describe("POST /api/assessment/[attemptId]/cancel", () => {
  it("returns 200 when cancellation succeeds", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "teacher_01",
      permissions: ["workspace.teacher"],
    } as never);
    vi.mocked(canAccessTeacherWorkspace).mockReturnValue(true);
    vi.mocked(cancelAssessmentAnalysis).mockResolvedValue({
      id: "asmnt_01",
      attemptId: "att_01",
      reviewerAccountId: "teacher_01",
      status: "AUTO_CHECKED",
      autoCheckStatus: "FAILED",
      autoCheckResult: null,
      aiRecommendation: null,
      latestAiRun: null,
      manualGrade: null,
      maxGrade: null,
      itemOverrides: [],
      comment: null,
      reviewedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const req = new NextRequest("http://localhost/api/assessment/att_01/cancel", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ attemptId: "att_01" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        id: "asmnt_01",
        autoCheckStatus: "FAILED",
      },
    });
  });
});
