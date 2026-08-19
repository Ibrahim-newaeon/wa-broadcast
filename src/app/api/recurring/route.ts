import { NextRequest, NextResponse } from "next/server";
import { CreateRecurringSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { upsertSchedule } from "@/lib/recurring";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** GET /api/recurring — list campaigns with template/list names. */
export async function GET(req: NextRequest) {
  const clientId = await getClientId(req);
  const campaigns = await prisma.recurringCampaign.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  const [templates, lists] = await Promise.all([
    prisma.template.findMany({ where: { clientId }, select: { id: true, name: true } }),
    prisma.contactList.findMany({ where: { clientId, archived: false }, select: { id: true, name: true } }),
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

/** POST /api/recurring — create a campaign and register its cron schedule (ADMIN only). */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = CreateRecurringSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { name, templateId, listId, cron, variableMap } = parsed.data;
  const clientId = await getClientId(req);

  const template = await prisma.template.findFirst({ where: { id: templateId, clientId } });
  if (!template || template.status !== "APPROVED") {
    return NextResponse.json({ error: "template not approved" }, { status: 422 });
  }

  const list = await prisma.contactList.findFirst({ where: { id: listId, clientId, archived: false }, select: { id: true } });
  if (!list) return NextResponse.json({ error: "list not found" }, { status: 404 });

  const campaign = await prisma.recurringCampaign.create({
    data: { clientId, name, templateId, listId, cron, variableMap, active: true },
  });
  await upsertSchedule(campaign.id, cron);

  void audit(req, "campaign.created", name, { cron, templateId, listId });
  return NextResponse.json({ campaign: { id: campaign.id, name: campaign.name } }, { status: 201 });
}
