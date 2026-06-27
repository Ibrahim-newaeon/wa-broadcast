import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { snapshotList } from "@/lib/snapshots";

export const runtime = "nodejs";

/** GET /api/lists/:id/snapshots — list a contact list's snapshots (newest first). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snapshots = await prisma.contactListSnapshot.findMany({
    where: { listId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, listName: true, memberCount: true, reason: true, createdAt: true },
  });
  return NextResponse.json({ snapshots });
}

/** POST /api/lists/:id/snapshots — take a manual snapshot now. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snap = await snapshotList(id, "manual");
  if (!snap) return NextResponse.json({ error: "list not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...snap }, { status: 201 });
}
