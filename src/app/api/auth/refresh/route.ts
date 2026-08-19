import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  verifyToken, signAccess, signRefresh, cookieBase,
  ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_MAX_AGE, REFRESH_TTL_SECONDS,
} from "@/lib/auth";
import { getVersion, isJtiActive, registerJti, revokeJti, bumpVersion } from "@/lib/tokenStore";
import { getUserAuth } from "@/lib/users";
import { hostTenantSlug, resolveHostAccess } from "@/lib/hostTenancy";
import { clientIdBySlug } from "@/lib/hostClient";

export const runtime = "nodejs";

/**
 * Rotate tokens. Enforces revocation:
 *  - version mismatch  → token was killed by logout-everywhere → 401
 *  - jti not active    → this refresh token was already rotated (replay/theft)
 *                        → revoke the whole family (bump version) → 401
 *  - otherwise         → rotate jti, issue fresh access + refresh
 */
export async function POST(req: NextRequest) {
  const claims = await verifyToken(req.cookies.get(REFRESH_COOKIE)?.value, "refresh");
  if (!claims?.sub || !claims.jti || claims.ver === undefined) {
    return unauthorized();
  }

  const currentVer = await getVersion(claims.sub);
  if (claims.ver !== currentVer) return unauthorized();

  if (!(await isJtiActive(claims.jti))) {
    // Valid signature + version but the jti is gone → already used. Treat as
    // compromise and revoke every session for this user.
    await bumpVersion(claims.sub);
    return unauthorized();
  }

  // Rotate: retire the old jti, mint a new one.
  await revokeJti(claims.jti);
  const newJti = crypto.randomUUID();
  await registerJti(newJti);
  const { role, clientId, slug } = await getUserAuth(claims.sub);

  // Same host rule as login. Without this a session on the wrong hostname would
  // refresh successfully, be redirected by the middleware, and loop.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hostSlug = hostTenantSlug(host);
  const hostClientId = hostSlug ? await clientIdBySlug(hostSlug) : null;
  const allowed = resolveHostAccess(
    { hostSlug, hostClientId, role, ownClientId: clientId, ownSlug: slug },
    host,
  );
  if (!allowed.ok) return unauthorized();

  const [access, refresh] = await Promise.all([
    signAccess(claims.sub, role, clientId, slug),
    signRefresh(claims.sub, currentVer, newJti),
  ]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, access, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, refresh, { ...cookieBase, maxAge: REFRESH_TTL_SECONDS });
  return res;
}

function unauthorized() {
  const res = NextResponse.json({ error: "unauthorized" }, { status: 401 });
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieBase, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return res;
}
