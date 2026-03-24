import { describe, it, expect } from "vitest";
import {
  ok,
  fail,
  AppError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from "@/lib/errors";

describe("API response envelope", () => {
  it("ok() builds a success response", () => {
    const res = ok({ foo: "bar" }, "trace-123");
    expect(res).toEqual({ success: true, data: { foo: "bar" }, traceId: "trace-123" });
  });

  it("fail() builds an error response", () => {
    const res = fail("something broke", "BROKEN", "trace-456");
    expect(res).toEqual({
      success: false,
      error: "something broke",
      code: "BROKEN",
      traceId: "trace-456",
    });
  });
});

describe("error classes", () => {
  it("AppError has code and statusCode", () => {
    const e = new AppError("oops", "OOPS", 400);
    expect(e.code).toBe("OOPS");
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe("oops");
  });

  it("AuthError defaults to 401", () => {
    const e = new AuthError("bad creds");
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe("AUTH_ERROR");
  });

  it("ForbiddenError defaults to 403", () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it("NotFoundError defaults to 404", () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it("ValidationError defaults to 422", () => {
    expect(new ValidationError("bad").statusCode).toBe(422);
  });

  it("RateLimitError defaults to 429", () => {
    expect(new RateLimitError().statusCode).toBe(429);
  });
});
