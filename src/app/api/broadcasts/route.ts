import { NextRequest, NextResponse } from "next/server";
import { CreateBroadcastSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { createAndEnqueueBroadcast } from "@/lib/broadcast";
import { getClientId } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** POST /api/broadcasts — create + enqueue (immediate or scheduled). */
export async function POST(req: NextRequest) {
  const parsed = CreateBroadcastSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { templateId, listId, variableMap, scheduleAt, headerMediaUrl, couponCode, cardMediaUrls, ltoExpiresAt } = parsed.data;

  const result = await createAndEnqueueBroadcast({
    clientId: await getClientId(req),
    templateId,
    listId,
    variableMap,
    scheduledAt: scheduleAt ? new Date(scheduleAt) : null,
    headerMediaUrl,
    couponCode,
    cardMediaUrls,
    ltoExpiresAt: ltoExpiresAt ? new Date(ltoExpiresAt) : null,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code ?? 422 });
  void audit(req, result.scheduledAt ? "broadcast.scheduled" : "broadcast.sent", result.broadcastId, {
    templateId, listId, queued: result.queued, ...(result.scheduledAt ? { scheduledAt: result.scheduledAt } : {}),
  });
  return NextResponse.json({
    broadcastId: result.broadcastId,
    queued: result.queued,
    scheduledAt: result.scheduledAt,
    // Present only when some recipients could not be queued; they are already
    // marked FAILED and can be re-sent from the broadcast's Retry action.
    ...(result.failed ? { failed: result.failed, warning: result.warning } : {}),
  });
}

/** GET /api/broadcasts — list this client's broadcasts with progress. */
export async function GET(req: NextRequest) {
  const broadcasts = await prisma.broadcast.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { template: true, list: true },
  });
  return NextResponse.json({ broadcasts });
}
