import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PhoneSchema } from "@/lib/validation";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

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

  const clientId = await getClientId(req);
  const contact = await prisma.contact.findFirst({ where: { id, clientId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { optedOut, name, phone } = parsed.data;

  // Reject a phone change that would collide with another contact (same client).
  if (phone !== undefined && phone !== contact.phone) {
    const clash = await prisma.contact.findFirst({ where: { phone, clientId }, select: { id: true } });
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
    await prisma.optOut.deleteMany({ where: { phone: contact.phone, clientId } });
  }
  if (optedOut !== undefined || (phone !== undefined && phone !== contact.phone)) {
    if (updated.optedOut) {
      const existing = await prisma.optOut.findFirst({ where: { phone: updated.phone, clientId }, select: { id: true } });
      if (!existing) await prisma.optOut.create({ data: { phone: updated.phone, clientId, source: "manual" } });
    } else {
      await prisma.optOut.deleteMany({ where: { phone: updated.phone, clientId } });
    }
  }

  void audit(req, "contact.updated", updated.phone, {
    ...(name !== undefined ? { name: updated.name } : {}),
    ...(phone !== undefined ? { previousPhone: contact.phone } : {}),
    ...(optedOut !== undefined ? { optedOut } : {}),
  });
  return NextResponse.json({
    ok: true,
    contact: { id: updated.id, phone: updated.phone, name: updated.name, optedOut: updated.optedOut },
  });
}

/** DELETE /api/contacts/:id (ADMIN only, scoped to the caller's client). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const clientId = await getClientId(req);
  const contact = await prisma.contact.findFirst({ where: { id, clientId }, select: { phone: true } });
  const r = await prisma.contact.deleteMany({ where: { id, clientId } }).catch(() => null);
  if (r && r.count > 0) void audit(req, "contact.deleted", contact?.phone ?? id);
  return NextResponse.json({ ok: true });
}
