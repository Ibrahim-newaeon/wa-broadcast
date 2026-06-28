import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { optOutKeywords } from "@/lib/env";
import { getWaConfig } from "@/lib/waConfig";
import { WebhookSchema } from "@/lib/validation";
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

/** GET — Meta webhook verification handshake. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const { webhookVerifyToken } = await getWaConfig();
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === webhookVerifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** POST — status callbacks + inbound messages. Signature-verified. */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verify X-Hub-Signature-256 = HMAC-SHA256(appSecret, rawBody)
  const { appSecret } = await getWaConfig();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const parsed = WebhookSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ ok: true }); // ack & ignore noise

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      // Template approval/rejection — keep the local cache in sync automatically.
      const v = change.value;
      if (v.event && v.message_template_name) {
        const status = TEMPLATE_EVENT_MAP[v.event.toUpperCase()] ?? v.event.toUpperCase();
        await prisma.template.updateMany({
          where: v.message_template_language
            ? { name: v.message_template_name, language: v.message_template_language }
            : { name: v.message_template_name },
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

        const text = m.text?.body?.trim().toUpperCase() ?? "";
        if (optOutKeywords.includes(text)) {
          await prisma.optOut.upsert({
            where: { phone: m.from },
            create: { phone: m.from, source: "keyword" },
            update: {},
          });
          await prisma.contact.updateMany({ where: { phone: m.from }, data: { optedOut: true } });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
