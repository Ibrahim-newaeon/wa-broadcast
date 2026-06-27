import { connection } from "./queue";
import { REFRESH_TTL_SECONDS } from "./auth";

// Redis-backed refresh-token state. Node runtime only (uses ioredis).
//   rt:ver:<sub>  → integer token version. Bumping it invalidates every
//                   outstanding refresh token for that user (logout-everywhere).
//   rt:jti:<jti>  → presence marker for an active (not-yet-rotated) refresh jti.

const verKey = (sub: string) => `rt:ver:${sub}`;
const jtiKey = (jti: string) => `rt:jti:${jti}`;

/** Current token version, lazily initialized to 1. */
export async function getVersion(sub: string): Promise<number> {
  const v = await connection.get(verKey(sub));
  if (v !== null) return Number(v);
  await connection.set(verKey(sub), "1");
  return 1;
}

/** Invalidate ALL refresh tokens for this user (logout-everywhere / reuse defense). */
export async function bumpVersion(sub: string): Promise<number> {
  return connection.incr(verKey(sub)); // missing key → 1, otherwise +1
}

export async function registerJti(jti: string): Promise<void> {
  await connection.set(jtiKey(jti), "1", "EX", REFRESH_TTL_SECONDS);
}

export async function isJtiActive(jti: string): Promise<boolean> {
  return (await connection.exists(jtiKey(jti))) === 1;
}

export async function revokeJti(jti: string): Promise<void> {
  await connection.del(jtiKey(jti));
}
