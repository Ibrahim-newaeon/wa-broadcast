import { NextRequest, NextResponse } from "next/server";
import { restoreSnapshot } from "@/lib/snapshots";

export const runtime = "nodejs";

/** POST /api/lists/:id/snapshots/:snapshotId/restore — restore the list to a snapshot. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string; snapshotId: string }> }) {
  const { snapshotId } = await ctx.params;
  const result = await restoreSnapshot(snapshotId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result);
}
