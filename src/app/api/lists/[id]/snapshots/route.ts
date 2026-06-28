import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { snapshotList } from "@/lib/snapshots";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** Returns true if the list belongs to the caller's client. */
async function ownsList(req: NextRequest, listId: string): Promise<boolean> {
  const list = await prisma.contactList.findFirst({
    where: { id: listId, clientId: await getClientId(req) },
    select: { id: true },
  });
  return !!list;
}

/** GET /api/lists/:id/snapshots — list a contact list's snapshots (newest first). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await ownsList(req, id))) return NextResponse.json({ error: "list not found" }, { status: 404 });
  const snapshots = await prisma.contactListSnapshot.findMany({
    where: { listId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, listName: true, memberCount: true, reason: true, createdAt: true },
  });
  return NextResponse.json({ snapshots });
}

/** POST /api/lists/:id/snapshots — take a manual snapshot now. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await ownsList(req, id))) return NextResponse.json({ error: "list not found" }, { status: 404 });
  const snap = await snapshotList(id, "manual");
  if (!snap) return NextResponse.json({ error: "list not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...snap }, { status: 201 });
}
