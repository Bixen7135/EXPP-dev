import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  resolveSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  canAccessStudentWorkspace: vi.fn(),
}));

vi.mock("@/modules/assessment/service", () => ({
  getStudentResult: vi.fn(),
}));

import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { NotFoundError } from "@/lib/errors";
import { getStudentResult } from "@/modules/assessment/service";
import { GET } from "@/app/api/assessment/[attemptId]/result/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/assessment/[attemptId]/result", () => {
  it("returns student published result payload", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "student_01",
      permissions: ["workspace.student"],
    } as never);
    vi.mocked(canAccessStudentWorkspace).mockReturnValue(true);
    vi.mocked(getStudentResult).mockResolvedValue({
      assessmentId: "asmnt_01",
      attemptId: "att_01",
      grade: 8,
      maxGrade: 10,
      comment: "Good",
      aiReview: {
        gradeRationale: "Solid attempt",
        reviewPriority: ["Improve explanations"],
        items: [],
      },
      publishedAt: new Date("2026-01-03T00:00:00.000Z"),
    } as never);

    const req = new NextRequest("http://localhost/api/assessment/att_01/result", {
      method: "GET",
    });
    const res = await GET(req, {
      params: Promise.resolve({ attemptId: "att_01" }),
    });

    expect(res.status).toBe(200);
    expect(getStudentResult).toHaveBeenCalledWith("att_01", "student_01");
  });

  it("returns 404 when result is not published yet", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "student_01",
      permissions: ["workspace.student"],
    } as never);
    vi.mocked(canAccessStudentWorkspace).mockReturnValue(true);
    vi.mocked(getStudentResult).mockRejectedValueOnce(
      new NotFoundError("Result not yet published")
    );

    const req = new NextRequest("http://localhost/api/assessment/att_01/result", {
      method: "GET",
    });
    const res = await GET(req, {
      params: Promise.resolve({ attemptId: "att_01" }),
    });

    expect(res.status).toBe(404);
  });
});
