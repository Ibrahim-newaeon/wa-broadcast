import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CreateTemplateSchema } from "@/lib/validation";
import { createTemplate, countTemplateVars, uploadTemplateMediaFromUrl, type CarouselCardInput, WhatsAppError } from "@/lib/whatsapp";
import { getWaConfig } from "@/lib/waConfig";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GET /api/templates — list locally cached templates.
 * GET /api/templates?sync=1 — pull approved templates from Meta and cache them.
 */
export async function GET(req: NextRequest) {
  const clientId = await getClientId(req);
  if (req.nextUrl.searchParams.get("sync") === "1") {
    try {
      await syncFromMeta(clientId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Template sync failed";
      const code = err instanceof WhatsAppError ? err.status : 502;
      return NextResponse.json({ error: message }, { status: code });
    }
  }
  const templates = await prisma.template.findMany({ where: { clientId }, orderBy: { name: "asc" } });
  return NextResponse.json({ templates });
}

/**
 * POST /api/templates — create a template and submit it to Meta for approval.
 * The local copy is cached with Meta's returned status (usually PENDING).
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = CreateTemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid template" }, { status: 400 });
  }
  const input = parsed.data;
  const clientId = await getClientId(req);

  try {
    // Carousel: upload each card's media (URL → handle) for the approval sample,
    // and keep the original URLs to reuse on every send.
    const { carousel: zodCarousel, ...rest } = input;
    let carouselArg: { cards: CarouselCardInput[] } | undefined;
    let cards: Prisma.InputJsonValue | undefined;
    if (zodCarousel?.cards.length) {
      const withHandles: CarouselCardInput[] = [];
      for (const card of zodCarousel.cards) {
        const example = await uploadTemplateMediaFromUrl(card.mediaUrl, clientId);
        withHandles.push({ format: card.format, example, body: card.body, buttonText: card.buttonText, buttonUrl: card.buttonUrl });
      }
      carouselArg = { cards: withHandles };
      cards = zodCarousel.cards as unknown as Prisma.InputJsonValue;
    }

    const result = await createTemplate({ ...rest, carousel: carouselArg }, clientId);
    const headerFormat = input.header?.format ?? null; // IMAGE | DOCUMENT | VIDEO
    const copyCode = input.buttons.some((b) => b.type === "COPY_CODE");
    const ltoText = input.limitedTimeOffer?.text ?? null;
    const ltoExpiration = input.limitedTimeOffer?.hasExpiration ?? false;
    // Mirror the message text + buttons for the broadcast-form preview.
    const bodyText = input.body;
    const footerText = input.footer ?? null;
    const buttons = input.buttons.map((b) => ({ type: b.type, text: b.text, ...(b.url ? { url: b.url } : {}) }));
    const template = await prisma.template.upsert({
      where: { clientId_name_language: { clientId, name: input.name, language: input.language } },
      create: {
        clientId,
        name: input.name, language: input.language, category: input.category,
        status: result.status ?? "PENDING", variableCount: countTemplateVars(input.body), headerFormat, copyCode,
        ltoText, ltoExpiration, bodyText, footerText, buttons,
        ...(cards ? { cards } : {}),
      },
      update: {
        category: input.category, status: result.status ?? "PENDING",
        variableCount: countTemplateVars(input.body), headerFormat, copyCode, ltoText, ltoExpiration,
        bodyText, footerText, buttons,
        ...(cards ? { cards } : {}),
      },
    });
    void audit(req, "template.submitted", input.name, { language: input.language, category: input.category });
    return NextResponse.json({ ok: true, template, metaId: result.id ?? null }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Template submission failed";
    const code = err instanceof WhatsAppError ? err.status : 502;
    return NextResponse.json({ error: message }, { status: code });
  }
}

const MetaTemplateSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      language: z.string(),
      category: z.string(),
      status: z.string(),
      components: z.array(z.record(z.any())).optional(),
    }),
  ),
});

async function syncFromMeta(clientId: string) {
  const cfg = await getWaConfig(clientId);
  if (!cfg.businessAccountId) {
    throw new WhatsAppError("Set the Business account ID in Settings → Connect WhatsApp first.", 400, false);
  }
  const url = `https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.businessAccountId}/message_templates?limit=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new WhatsAppError(body.error?.message ?? `Meta returned ${res.status}`, res.status, false);
  }

  const parsed = MetaTemplateSchema.parse(await res.json());
  for (const t of parsed.data) {
    // Count {{n}} placeholders in the BODY component.
    const body = (t.components ?? []).find((c) => (c as { type?: string }).type === "BODY") as
      | { text?: string }
      | undefined;
    const variableCount = body?.text ? (body.text.match(/\{\{\d+\}\}/g) ?? []).length : 0;

    // Capture a media header format (IMAGE/DOCUMENT/VIDEO) if present.
    const header = (t.components ?? []).find((c) => (c as { type?: string }).type === "HEADER") as
      | { format?: string }
      | undefined;
    const headerFormat = header?.format && ["IMAGE", "DOCUMENT", "VIDEO"].includes(header.format) ? header.format : null;

    // Buttons: detect COPY_CODE + mirror the definitions for the preview.
    const buttonsComp = (t.components ?? []).find((c) => (c as { type?: string }).type === "BUTTONS") as
      | { buttons?: { type?: string; text?: string; url?: string }[] }
      | undefined;
    const copyCode = (buttonsComp?.buttons ?? []).some((b) => b.type === "COPY_CODE");
    const buttons = (buttonsComp?.buttons ?? []).map((b) => ({
      type: b.type ?? "QUICK_REPLY",
      ...(b.text ? { text: b.text } : {}),
      ...(b.url ? { url: b.url } : {}),
    }));

    // Mirror the message text for the broadcast-form preview.
    const bodyText = body?.text ?? null;
    const footer = (t.components ?? []).find((c) => (c as { type?: string }).type === "FOOTER") as
      | { text?: string }
      | undefined;
    const footerText = footer?.text ?? null;

    // Detect a limited-time-offer component (banner text + countdown flag).
    const lto = (t.components ?? []).find((c) => (c as { type?: string }).type === "LIMITED_TIME_OFFER") as
      | { limited_time_offer?: { text?: string; has_expiration?: boolean } }
      | undefined;
    const ltoText = lto?.limited_time_offer?.text ?? null;
    const ltoExpiration = lto?.limited_time_offer?.has_expiration ?? false;

    await prisma.template.upsert({
      where: { clientId_name_language: { clientId, name: t.name, language: t.language } },
      create: { clientId, name: t.name, language: t.language, category: t.category, status: t.status, variableCount, headerFormat, copyCode, ltoText, ltoExpiration, bodyText, footerText, buttons },
      update: { category: t.category, status: t.status, variableCount, headerFormat, copyCode, ltoText, ltoExpiration, bodyText, footerText, buttons },
    });
  }
}
