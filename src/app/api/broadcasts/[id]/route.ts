import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma, RecipientStatus } from "@prisma/client";

export const runtime = "nodejs";

const STATUSES = ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"] as const;

/**
 * GET /api/broadcasts/:id?status=FAILED&offset=0&limit=50
 * Returns broadcast meta, per-status counts (always full), and a filtered,
 * paginated slice of recipients.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;

  const statusParam = sp.get("status");
  const status = STATUSES.includes(statusParam as never) ? (statusParam as RecipientStatus) : undefined;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50) || 50));

  const broadcast = await prisma.broadcast.findUnique({
    where: { id },
    include: { template: true, list: true },
  });
  if (!broadcast) return NextResponse.json({ error: "not found" }, { status: 404 });

  const where: Prisma.BroadcastRecipientWhereInput = { broadcastId: id, ...(status ? { status } : {}) };

  const [recipients, filteredTotal, grouped] = await Promise.all([
    prisma.broadcastRecipient.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
      include: { contact: { select: { phone: true, name: true } } },
    }),
    prisma.broadcastRecipient.count({ where }),
    prisma.broadcastRecipient.groupBy({
      by: ["status"],
      where: { broadcastId: id },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    broadcast: {
      id: broadcast.id,
      status: broadcast.status,
      template: { name: broadcast.template.name, language: broadcast.template.language },
      list: { name: broadcast.list.name },
      totalCount: broadcast.totalCount,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      scheduledAt: broadcast.scheduledAt,
    },
    counts: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
    page: { offset, limit, filteredTotal, status: status ?? null },
    recipients: recipients.map((r) => ({
      id: r.id,
      phone: r.contact.phone,
      name: r.contact.name,
      status: r.status,
      error: r.error,
    })),
  });
}
