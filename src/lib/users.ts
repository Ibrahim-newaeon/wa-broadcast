import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "./db";
import { env } from "./env";
import { verifyToken, ACCESS_COOKIE } from "./auth";

// Node-only auth helpers (DB + bcrypt). The single env admin is used to
// BOOTSTRAP when no users exist yet; afterwards everything is DB-backed.

export interface VerifiedUser { email: string; role: string }

/** Verify credentials against the DB, falling back to the env admin only when
 *  the Users table is empty (first-run bootstrap). Returns null on failure. */
export async function verifyCredentials(email: string, password: string): Promise<VerifiedUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    return (await bcrypt.compare(password, user.passwordHash))
      ? { email: user.email, role: user.role }
      : null;
  }
  // Bootstrap path: no DB user with this email.
  const count = await prisma.user.count();
  if (count === 0 && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) {
    return (await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH))
      ? { email: env.ADMIN_EMAIL.toLowerCase(), role: "ADMIN" }
      : null;
  }
  return null;
}

/** Role for a known subject (used on refresh). Env admin → ADMIN. */
export async function getUserRole(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) return user.role;
  if (email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) return "ADMIN";
  return "MEMBER";
}

export async function createUser(input: { email: string; name?: string; password: string; role: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      passwordHash,
      role: input.role === "ADMIN" ? "ADMIN" : "MEMBER",
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

/** Read the access token and require ADMIN. Returns claims or null. */
export async function requireAdmin(req: NextRequest) {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims || claims.role !== "ADMIN") return null;
  return claims;
}
