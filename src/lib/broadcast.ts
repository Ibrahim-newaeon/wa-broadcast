import { prisma } from "./db";
import { sendQueue } from "./queue";

// variableMap entries: { from: <field> } (pulls "name" / a contact attribute)
// or { literal: <text> }.
export type VariableMap = ({ from: string } | { literal: string })[];

export function resolveBodyParams(
  variableMap: VariableMap,
  contact: { name: string | null; attributes: unknown },
): string[] {
  const attrs = (contact.attributes ?? {}) as Record<string, string>;
  return variableMap.map((v) =>
    "literal" in v ? v.literal : v.from === "name" ? contact.name ?? "" : attrs[v.from] ?? "",
  );
}

export interface EnqueueResult {
  ok: boolean;
  broadcastId?: string;
  queued?: number;
  scheduledAt?: string | null;
  error?: string;
  code?: number;
}

/**
 * Create a broadcast and enqueue one send job per opted-in recipient.
 * Shared by the manual broadcast API and the recurring scheduler so the
 * opt-out filtering, idempotency, and scheduling logic live in one place.
 */
export async function createAndEnqueueBroadcast(opts: {
  templateId: string;
  listId: string;
  variableMap: VariableMap;
  scheduledAt?: Date | null;
  headerMediaUrl?: string | null;
}): Promise<EnqueueResult> {
  const template = await prisma.template.findUnique({ where: { id: opts.templateId } });
  if (!template) return { ok: false, error: "template not found", code: 404 };
  if (template.status !== "APPROVED") return { ok: false, error: "template not approved by Meta", code: 422 };

  // A media-header template needs the media supplied for this send.
  const mediaHeader = ["IMAGE", "DOCUMENT", "VIDEO"].includes(template.headerFormat ?? "");
  const headerMediaUrl = mediaHeader ? (opts.headerMediaUrl ?? "").trim() : null;
  if (mediaHeader && !headerMediaUrl) {
    return { ok: false, error: "this template has a media header — provide a media URL", code: 422 };
  }

  const optOuts = new Set((await prisma.optOut.findMany({ select: { phone: true } })).map((o) => o.phone));
  const members = await prisma.contactListMembership.findMany({
    where: { listId: opts.listId },
    include: { contact: true },
  });
  const recipients = members.map((m) => m.contact).filter((c) => !c.optedOut && !optOuts.has(c.phone));
  if (recipients.length === 0) return { ok: false, error: "no opted-in recipients in list", code: 422 };

  const scheduledAt = opts.scheduledAt ?? null;
  const delayMs = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;

  const broadcast = await prisma.broadcast.create({
    data: {
      templateId: opts.templateId,
      listId: opts.listId,
      status: scheduledAt ? "SCHEDULED" : "SENDING",
      totalCount: recipients.length,
      variableMap: opts.variableMap,
      headerMediaUrl,
      scheduledAt,
      startedAt: scheduledAt ? null : new Date(),
    },
  });

  for (const contact of recipients) {
    const rec = await prisma.broadcastRecipient.create({
      data: { broadcastId: broadcast.id, contactId: contact.id, status: "PENDING" },
    });
    await sendQueue.add(
      "send",
      {
        broadcastId: broadcast.id,
        recipientId: rec.id,
        to: contact.phone,
        templateName: template.name,
        language: template.language,
        bodyParams: resolveBodyParams(opts.variableMap, contact),
        headerFormat: template.headerFormat,
        headerMediaUrl,
      },
      { jobId: `${broadcast.id}:${contact.id}`, delay: delayMs },
    );
  }

  return { ok: true, broadcastId: broadcast.id, queued: recipients.length, scheduledAt: scheduledAt?.toISOString() ?? null };
}
