import { NextRequest, NextResponse } from "next/server";
import { CreateBroadcastSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { createAndEnqueueBroadcast } from "@/lib/broadcast";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** POST /api/broadcasts — create + enqueue (immediate or scheduled). */
export async function POST(req: NextRequest) {
  const parsed = CreateBroadcastSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { templateId, listId, variableMap, scheduleAt, headerMediaUrl } = parsed.data;

  const result = await createAndEnqueueBroadcast({
    clientId: await getClientId(req),
    templateId,
    listId,
    variableMap,
    scheduledAt: scheduleAt ? new Date(scheduleAt) : null,
    headerMediaUrl,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code ?? 422 });
  return NextResponse.json({ broadcastId: result.broadcastId, queued: result.queued, scheduledAt: result.scheduledAt });
}

/** GET /api/broadcasts — list with progress. */
export async function GET() {
  const broadcasts = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { template: true, list: true },
  });
  return NextResponse.json({ broadcasts });
}
