import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyToken, cookieBase, ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { verifyCredentials } from "@/lib/users";
import { bumpVersion } from "@/lib/tokenStore";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "new password must be ≥8 chars").max(200),
});

/**
 * POST /api/auth/change-password — change your OWN password (any role,
 * super-admin included). The current password must be supplied, so a stolen
 * session cannot lock the owner out.
 *
 * On success every session is invalidated (token version bumped) and this
 * request's cookies are cleared: the caller signs in again with the new
 * password.
 */
export async function POST(req: NextRequest) {
  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (!claims?.sub) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Same budget as login — this endpoint also checks a password.
  const rl = await rateLimit(`pwchange:${claims.sub}`, 5, 300);
  if (!rl.allowed) return NextResponse.json({ error: "too many attempts, try later" }, { status: 429 });

  const parsed = ChangePasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (!(await verifyCredentials(claims.sub, currentPassword))) {
    return NextResponse.json({ error: "current password is incorrect" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "the new password must be different" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.updateMany({
    where: { email: claims.sub.toLowerCase() },
    data: { passwordHash },
  });
  if (updated.count === 0) {
    // Bootstrap admin: authenticated from env, no DB row to update yet.
    return NextResponse.json(
      { error: "this account still logs in from the environment — run scripts/seed-admin.mjs to move it into the database first" },
      { status: 409 },
    );
  }

  await bumpVersion(claims.sub);
  void audit(req, "user.password_changed", claims.sub);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { ...cookieBase, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return res;
}
