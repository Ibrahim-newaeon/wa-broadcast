import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LeadSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { DEFAULT_CLIENT_ID } from "@/lib/tenancy";

export const runtime = "nodejs";

const LEADS_LIST_NAME = "Website Leads";

/**
 * POST /api/leads — public lead capture from the landing page (no auth; the
 * middleware allowlists this path). The lead becomes a Contact in the default
 * client's "Website Leads" list, so the operator can reach them the only way
 * Meta allows for business-initiated contact: an approved template broadcast.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`lead:${ip}`, 5, 600); // 5 per 10 min per IP
  if (!rl.allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const parsed = LeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { name, phone, business, website } = parsed.data;

  // Honeypot filled → almost certainly a bot. Pretend success, store nothing.
  if (website && website.trim() !== "") return NextResponse.json({ ok: true });

  const clientId = DEFAULT_CLIENT_ID;

  // Find-or-create the leads list (case-insensitive, matching the lists API).
  let list = await prisma.contactList.findFirst({
    where: { clientId, name: { equals: LEADS_LIST_NAME, mode: "insensitive" } },
    select: { id: true },
  });
  list ??= await prisma.contactList.create({ data: { clientId, name: LEADS_LIST_NAME }, select: { id: true } });

  // Upsert by phone: a returning lead refreshes their details instead of erroring.
  const existing = await prisma.contact.findFirst({ where: { clientId, phone } });
  const attributes: Record<string, string> = {
    ...((existing?.attributes ?? {}) as Record<string, string>),
    firstName: name,
    source: "landing",
    ...(business ? { business } : {}),
  };
  const contact = existing
    ? await prisma.contact.update({
        where: { id: existing.id },
        data: { name, attributes: attributes as Prisma.InputJsonValue },
      })
    : await prisma.contact.create({
        data: { clientId, phone, name, attributes: attributes as Prisma.InputJsonValue },
      });

  await prisma.contactListMembership.upsert({
    where: { contactId_listId: { contactId: contact.id, listId: list.id } },
    create: { contactId: contact.id, listId: list.id },
    update: {},
  });

  // Direct audit write — there is no authenticated actor on a public form.
  await prisma.auditLog
    .create({
      data: {
        clientId, actor: "landing-page", action: "lead.created", target: phone,
        meta: { name, ...(business ? { business } : {}) },
      },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
