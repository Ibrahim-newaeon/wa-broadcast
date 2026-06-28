import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { SendMessageSchema } from "@/lib/validation";
import { sendText, WhatsAppError } from "@/lib/whatsapp";

export const runtime = "nodejs";

/** POST /api/conversations/:id/messages — send a free-form text reply.
 *  Allowed only inside the 24h service window (Meta enforces; we surface it). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = SendMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true, phone: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  let wamid: string;
  try {
    wamid = await sendText({ to: convo.phone, body: parsed.data.text, clientId });
  } catch (e) {
    // 131047 = outside the 24h window → tell the agent to use a template instead.
    const message = e instanceof Error ? e.message : "send failed";
    const code = e instanceof WhatsAppError ? e.status : 502;
    return NextResponse.json({ error: message }, { status: code });
  }

  const created = await prisma.message.create({
    data: { clientId, conversationId: id, direction: "OUT", type: "text", text: parsed.data.text, wamid, status: "SENT" },
  });
  await prisma.conversation.update({
    where: { id },
    data: { lastMessageAt: created.createdAt, lastPreview: parsed.data.text, unread: 0 },
  });

  return NextResponse.json({
    message: { id: created.id, direction: "OUT", type: "text", text: created.text, status: "SENT", createdAt: created.createdAt },
  }, { status: 201 });
}
