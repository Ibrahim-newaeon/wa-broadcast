import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

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
  const url = `https://graph.facebook.com/${env.GRAPH_API_VERSION}/${env.WA_BUSINESS_ACCOUNT_ID}/message_templates?limit=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` } });
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
