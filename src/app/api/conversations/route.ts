import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/** GET /api/conversations — this client's threads, most-recent first.
 *  ?q= filters by contact name, phone, or last-message preview. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  const conversations = await prisma.conversation.findMany({
    where: {
      clientId: await getClientId(req),
      ...(q
        ? {
            OR: [
              { phone: { contains: q.replace(/[^\d]/g, "") || q } },
              { contact: { name: { contains: q, mode: "insensitive" } } },
              { lastPreview: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
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
