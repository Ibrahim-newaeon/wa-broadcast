import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId, requireAdmin } from "@/lib/users";
import { UpdateRedirectSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Load a link only if it belongs to the caller's client. Slugs are globally
 * unique, so without the clientId filter an admin could repoint another
 * tenant's template button by guessing an id.
 */
async function ownedBy(req: NextRequest, id: string) {
  return prisma.redirectLink.findFirst({ where: { id, clientId: await getClientId(req) } });
}

/**
 * PATCH /api/redirects/:id — repoint a slug at a new destination.
 *
 * The slug itself cannot be changed: it is printed inside approved templates,
 * where editing costs a Meta re-review. Repointing is the whole point.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = UpdateRedirectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const existing = await ownedBy(req, id);
  if (!existing) return NextResponse.json({ error: "link not found" }, { status: 404 });

  const link = await prisma.redirectLink.update({ where: { id }, data: { url: parsed.data.url } });
  void audit(req, "redirect.updated", existing.slug, { from: existing.url, to: parsed.data.url });
  return NextResponse.json({ link });
}

/**
 * DELETE /api/redirects/:id — remove a destination.
 *
 * Every template button already pointing at this slug starts 404ing, which is
 * why the UI warns before calling this.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await ownedBy(req, id);
  if (!existing) return NextResponse.json({ error: "link not found" }, { status: 404 });

  await prisma.redirectLink.delete({ where: { id } });
  void audit(req, "redirect.deleted", existing.slug, { url: existing.url });
  return NextResponse.json({ ok: true });
}
