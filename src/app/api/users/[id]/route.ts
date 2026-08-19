import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, getClientId } from "@/lib/users";
import { bumpVersion } from "@/lib/tokenStore";
import { userEditBlockReason, userDeleteBlockReason } from "@/lib/userAdmin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const UpdateUserSchema = z
  .object({
    name: z.string().trim().max(120).nullable().optional(),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
    password: z.string().min(8, "password must be ≥8 chars").max(200).optional(),
  })
  .refine((v) => v.name !== undefined || v.role !== undefined || v.password !== undefined, {
    message: "nothing to update",
  });

/** Load the target user inside the caller's acting client + the guard inputs. */
async function loadTarget(req: NextRequest, id: string) {
  const clientId = await getClientId(req);
  const target = await prisma.user.findFirst({
    where: { id, clientId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target) return null;
  // Admins left in this client if the target were gone — guards the last-admin lockout.
  const otherAdmins = await prisma.user.count({
    where: { clientId, id: { not: id }, role: { in: ["ADMIN", "SUPERADMIN"] } },
  });
  return { target, otherAdmins };
}

/**
 * PATCH /api/users/:id — rename, change role, or reset the password of a
 * teammate in the caller's (acting) client. ADMIN only.
 *
 * A password reset bumps the user's refresh-token version, so every other
 * session they have can no longer refresh (access tokens still expire ≤15m).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAdmin(req);
  if (!claims?.sub) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = UpdateUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const found = await loadTarget(req, id);
  if (!found) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const { target, otherAdmins } = found;

  const actor = { email: claims.sub, role: claims.role ?? "MEMBER" };
  const blocked = userEditBlockReason({ actor, target, otherAdmins }, parsed.data.role);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const { name, role, password } = parsed.data;
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(password !== undefined ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (password !== undefined) {
    await bumpVersion(target.email); // sign the user out everywhere
    void audit(req, "user.password_reset", target.email);
  }
  if (name !== undefined || role !== undefined) {
    void audit(req, "user.updated", target.email, {
      ...(role !== undefined && role !== target.role ? { role, previousRole: target.role } : {}),
      ...(name !== undefined ? { renamed: true } : {}),
    });
  }

  return NextResponse.json({ user });
}

/** DELETE /api/users/:id — remove a teammate from the caller's (acting) client. ADMIN only. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const claims = await requireAdmin(req);
  if (!claims?.sub) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const found = await loadTarget(req, id);
  if (!found) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const { target, otherAdmins } = found;

  const actor = { email: claims.sub, role: claims.role ?? "MEMBER" };
  const blocked = userDeleteBlockReason({ actor, target, otherAdmins });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  await prisma.user.delete({ where: { id } });
  await bumpVersion(target.email); // kill any session they still hold
  void audit(req, "user.deleted", target.email, { role: target.role });

  return NextResponse.json({ ok: true, email: target.email });
}
