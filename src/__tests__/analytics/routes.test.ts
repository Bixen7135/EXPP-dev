import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  resolveSession: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  canAccessStudentWorkspace: vi.fn(),
  canAccessTeacherWorkspace: vi.fn(),
}));

vi.mock("@/modules/analytics/student", () => ({
  getStudentAnalytics: vi.fn(),
}));

vi.mock("@/modules/analytics/teacher", () => ({
  getTeacherAnalytics: vi.fn(),
}));

import { resolveSession } from "@/lib/auth/session";
import {
  canAccessStudentWorkspace,
  canAccessTeacherWorkspace,
} from "@/lib/auth/authorization";
import { getStudentAnalytics } from "@/modules/analytics/student";
import { getTeacherAnalytics } from "@/modules/analytics/teacher";
import { GET as GET_STUDENT } from "@/app/api/analytics/student/route";
import { GET as GET_TEACHER } from "@/app/api/analytics/teacher/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/analytics/student", () => {
  it("passes teacher/subject filters to student analytics service", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "student_01",
      permissions: ["workspace.student"],
    } as never);
    vi.mocked(canAccessStudentWorkspace).mockReturnValue(true);
    vi.mocked(getStudentAnalytics).mockResolvedValue({
      recipientAccountId: "student_01",
    } as never);

    const req = new NextRequest(
      "http://localhost/api/analytics/student?teacherId=teacher_01&subject=math&period=all_time",
      { method: "GET" }
    );
    const res = await GET_STUDENT(req);

    expect(res.status).toBe(200);
    expect(getStudentAnalytics).toHaveBeenCalledWith("student_01", {
      teacherId: "teacher_01",
      subject: "math",
      period: "all_time",
    });
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(resolveSession).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/analytics/student", {
      method: "GET",
    });

    const res = await GET_STUDENT(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/analytics/teacher", () => {
  it("passes subject filter to teacher analytics service", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "teacher_01",
      permissions: ["workspace.teacher"],
    } as never);
    vi.mocked(canAccessTeacherWorkspace).mockReturnValue(true);
    vi.mocked(getTeacherAnalytics).mockResolvedValue({
      creatorAccountId: "teacher_01",
    } as never);

    const req = new NextRequest("http://localhost/api/analytics/teacher?subject=math", {
      method: "GET",
    });
    const res = await GET_TEACHER(req);

    expect(res.status).toBe(200);
    expect(getTeacherAnalytics).toHaveBeenCalledWith("teacher_01", {
      subject: "math",
      period: "all_time",
    });
  });

  it("returns 403 when teacher workspace access is denied", async () => {
    vi.mocked(resolveSession).mockResolvedValue({
      id: "teacher_01",
      permissions: [],
    } as never);
    vi.mocked(canAccessTeacherWorkspace).mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/analytics/teacher", {
      method: "GET",
    });
    const res = await GET_TEACHER(req);

    expect(res.status).toBe(403);
  });
});
