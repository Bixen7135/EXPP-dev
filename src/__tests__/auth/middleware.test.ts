import { describe, it, expect, vi } from "vitest";

// Mock prisma so the module can load without a generated Prisma client
vi.mock("@/lib/db/prisma", () => ({
  prisma: { session: { findUnique: vi.fn() } },
}));

import { matchRouteRule, isAllowed } from "@/lib/auth/middleware";

describe("matchRouteRule", () => {
  it("matches /teacher prefix", () => {
    const rule = matchRouteRule("/teacher/materials");
    expect(rule).not.toBeNull();
    expect(rule?.requiredPermissions).toContain("workspace.teacher");
  });

  it("matches /student prefix", () => {
    const rule = matchRouteRule("/student/assignments");
    expect(rule).not.toBeNull();
    expect(rule?.requiredPermissions).toContain("workspace.student");
  });

  it("matches /admin prefix", () => {
    const rule = matchRouteRule("/admin/users");
    expect(rule).not.toBeNull();
    expect(rule?.requiredPermissions).toContain("workspace.admin");
  });

  it("returns null for unprotected paths", () => {
    expect(matchRouteRule("/login")).toBeNull();
    expect(matchRouteRule("/register")).toBeNull();
    expect(matchRouteRule("/api/auth/login")).toBeNull();
  });
});

describe("isAllowed", () => {
  it("allows teacher permission on teacher route", () => {
    const rule = matchRouteRule("/teacher/dashboard")!;
    expect(isAllowed(["workspace.teacher"], rule)).toBe(true);
  });

  it("allows admin permission on teacher route", () => {
    const rule = matchRouteRule("/teacher/dashboard")!;
    expect(isAllowed(["workspace.admin"], rule)).toBe(true);
  });

  it("denies student permission on teacher route", () => {
    const rule = matchRouteRule("/teacher/dashboard")!;
    expect(isAllowed(["workspace.student"], rule)).toBe(false);
  });

  it("allows student on student route", () => {
    const rule = matchRouteRule("/student/assignments")!;
    expect(isAllowed(["workspace.student"], rule)).toBe(true);
  });

  it("denies teacher on student route", () => {
    const rule = matchRouteRule("/student/assignments")!;
    expect(isAllowed(["workspace.teacher"], rule)).toBe(false);
  });

  it("allows only admin permission on admin route", () => {
    const rule = matchRouteRule("/admin/users")!;
    expect(isAllowed(["workspace.admin"], rule)).toBe(true);
    expect(isAllowed(["workspace.teacher"], rule)).toBe(false);
    expect(isAllowed(["workspace.student"], rule)).toBe(false);
  });

  it("allows wildcard permission", () => {
    const rule = matchRouteRule("/admin/users")!;
    expect(isAllowed(["*"], rule)).toBe(true);
  });
});
