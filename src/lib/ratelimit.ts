import { connection } from "./queue";

/**
 * Fixed-window rate limiter backed by Redis (shared across instances).
 * Returns { allowed, remaining }. Fails OPEN if Redis is unreachable
 * (availability > strictness for a login form; tune per your threat model).
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `rl:${key}`;
  try {
    const count = await connection.incr(redisKey);
    if (count === 1) await connection.expire(redisKey, windowSeconds);
    return { allowed: count <= max, remaining: Math.max(0, max - count) };
  } catch {
    return { allowed: true, remaining: max };
  }
}
