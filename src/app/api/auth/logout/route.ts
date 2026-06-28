import { NextRequest, NextResponse } from "next/server";
import { verifyToken, cookieBase, ACCESS_COOKIE, REFRESH_COOKIE, ACTING_CLIENT_COOKIE } from "@/lib/auth";
import { revokeJti } from "@/lib/tokenStore";

export const runtime = "nodejs";

/** Sign out THIS device: revoke the current refresh jti + clear cookies. */
export async function POST(req: NextRequest) {
  const claims = await verifyToken(req.cookies.get(REFRESH_COOKIE)?.value, "refresh");
  if (claims?.jti) await revokeJti(claims.jti);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieBase, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieBase, maxAge: 0 });
  // Drop any super-admin acting-client selection so it can't leak into the next session.
  res.cookies.set(ACTING_CLIENT_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return res;
}
