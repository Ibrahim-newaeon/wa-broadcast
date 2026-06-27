import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PhoneSchema } from "@/lib/validation";

export const runtime = "nodejs";

// All fields optional — used both for the opt-out toggle and for editing details.
const PatchSchema = z
  .object({
    optedOut: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
    phone: PhoneSchema.optional(),
  })
  .refine((o) => o.optedOut !== undefined || o.name !== undefined || o.phone !== undefined, {
    message: "Nothing to update",
  });

/**
 * PATCH /api/contacts/:id — edit a contact (name/phone) and/or toggle opt-out.
 * Keeps the OptOut table in sync (broadcast enqueue checks both).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { optedOut, name, phone } = parsed.data;

  // Reject a phone change that would collide with another contact.
  if (phone !== undefined && phone !== contact.phone) {
    const clash = await prisma.contact.findUnique({ where: { phone }, select: { id: true } });
    if (clash) {
      return NextResponse.json({ error: "Another contact already uses this phone number." }, { status: 409 });
    }
  }

  const data: Prisma.ContactUpdateInput = {};
  if (name !== undefined) data.name = name === "" ? null : name;
  if (phone !== undefined) data.phone = phone;
  if (optedOut !== undefined) data.optedOut = optedOut;

  const updated = await prisma.contact.update({ where: { id }, data });

  // Mirror opt-out into the OptOut table. If the phone also changed, drop the
  // stale row under the old number first so both tables stay consistent.
  if (phone !== undefined && phone !== contact.phone) {
    await prisma.optOut.deleteMany({ where: { phone: contact.phone } });
  }
  if (optedOut !== undefined || (phone !== undefined && phone !== contact.phone)) {
    if (updated.optedOut) {
      await prisma.optOut.upsert({
        where: { phone: updated.phone },
        create: { phone: updated.phone, source: "manual" },
        update: {},
      });
    } else {
      await prisma.optOut.deleteMany({ where: { phone: updated.phone } });
    }
  }

  return NextResponse.json({
    ok: true,
    contact: { id: updated.id, phone: updated.phone, name: updated.name, optedOut: updated.optedOut },
  });
}

/** DELETE /api/contacts/:id */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.contact.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
