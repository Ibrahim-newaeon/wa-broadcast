import { NextRequest, NextResponse } from "next/server";
import { optOutKeywords } from "@/lib/env";
import {
  getWaConfig, getClientIdByPhoneNumberId, getWebhookClientByWaba,
  isWebhookVerifyToken, DEFAULT_CLIENT_ID,
} from "@/lib/waConfig";
import { WebhookSchema } from "@/lib/validation";
import { verifyWebhookSignature } from "@/lib/webhookSig";
import { recordInboundMessage } from "@/lib/conversations";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const STATUS_MAP = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
} as const;

// Meta message_template_status_update events → our Template.status mirror.
const TEMPLATE_EVENT_MAP: Record<string, string> = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED",
  FLAGGED: "FLAGGED",
  PENDING: "PENDING",
  PENDING_DELETION: "PENDING_DELETION",
};

/** GET — Meta webhook verification handshake (matches ANY client's verify token). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && (await isWebhookVerifyToken(p.get("hub.verify_token") ?? ""))) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** POST — status callbacks + inbound messages. Signature-verified per client. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  // Identify the owning client by WABA id (entry.id) so we verify with THEIR app
  // secret. Reading the body here only selects the secret — the HMAC is still
  // what proves authenticity (a forged WABA id can't yield a valid signature).
  let wabaId: string | undefined;
  try {
    wabaId = JSON.parse(raw)?.entry?.[0]?.id;
  } catch {
    return NextResponse.json({ ok: true }); // unparseable → ack & ignore
  }
  const routed = wabaId ? await getWebhookClientByWaba(String(wabaId)) : null;
  const secret = routed?.appSecret || (await getWaConfig()).appSecret; // default for single-tenant
  if (!verifyWebhookSignature(secret, raw, sig)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const parsed = WebhookSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ ok: true }); // ack & ignore noise

  for (const entry of parsed.data.entry) {
    // Per-entry owning client (covers template-status events, which carry no
    // phone_number_id but do carry the WABA id).
    const entryClientId = (entry.id ? (await getWebhookClientByWaba(entry.id))?.clientId : null) ?? DEFAULT_CLIENT_ID;
    for (const change of entry.changes) {
      const v = change.value;
      // Prefer the precise phone-number routing, else the entry's WABA client.
      const clientId =
        (v.metadata?.phone_number_id ? await getClientIdByPhoneNumberId(v.metadata.phone_number_id) : null) ??
        entryClientId;

      // Template approval/rejection — keep the local cache in sync automatically.
      if (v.event && v.message_template_name) {
        const status = TEMPLATE_EVENT_MAP[v.event.toUpperCase()] ?? v.event.toUpperCase();
        await prisma.template.updateMany({
          where: {
            clientId,
            name: v.message_template_name,
            ...(v.message_template_language ? { language: v.message_template_language } : {}),
          },
          data: { status },
        });
      }

      // Delivery status updates
      for (const s of change.value.statuses ?? []) {
        const recipient = await prisma.broadcastRecipient.findUnique({ where: { wamid: s.id } });
        if (recipient) {
          await prisma.broadcastRecipient.update({
            where: { id: recipient.id },
            data: {
              status: STATUS_MAP[s.status],
              error: s.errors?.[0]?.title ?? recipient.error,
            },
          });
        }
        await prisma.messageEvent.create({
          data: { recipientId: recipient?.id, wamid: s.id, type: `status:${s.status}`, payload: s },
        });
        // Mirror the status onto an outbound inbox message, if this wamid is one.
        await prisma.message.updateMany({
          where: { wamid: s.id },
          data: { status: STATUS_MAP[s.status], error: s.errors?.[0]?.title ?? undefined },
        });
      }

      // Inbound messages → button-click tracking + opt-out keyword handling
      for (const m of change.value.messages ?? []) {
        // A button tap (template quick-reply) or interactive reply = a "click".
        const clickLabel =
          m.button?.text ??
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          null;

        if (clickLabel != null) {
          // Link the click to the recipient via the replied-to message id.
          const ctxId = m.context?.id;
          const recipient = ctxId
            ? await prisma.broadcastRecipient.findUnique({ where: { wamid: ctxId } })
            : null;
          await prisma.messageEvent.create({
            data: {
              recipientId: recipient?.id,
              wamid: ctxId ?? null,
              type: "click",
              payload: { label: clickLabel, from: m.from, raw: m },
            },
          });
        } else {
          await prisma.messageEvent.create({ data: { wamid: null, type: "inbound", payload: m } });
        }

        // Thread the message into the two-way inbox for this client.
        await recordInboundMessage(clientId, m);

        const text = m.text?.body?.trim().toUpperCase() ?? "";
        if (optOutKeywords.includes(text)) {
          await prisma.optOut.upsert({
            where: { clientId_phone: { clientId, phone: m.from } },
            create: { clientId, phone: m.from, source: "keyword" },
            update: {},
          });
          await prisma.contact.updateMany({ where: { phone: m.from, clientId }, data: { optedOut: true } });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
