import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendQueue } from "@/lib/queue";
import { resolveBodyParams, type VariableMap } from "@/lib/broadcast";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/**
 * POST /api/broadcasts/:id/retry
 * Re-enqueues every FAILED recipient: resets them to PENDING, recomputes the
 * template params from the saved variableMap, and queues fresh jobs (new jobId
 * so BullMQ doesn't dedupe against the original completed job).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const clientId = await getClientId(req);

  const broadcast = await prisma.broadcast.findFirst({
    where: { id, clientId },
    include: { template: true },
  });
  if (!broadcast) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (broadcast.template.status !== "APPROVED") {
    return NextResponse.json({ error: "template no longer approved" }, { status: 422 });
  }

  // Skip opted-out contacts even on retry.
  const optOuts = new Set(
    (await prisma.optOut.findMany({ where: { clientId }, select: { phone: true } })).map((o) => o.phone),
  );

  const failed = await prisma.broadcastRecipient.findMany({
    where: { broadcastId: id, status: "FAILED" },
    include: { contact: true },
  });
  const retriable = failed.filter((r) => !r.contact.optedOut && !optOuts.has(r.contact.phone));

  if (retriable.length === 0) {
    return NextResponse.json({ retried: 0, message: "no retriable failed recipients" });
  }

  const variableMap = (broadcast.variableMap ?? []) as VariableMap;
  const stamp = Date.now();

  await prisma.broadcast.update({
    where: { id },
    data: {
      status: "SENDING",
      // these will be re-counted as jobs complete
      failedCount: { decrement: retriable.length },
      completedAt: null,
    },
  });

  for (const rec of retriable) {
    await prisma.broadcastRecipient.update({
      where: { id: rec.id },
      data: { status: "PENDING", error: null, wamid: null },
    });

    await sendQueue.add(
      "send",
      {
        broadcastId: id,
        clientId,
        recipientId: rec.id,
        to: rec.contact.phone,
        templateName: broadcast.template.name,
        language: broadcast.template.language,
        bodyParams: resolveBodyParams(variableMap, rec.contact),
        headerFormat: broadcast.template.headerFormat,
        headerMediaUrl: broadcast.headerMediaUrl,
      },
      { jobId: `${id}:${rec.contactId}:r${stamp}` }, // fresh id avoids dedupe
    );
  }

  return NextResponse.json({ retried: retriable.length });
}
