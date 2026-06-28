import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CreateTemplateSchema } from "@/lib/validation";
import { createTemplate, countTemplateVars, WhatsAppError } from "@/lib/whatsapp";
import { getWaConfig } from "@/lib/waConfig";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/**
 * GET /api/templates — list locally cached templates.
 * GET /api/templates?sync=1 — pull approved templates from Meta and cache them.
 */
export async function GET(req: NextRequest) {
  const clientId = await getClientId(req);
  if (req.nextUrl.searchParams.get("sync") === "1") {
    await syncFromMeta(clientId);
  }
  const templates = await prisma.template.findMany({ where: { clientId }, orderBy: { name: "asc" } });
  return NextResponse.json({ templates });
}

/**
 * POST /api/templates — create a template and submit it to Meta for approval.
 * The local copy is cached with Meta's returned status (usually PENDING).
 */
export async function POST(req: NextRequest) {
  const parsed = CreateTemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid template" }, { status: 400 });
  }
  const input = parsed.data;
  const clientId = await getClientId(req);

  try {
    const result = await createTemplate(input, clientId);
    const headerFormat = input.header?.format ?? null; // IMAGE | DOCUMENT | VIDEO
    const template = await prisma.template.upsert({
      where: { clientId_name_language: { clientId, name: input.name, language: input.language } },
      create: {
        clientId,
        name: input.name, language: input.language, category: input.category,
        status: result.status ?? "PENDING", variableCount: countTemplateVars(input.body), headerFormat,
      },
      update: { category: input.category, status: result.status ?? "PENDING", variableCount: countTemplateVars(input.body), headerFormat },
    });
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
  const url = `https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.businessAccountId}/message_templates?limit=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
  if (!res.ok) throw new Error(`template sync failed (${res.status})`);

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

    await prisma.template.upsert({
      where: { clientId_name_language: { clientId, name: t.name, language: t.language } },
      create: { clientId, name: t.name, language: t.language, category: t.category, status: t.status, variableCount, headerFormat },
      update: { category: t.category, status: t.status, variableCount, headerFormat },
    });
  }
}
