export type ApiResponse<T = unknown> =
  | { success: true; data: T; traceId: string }
  | { success: false; error: string; code: string; traceId: string };

export function ok<T>(data: T, traceId: string): ApiResponse<T> {
  return { success: true, data, traceId };
}

export function fail(
  error: string,
  code: string,
  traceId: string
): ApiResponse<never> {
  return { success: false, error, code, traceId };
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("Too many requests", "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}
