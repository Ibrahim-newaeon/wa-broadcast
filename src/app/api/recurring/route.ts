import { NextRequest, NextResponse } from "next/server";
import { CreateRecurringSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { upsertSchedule } from "@/lib/recurring";

export const runtime = "nodejs";

/** GET /api/recurring — list campaigns with template/list names. */
export async function GET() {
  const campaigns = await prisma.recurringCampaign.findMany({ orderBy: { createdAt: "desc" } });
  const [templates, lists] = await Promise.all([
    prisma.template.findMany({ select: { id: true, name: true } }),
    prisma.contactList.findMany({ select: { id: true, name: true } }),
  ]);
  const tName = new Map(templates.map((t) => [t.id, t.name]));
  const lName = new Map(lists.map((l) => [l.id, l.name]));

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id, name: c.name, cron: c.cron, active: c.active,
      templateName: tName.get(c.templateId) ?? "(deleted)",
      listName: lName.get(c.listId) ?? "(deleted)",
      lastRunAt: c.lastRunAt,
    })),
  });
}

/** POST /api/recurring — create a campaign and register its cron schedule. */
export async function POST(req: NextRequest) {
  const parsed = CreateRecurringSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { name, templateId, listId, cron, variableMap } = parsed.data;

  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || template.status !== "APPROVED") {
    return NextResponse.json({ error: "template not approved" }, { status: 422 });
  }

  const campaign = await prisma.recurringCampaign.create({
    data: { name, templateId, listId, cron, variableMap, active: true },
  });
  await upsertSchedule(campaign.id, cron);

  return NextResponse.json({ campaign: { id: campaign.id, name: campaign.name } }, { status: 201 });
}
