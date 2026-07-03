import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { SendTemplateMessageSchema } from "@/lib/validation";
import { sendTemplate, WhatsAppError } from "@/lib/whatsapp";

export const runtime = "nodejs";

/** POST /api/conversations/:id/template — send an approved template to this
 *  thread. Templates work outside the 24h window, so this is how an agent
 *  re-opens a closed conversation. Rich templates (media header, coupon,
 *  carousel, countdown offer) need per-send inputs the inbox doesn't collect —
 *  those still go through a broadcast. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const parsed = SendTemplateMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true, phone: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const template = await prisma.template.findFirst({ where: { id: parsed.data.templateId, clientId } });
  if (!template) return NextResponse.json({ error: "template not found" }, { status: 404 });
  if (template.status !== "APPROVED") {
    return NextResponse.json({ error: "template not approved by Meta" }, { status: 422 });
  }
  const rich =
    ["IMAGE", "DOCUMENT", "VIDEO"].includes(template.headerFormat ?? "") ||
    template.copyCode ||
    template.ltoExpiration ||
    (Array.isArray(template.cards) && template.cards.length > 0);
  if (rich) {
    return NextResponse.json(
      { error: "this template needs media/coupon/expiry inputs — send it from a broadcast" },
      { status: 422 },
    );
  }
  const bodyParams = parsed.data.variables.slice(0, template.variableCount);
  if (bodyParams.length < template.variableCount || bodyParams.some((v) => !v)) {
    return NextResponse.json({ error: `fill all ${template.variableCount} template variable(s)` }, { status: 422 });
  }

  let wamid: string;
  try {
    wamid = await sendTemplate({
      to: convo.phone,
      templateName: template.name,
      language: template.language,
      bodyParams,
      clientId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    const code = e instanceof WhatsAppError ? e.status : 502;
    return NextResponse.json({ error: message }, { status: code });
  }

  // The template body lives at Meta, not locally — store a labeled preview.
  const preview = `📋 ${template.name}${bodyParams.length ? ` · ${bodyParams.join(", ")}` : ""}`;
  const created = await prisma.message.create({
    data: { clientId, conversationId: id, direction: "OUT", type: "template", text: preview, wamid, status: "SENT" },
  });
  await prisma.conversation.update({
    where: { id },
    data: { lastMessageAt: created.createdAt, lastPreview: preview, unread: 0 },
  });

  return NextResponse.json(
    {
      message: { id: created.id, direction: "OUT", type: "template", text: preview, status: "SENT", createdAt: created.createdAt },
    },
    { status: 201 },
  );
}
