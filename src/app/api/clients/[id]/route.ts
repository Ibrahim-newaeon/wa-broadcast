import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/users";
import { DEFAULT_CLIENT_ID } from "@/lib/tenancy";
import { removeSchedule } from "@/lib/recurring";
import { ACTING_CLIENT_COOKIE, cookieBase } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { invalidateHostClientCache } from "@/lib/hostClient";
import { RESERVED_HOST_LABELS } from "@/lib/hostTenancy";

export const runtime = "nodejs";

const UpdateClientSchema = z.object({
  // "" clears the subdomain and puts the client back on the console host.
  slug: z
    .string()
    .trim()
    .regex(/^([a-z0-9-]{2,40})?$/, "Subdomain: 2–40 lowercase letters, numbers, or hyphens")
    .refine((v) => !RESERVED_HOST_LABELS.has(v), "That name is reserved for the platform"),
});

/**
 * PATCH /api/clients/:id — give a client its own subdomain, or take it away
 * (SUPERADMIN only).
 *
 * Saving a subdomain does NOT bind it: `slugActive` stays false until
 * /verify-host proves the address resolves. Otherwise a client's users would be
 * required to use a hostname that does not exist yet, locking them out.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = UpdateClientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const slug = parsed.data.slug || null;
  if (slug && slug !== client.slug) {
    const clash = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (clash) return NextResponse.json({ error: "That subdomain is already taken." }, { status: 409 });
  }

  const updated = await prisma.client.update({
    where: { id },
    // Any change re-opens verification: a new name has never been proven.
    data: { slug, slugActive: slug === client.slug ? undefined : false },
    select: { id: true, name: true, slug: true, slugActive: true },
  });
  invalidateHostClientCache();
  void audit(req, slug ? "client.subdomain_set" : "client.subdomain_cleared", client.name, { slug });

  return NextResponse.json({ client: updated });
}

/**
 * DELETE /api/clients/:id — permanently delete a tenant and ALL its data
 * (SUPERADMIN only). The bootstrap "default" client cannot be deleted.
 * Order respects FK constraints; BullMQ schedules are removed first.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (id === DEFAULT_CLIENT_ID) {
    return NextResponse.json({ error: "The default client cannot be deleted." }, { status: 400 });
  }
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  // Stop the recurring job-schedulers before the campaign rows go away.
  const campaigns = await prisma.recurringCampaign.findMany({ where: { clientId: id }, select: { id: true } });
  for (const c of campaigns) await removeSchedule(c.id).catch(() => {});

  // FK-safe cascade: events → recipients → broadcasts, then contacts/lists
  // (memberships + snapshots cascade), then the rest, then the client row.
  await prisma.$transaction([
    prisma.messageEvent.deleteMany({ where: { recipient: { broadcast: { clientId: id } } } }),
    prisma.broadcastRecipient.deleteMany({ where: { broadcast: { clientId: id } } }),
    prisma.broadcast.deleteMany({ where: { clientId: id } }),
    prisma.message.deleteMany({ where: { clientId: id } }),
    prisma.conversation.deleteMany({ where: { clientId: id } }),
    prisma.contact.deleteMany({ where: { clientId: id } }),
    prisma.contactList.deleteMany({ where: { clientId: id } }),
    prisma.template.deleteMany({ where: { clientId: id } }),
    prisma.recurringCampaign.deleteMany({ where: { clientId: id } }),
    prisma.optOut.deleteMany({ where: { clientId: id } }),
    prisma.whatsAppConfig.deleteMany({ where: { clientId: id } }),
    prisma.user.deleteMany({ where: { clientId: id } }),
    prisma.client.delete({ where: { id } }),
  ]);

  // Audit rows are append-only and deliberately survive the tenant they describe.
  invalidateHostClientCache(); // its slug no longer binds a hostname
  void audit(req, "client.deleted", client.name, { clientId: id });

  const res = NextResponse.json({ ok: true, deleted: client.name });
  // If the caller was acting as the now-deleted client, drop the stale cookie.
  if (req.cookies.get(ACTING_CLIENT_COOKIE)?.value === id) {
    res.cookies.set(ACTING_CLIENT_COOKIE, "", { ...cookieBase, maxAge: 0 });
  }
  return res;
}
