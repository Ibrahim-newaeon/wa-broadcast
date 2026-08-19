import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./db";
import { env } from "./env";
import { verifyToken, ACCESS_COOKIE, ACTING_CLIENT_COOKIE } from "./auth";
import { DEFAULT_CLIENT_ID } from "./tenancy";
import { hostTenantSlug, resolveHostAccess } from "./hostTenancy";
import { clientIdBySlug, slugByClientId } from "./hostClient";
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

/** Role + clientId + host slug for a known subject (used on login/refresh).
 *  Env admin → SUPERADMIN. */
export async function getUserAuth(email: string): Promise<{ role: string; clientId: string; slug: string | null }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) return { role: user.role, clientId: user.clientId, slug: await slugByClientId(user.clientId) };
  if (email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) {
    return { role: "SUPERADMIN", clientId: DEFAULT_CLIENT_ID, slug: null };
  }
  return { role: "MEMBER", clientId: DEFAULT_CLIENT_ID, slug: null };
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

export interface AuthContext {
  email: string;
  role: string;
  clientId: string;
  /** The tenant is fixed by the hostname or the role — don't offer the switcher. */
  pinned: boolean;
}

/** The hostname this request arrived on, as the browser addressed it. */
function requestHost(headers: { get(name: string): string | null }): string {
  return headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
}

/**
 * Resolve who the caller is and which tenant they may act on, given the
 * hostname they used. Returns null when the token is missing/invalid OR when
 * this host does not serve this user's tenant — callers must treat null as
 * "no access", never as "the default client".
 */
async function contextFor(
  claims: { sub?: string; role?: string; cid?: string },
  host: string,
  actingCookie: string | undefined,
): Promise<AuthContext | null> {
  if (!claims.sub) return null;
  const role = claims.role ?? "MEMBER";
  const own = claims.cid ?? DEFAULT_CLIENT_ID;
  const hostSlug = hostTenantSlug(host);
  const [hostClientId, ownSlug] = await Promise.all([
    hostSlug ? clientIdBySlug(hostSlug) : Promise.resolve(null),
    slugByClientId(own),
  ]);
  const access = resolveHostAccess({ hostSlug, hostClientId, role, ownClientId: own, ownSlug, actingCookie }, host);
  if (!access.ok) return null;
  return { email: claims.sub, role, clientId: access.clientId, pinned: access.pinned };
}

/** Read the verified access token and return the caller's tenant context.
 *  Routes are already gated by middleware; this applies the host↔tenant rules
 *  authoritatively, against the database rather than the token's claims. */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return null;
  return contextFor(claims, requestHost(req.headers), req.cookies.get(ACTING_CLIENT_COOKIE)?.value);
}

/**
 * Shortcut: the caller's effective clientId.
 *
 * Throws when a valid session is used on a hostname that does not serve its
 * tenant. That is unreachable behind the middleware, which rejects the request
 * first — but it must fail closed rather than fall back to the default client,
 * which would hand one tenant's data out at another tenant's address.
 */
export async function getClientId(req: NextRequest): Promise<string> {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return DEFAULT_CLIENT_ID; // unauthenticated: routes reject upstream
  const ctx = await contextFor(claims, requestHost(req.headers), req.cookies.get(ACTING_CLIENT_COOKIE)?.value);
  if (!ctx) throw new Error("host does not serve this tenant");
  return ctx.clientId;
}

/** Server-component variant: read the caller's context from cookies + headers. */
export async function getAuthContextFromCookies(): Promise<AuthContext | null> {
  const { cookies, headers } = await import("next/headers");
  const [jar, hdrs] = await Promise.all([cookies(), headers()]);
  const claims = await verifyToken(jar.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return null;
  return contextFor(claims, requestHost(hdrs), jar.get(ACTING_CLIENT_COOKIE)?.value);
}

/** Server-component variant: the caller's effective clientId. Sends the caller
 *  back to /login when this hostname does not serve their tenant. */
export async function getClientIdFromCookies(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const claims = await verifyToken(jar.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return DEFAULT_CLIENT_ID; // middleware already redirects these
  const ctx = await getAuthContextFromCookies();
  if (ctx) return ctx.clientId;
  // Wrong hostname for this tenant — bounce to login, which explains why.
  const { redirect } = await import("next/navigation");
  return redirect("/login?e=host");
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
