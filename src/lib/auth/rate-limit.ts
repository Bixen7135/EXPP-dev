import { redis } from "@/lib/redis/client";
import { RateLimitError } from "@/lib/errors";

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 10;

export async function checkRateLimit(identifier: string): Promise<void> {
  const key = `rate_limit:auth:${identifier}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  if (current > MAX_ATTEMPTS) {
    throw new RateLimitError();
  }
}
