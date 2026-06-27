import { NextRequest, NextResponse } from "next/server";
import { verifyToken, cookieBase, ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { bumpVersion } from "@/lib/tokenStore";

export const runtime = "nodejs";

/** Sign out EVERYWHERE: bump the user's token version so every outstanding
 *  refresh token is invalidated. Access tokens expire within ≤15m. */
export async function POST(req: NextRequest) {
  // Identify the user from whichever valid token is present.
  const claims =
    (await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access")) ??
    (await verifyToken(req.cookies.get(REFRESH_COOKIE)?.value, "refresh"));
  if (!claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await bumpVersion(claims.sub);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieBase, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return res;
}
