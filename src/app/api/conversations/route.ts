import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** GET /api/conversations — this client's threads, most-recent first. */
export async function GET(req: NextRequest) {
  const conversations = await prisma.conversation.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { contact: { select: { name: true } } },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.contact?.name ?? null,
      lastPreview: c.lastPreview,
      lastMessageAt: c.lastMessageAt,
      lastInboundAt: c.lastInboundAt,
      unread: c.unread,
    })),
  });
}
