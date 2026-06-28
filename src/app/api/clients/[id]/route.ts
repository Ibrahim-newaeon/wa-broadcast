import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/users";
import { DEFAULT_CLIENT_ID } from "@/lib/tenancy";
import { removeSchedule } from "@/lib/recurring";
import { ACTING_CLIENT_COOKIE, cookieBase } from "@/lib/auth";

export const runtime = "nodejs";

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

  const res = NextResponse.json({ ok: true, deleted: client.name });
  // If the caller was acting as the now-deleted client, drop the stale cookie.
  if (req.cookies.get(ACTING_CLIENT_COOKIE)?.value === id) {
    res.cookies.set(ACTING_CLIENT_COOKIE, "", { ...cookieBase, maxAge: 0 });
  }
  return res;
}
