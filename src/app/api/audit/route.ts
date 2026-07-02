import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId, requireAdmin } from "@/lib/users";

export const runtime = "nodejs";

/** GET /api/audit?offset=0&limit=50 — the client's activity log (ADMIN only, newest first). */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50) || 50));
  const clientId = await getClientId(req);

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count({ where: { clientId } }),
  ]);

  return NextResponse.json({
    page: { offset, limit, total },
    entries: entries.map((e) => ({
      id: e.id, actor: e.actor, role: e.role, action: e.action,
      target: e.target, meta: e.meta, createdAt: e.createdAt,
    })),
  });
}
