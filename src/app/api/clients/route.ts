import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CreateClientSchema } from "@/lib/validation";
import { requireSuperAdmin, getClientId, createUser, generatePassword } from "@/lib/users";

export const runtime = "nodejs";

/** GET /api/clients — list all tenants + the caller's active one (SUPERADMIN). */
export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const clients = await prisma.client.findMany({ orderBy: { createdAt: "asc" } });
  // Per-client counts in one pass each (small tables; fine for an admin view).
  const [contacts, users] = await Promise.all([
    prisma.contact.groupBy({ by: ["clientId"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["clientId"], _count: { _all: true } }),
  ]);
  const cMap = new Map(contacts.map((c) => [c.clientId, c._count._all]));
  const uMap = new Map(users.map((u) => [u.clientId, u._count._all]));

  return NextResponse.json({
    activeClientId: await getClientId(req),
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      createdAt: c.createdAt,
      contacts: cMap.get(c.id) ?? 0,
      users: uMap.get(c.id) ?? 0,
    })),
  });
}

/** POST /api/clients — create a new tenant (SUPERADMIN). */
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = CreateClientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { name, slug, adminEmail, adminPassword } = parsed.data;

  if (slug) {
    const clash = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (clash) return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
  }

  // Validate the admin email BEFORE creating the tenant, so a duplicate email
  // never leaves an orphaned client behind.
  if (adminEmail) {
    const taken = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "That admin email is already in use." }, { status: 409 });
  }

  const client = await prisma.client.create({ data: { name, slug: slug ?? null } });
  // Give the new tenant a blank WhatsApp config row so settings can be saved.
  await prisma.whatsAppConfig.create({ data: { clientId: client.id } });

  // Optionally provision the client's first ADMIN login. The returned password
  // is shown to the super-admin ONCE — it isn't stored in plaintext anywhere.
  let admin: { email: string; password: string; generated: boolean } | undefined;
  if (adminEmail) {
    const password = adminPassword || generatePassword();
    await createUser({ email: adminEmail, password, role: "ADMIN", clientId: client.id });
    admin = { email: adminEmail.toLowerCase(), password, generated: !adminPassword };
  }

  return NextResponse.json(
    { client: { id: client.id, name: client.name, slug: client.slug }, admin },
    { status: 201 },
  );
}
