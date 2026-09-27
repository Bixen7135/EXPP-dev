import { redis } from "@/lib/redis/client";
import { RateLimitError } from "@/lib/errors";

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 10;
const VERIFY_RESEND_WINDOW_SECONDS = 300;
const VERIFY_RESEND_MAX_ATTEMPTS_PER_IP = 15;
const VERIFY_RESEND_MAX_ATTEMPTS_PER_EMAIL = 5;

async function bumpAndCheckRateLimit(opts: {
  key: string;
  windowSeconds: number;
  maxAttempts: number;
}): Promise<void> {
  const current = await redis.incr(opts.key);
  if (current === 1) {
    await redis.expire(opts.key, opts.windowSeconds);
  }
  if (current > opts.maxAttempts) {
    throw new RateLimitError();
  }
}

export async function checkRateLimit(identifier: string): Promise<void> {
  const key = `rate_limit:auth:${identifier}`;
  await bumpAndCheckRateLimit({
    key,
    windowSeconds: WINDOW_SECONDS,
    maxAttempts: MAX_ATTEMPTS,
  });
}

export async function checkVerificationResendRateLimit(opts: {
  ip: string;
  email: string;
}): Promise<void> {
  await bumpAndCheckRateLimit({
    key: `rate_limit:verify_email:ip:${opts.ip}`,
    windowSeconds: VERIFY_RESEND_WINDOW_SECONDS,
    maxAttempts: VERIFY_RESEND_MAX_ATTEMPTS_PER_IP,
  });

  await bumpAndCheckRateLimit({
    key: `rate_limit:verify_email:email:${opts.email}`,
    windowSeconds: VERIFY_RESEND_WINDOW_SECONDS,
    maxAttempts: VERIFY_RESEND_MAX_ATTEMPTS_PER_EMAIL,
  });
}
