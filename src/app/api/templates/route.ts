import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CreateTemplateSchema } from "@/lib/validation";
import { createTemplate, countTemplateVars, WhatsAppError } from "@/lib/whatsapp";
import { getWaConfig } from "@/lib/waConfig";

export const runtime = "nodejs";

/**
 * GET /api/templates — list locally cached templates.
 * GET /api/templates?sync=1 — pull approved templates from Meta and cache them.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("sync") === "1") {
    await syncFromMeta();
  }
  const templates = await prisma.template.findMany({ orderBy: { name: "asc" } });
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

  try {
    const result = await createTemplate(input);
    const template = await prisma.template.upsert({
      where: { name_language: { name: input.name, language: input.language } },
      create: {
        name: input.name, language: input.language, category: input.category,
        status: result.status ?? "PENDING", variableCount: countTemplateVars(input.body),
      },
      update: { category: input.category, status: result.status ?? "PENDING", variableCount: countTemplateVars(input.body) },
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

async function syncFromMeta() {
  const cfg = await getWaConfig();
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

    await prisma.template.upsert({
      where: { name_language: { name: t.name, language: t.language } },
      create: { name: t.name, language: t.language, category: t.category, status: t.status, variableCount },
      update: { category: t.category, status: t.status, variableCount },
    });
  }
}
