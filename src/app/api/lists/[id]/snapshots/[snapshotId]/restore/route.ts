import { NextRequest, NextResponse } from "next/server";
import { restoreSnapshot } from "@/lib/snapshots";
import { prisma } from "@/lib/db";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** POST /api/lists/:id/snapshots/:snapshotId/restore — restore the list to a
 *  snapshot (ADMIN only — overwrites the list's current membership). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; snapshotId: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, snapshotId } = await ctx.params;
  // The list (and therefore its snapshots) must belong to the caller's client.
  const list = await prisma.contactList.findFirst({
    where: { id, clientId: await getClientId(req) },
    select: { id: true },
  });
  if (!list) return NextResponse.json({ error: "list not found" }, { status: 404 });
  const snap = await prisma.contactListSnapshot.findFirst({ where: { id: snapshotId, listId: id }, select: { id: true } });
  if (!snap) return NextResponse.json({ error: "snapshot not found" }, { status: 404 });

  const result = await restoreSnapshot(snapshotId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  void audit(req, "list.restored", id, { snapshotId });
  return NextResponse.json(result);
}
