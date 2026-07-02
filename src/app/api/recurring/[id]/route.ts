import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { upsertSchedule, removeSchedule } from "@/lib/recurring";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const PatchSchema = z.object({ active: z.boolean() });

/** PATCH /api/recurring/:id — pause / resume (ADMIN only, scoped to the caller's client). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const clientId = await getClientId(req);
  const owned = await prisma.recurringCampaign.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const campaign = await prisma.recurringCampaign.update({
    where: { id },
    data: { active: parsed.data.active },
  });

  if (campaign.active) await upsertSchedule(campaign.id, campaign.cron);
  else await removeSchedule(campaign.id);

  void audit(req, campaign.active ? "campaign.resumed" : "campaign.paused", campaign.name);
  return NextResponse.json({ ok: true, active: campaign.active });
}

/** DELETE /api/recurring/:id (ADMIN only, scoped to the caller's client). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const clientId = await getClientId(req);
  const campaign = await prisma.recurringCampaign.findFirst({ where: { id, clientId }, select: { name: true } });
  const r = await prisma.recurringCampaign.deleteMany({ where: { id, clientId } }).catch(() => null);
  if (r && r.count > 0) {
    await removeSchedule(id);
    void audit(req, "campaign.deleted", campaign?.name ?? id);
  }
  return NextResponse.json({ ok: true });
}
