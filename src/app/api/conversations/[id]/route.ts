import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** GET /api/conversations/:id — thread + 24h-window status. Marks it read. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({
    where: { id, clientId },
    include: { contact: { select: { name: true } } },
  });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  // Opening the thread clears the unread badge.
  if (convo.unread > 0) await prisma.conversation.update({ where: { id }, data: { unread: 0 } });

  const windowOpen = convo.lastInboundAt ? Date.now() - new Date(convo.lastInboundAt).getTime() < WINDOW_MS : false;

  return NextResponse.json({
    conversation: {
      id: convo.id,
      phone: convo.phone,
      name: convo.contact?.name ?? null,
      lastInboundAt: convo.lastInboundAt,
      windowOpen,
    },
    messages: messages.map((m) => ({
      id: m.id, direction: m.direction, type: m.type, text: m.text,
      mediaMime: m.mediaMime, mediaFilename: m.mediaFilename,
      status: m.status, error: m.error, createdAt: m.createdAt,
    })),
  });
}
