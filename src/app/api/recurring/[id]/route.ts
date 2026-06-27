import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { upsertSchedule, removeSchedule } from "@/lib/recurring";

export const runtime = "nodejs";

const PatchSchema = z.object({ active: z.boolean() });

/** PATCH /api/recurring/:id — pause / resume. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const campaign = await prisma.recurringCampaign.update({
    where: { id },
    data: { active: parsed.data.active },
  }).catch(() => null);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (campaign.active) await upsertSchedule(campaign.id, campaign.cron);
  else await removeSchedule(campaign.id);

  return NextResponse.json({ ok: true, active: campaign.active });
}

/** DELETE /api/recurring/:id */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await removeSchedule(id);
  await prisma.recurringCampaign.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
