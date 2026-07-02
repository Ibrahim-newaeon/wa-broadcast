import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./db";
import { env } from "./env";
import { verifyToken, ACCESS_COOKIE, ACTING_CLIENT_COOKIE } from "./auth";
import { DEFAULT_CLIENT_ID, resolveActingClientId } from "./tenancy";
import { isAdminRole } from "./rbac";

// Node-only auth helpers (DB + bcrypt). The single env admin is used to
// BOOTSTRAP when no users exist yet; afterwards everything is DB-backed.

export interface VerifiedUser { email: string; role: string; clientId: string }

/** Verify credentials against the DB, falling back to the env admin only when
 *  the Users table is empty (first-run bootstrap). Returns null on failure. */
export async function verifyCredentials(email: string, password: string): Promise<VerifiedUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    return (await bcrypt.compare(password, user.passwordHash))
      ? { email: user.email, role: user.role, clientId: user.clientId }
      : null;
  }
  // Bootstrap path: no DB user with this email.
  const count = await prisma.user.count();
  if (count === 0 && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) {
    return (await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH))
      ? { email: env.ADMIN_EMAIL.toLowerCase(), role: "SUPERADMIN", clientId: DEFAULT_CLIENT_ID }
      : null;
  }
  return null;
}

/** Role + clientId for a known subject (used on refresh). Env admin → SUPERADMIN. */
export async function getUserAuth(email: string): Promise<{ role: string; clientId: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) return { role: user.role, clientId: user.clientId };
  if (email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) return { role: "SUPERADMIN", clientId: DEFAULT_CLIENT_ID };
  return { role: "MEMBER", clientId: DEFAULT_CLIENT_ID };
}

export async function createUser(input: { email: string; name?: string; password: string; role: string; clientId: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      passwordHash,
      role: input.role === "ADMIN" ? "ADMIN" : "MEMBER",
      clientId: input.clientId,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

/** Generate a strong, human-typeable random password (no ambiguous chars). */
export function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export interface AuthContext { email: string; role: string; clientId: string }

/** Read the verified access token and return the caller's tenant context.
 *  Routes are already gated by middleware; this just exposes the claims.
 *  For super-admins, an "acting client" cookie overrides their own clientId. */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return null;
  const role = claims.role ?? "MEMBER";
  const own = claims.cid ?? DEFAULT_CLIENT_ID;
  return {
    email: claims.sub,
    role,
    clientId: resolveActingClientId(role, own, req.cookies.get(ACTING_CLIENT_COOKIE)?.value),
  };
}

/** Shortcut: the caller's effective clientId (honors a super-admin's acting client). */
export async function getClientId(req: NextRequest): Promise<string> {
  return (await getAuthContext(req))?.clientId ?? DEFAULT_CLIENT_ID;
}

/** Server-component variant: read the caller's effective clientId from cookies. */
export async function getClientIdFromCookies(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const claims = await verifyToken(jar.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return DEFAULT_CLIENT_ID;
  return resolveActingClientId(claims.role ?? "MEMBER", claims.cid ?? DEFAULT_CLIENT_ID, jar.get(ACTING_CLIENT_COOKIE)?.value);
}

/** Read the access token and require ADMIN (or SUPERADMIN). Returns claims or null. */
export async function requireAdmin(req: NextRequest) {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims || !isAdminRole(claims.role)) return null;
  return claims;
}

/** Require SUPERADMIN (cross-client management). Returns claims or null. */
export async function requireSuperAdmin(req: NextRequest) {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims || claims.role !== "SUPERADMIN") return null;
  return claims;
}
