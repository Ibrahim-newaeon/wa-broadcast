import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { CreateListSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Archived lists are hidden unless asked for — they stay out of every picker.
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";
  const lists = await prisma.contactList.findMany({
    where: { clientId: await getClientId(req), ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { memberships: true } } },
  });
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const parsed = CreateListSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid name" }, { status: 400 });
  const clientId = await getClientId(req);
  const name = parsed.data.name;

  // Reject case-insensitive duplicates within the client (friendly message).
  const clash = await prisma.contactList.findFirst({
    where: { clientId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) return NextResponse.json({ error: `A list named “${name}” already exists.` }, { status: 409 });

  try {
    const list = await prisma.contactList.create({ data: { name, clientId } });
    void audit(req, "list.created", name);
    return NextResponse.json({ list }, { status: 201 });
  } catch (err) {
    // Backstop for the exact-case unique index (e.g. a concurrent create).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A list named “${name}” already exists.` }, { status: 409 });
    }
    throw err;
  }
}
