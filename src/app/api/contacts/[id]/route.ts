import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const PatchSchema = z.object({ optedOut: z.boolean() });

/** PATCH /api/contacts/:id — toggle opt-out (keeps the OptOut table in sync). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const optedOut = parsed.data.optedOut;
  await prisma.contact.update({ where: { id }, data: { optedOut } });

  // Mirror into OptOut (broadcast enqueue checks both).
  if (optedOut) {
    await prisma.optOut.upsert({
      where: { phone: contact.phone },
      create: { phone: contact.phone, source: "manual" },
      update: {},
    });
  } else {
    await prisma.optOut.deleteMany({ where: { phone: contact.phone } });
  }

  return NextResponse.json({ ok: true, optedOut });
}

/** DELETE /api/contacts/:id */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.contact.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
