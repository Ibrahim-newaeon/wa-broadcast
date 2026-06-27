import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env, optOutKeywords } from "@/lib/env";
import { WebhookSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const STATUS_MAP = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
} as const;

/** GET — Meta webhook verification handshake. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === env.WA_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** POST — status callbacks + inbound messages. Signature-verified. */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verify X-Hub-Signature-256 = HMAC-SHA256(appSecret, rawBody)
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", env.META_APP_SECRET).update(raw).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const parsed = WebhookSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json({ ok: true }); // ack & ignore noise

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
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

      // Inbound messages → opt-out keyword handling
      for (const m of change.value.messages ?? []) {
        const text = m.text?.body?.trim().toUpperCase() ?? "";
        await prisma.messageEvent.create({
          data: { wamid: null, type: "inbound", payload: m },
        });
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
