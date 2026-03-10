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
    expect(rule?.allowedRoles).toContain("TEACHER");
  });

  it("matches /student prefix", () => {
    const rule = matchRouteRule("/student/assignments");
    expect(rule).not.toBeNull();
    expect(rule?.allowedRoles).toContain("STUDENT");
  });

  it("matches /admin prefix", () => {
    const rule = matchRouteRule("/admin/users");
    expect(rule).not.toBeNull();
    expect(rule?.allowedRoles).toContain("ADMIN");
  });

  it("returns null for unprotected paths", () => {
    expect(matchRouteRule("/login")).toBeNull();
    expect(matchRouteRule("/register")).toBeNull();
    expect(matchRouteRule("/api/auth/login")).toBeNull();
  });
});

describe("isAllowed", () => {
  it("allows TEACHER on teacher route", () => {
    const rule = matchRouteRule("/teacher/dashboard")!;
    expect(isAllowed("TEACHER", rule)).toBe(true);
  });

  it("allows ADMIN on teacher route", () => {
    const rule = matchRouteRule("/teacher/dashboard")!;
    expect(isAllowed("ADMIN", rule)).toBe(true);
  });

  it("denies STUDENT on teacher route", () => {
    const rule = matchRouteRule("/teacher/dashboard")!;
    expect(isAllowed("STUDENT", rule)).toBe(false);
  });

  it("allows STUDENT on student route", () => {
    const rule = matchRouteRule("/student/assignments")!;
    expect(isAllowed("STUDENT", rule)).toBe(true);
  });

  it("denies TEACHER on student route", () => {
    const rule = matchRouteRule("/student/assignments")!;
    expect(isAllowed("TEACHER", rule)).toBe(false);
  });

  it("allows only ADMIN on admin route", () => {
    const rule = matchRouteRule("/admin/users")!;
    expect(isAllowed("ADMIN", rule)).toBe(true);
    expect(isAllowed("TEACHER", rule)).toBe(false);
    expect(isAllowed("STUDENT", rule)).toBe(false);
  });
});
