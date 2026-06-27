import { NextRequest, NextResponse } from "next/server";
import { CreateListSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const lists = await prisma.contactList.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true } } },
  });
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const parsed = CreateListSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid name" }, { status: 400 });
  const list = await prisma.contactList.create({ data: { name: parsed.data.name } });
  return NextResponse.json({ list }, { status: 201 });
}
