import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { LoginSchema } from "@/lib/validation";
import { env } from "@/lib/env";
import {
  signAccess, signRefresh, cookieBase, ACCESS_COOKIE, REFRESH_COOKIE,
  ACCESS_MAX_AGE, REFRESH_TTL_SECONDS,
} from "@/lib/auth";
import { getVersion, registerJti } from "@/lib/tokenStore";
import { verifyCredentials } from "@/lib/users";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`login:${ip}`, env.LOGIN_RATE_MAX, env.LOGIN_RATE_WINDOW);
  if (!rl.allowed) return NextResponse.json({ error: "too many attempts, try later" }, { status: 429 });

  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  const { email, password } = parsed.data;
  const user = await verifyCredentials(email, password);
  if (!user) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const sub = user.email;
  const ver = await getVersion(sub);
  const jti = crypto.randomUUID();
  await registerJti(jti);

  const [access, refresh] = await Promise.all([
    signAccess(sub, user.role, user.clientId),
    signRefresh(sub, ver, jti),
  ]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, access, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, refresh, { ...cookieBase, maxAge: REFRESH_TTL_SECONDS });
  return res;
}
