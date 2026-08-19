import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";
import { listDeleteBlockReason } from "@/lib/listDeletion";

export const runtime = "nodejs";

/**
 * DELETE /api/lists/:id (ADMIN only, scoped to the caller's client).
 *
 * Removes the list, its memberships and its snapshots. Contacts are never
 * deleted — they stay in the address book. Refused while a broadcast or a
 * recurring campaign still points at the list.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const clientId = await getClientId(req);

  const list = await prisma.contactList.findFirst({
    where: { id, clientId },
    select: { id: true, name: true, _count: { select: { memberships: true } } },
  });
  if (!list) return NextResponse.json({ error: "list not found" }, { status: 404 });

  const [broadcasts, campaigns] = await Promise.all([
    prisma.broadcast.count({ where: { listId: id, clientId } }),
    prisma.recurringCampaign.count({ where: { listId: id, clientId } }),
  ]);
  const blocked = listDeleteBlockReason(list.name, { broadcasts, campaigns });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const members = list._count.memberships;
  try {
    await prisma.contactList.delete({ where: { id } });
  } catch (err) {
    // A broadcast created between the count and the delete trips the FK.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: `“${list.name}” was just used by a broadcast — it can no longer be deleted.` },
        { status: 409 },
      );
    }
    throw err;
  }

  void audit(req, "list.deleted", list.name, { members });
  return NextResponse.json({ ok: true, name: list.name, members });
}
