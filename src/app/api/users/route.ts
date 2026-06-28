import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createUser, requireAdmin } from "@/lib/users";
import { DEFAULT_CLIENT_ID } from "@/lib/waConfig";

export const runtime = "nodejs";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  password: z.string().min(8, "password must be ≥8 chars").max(200),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

/** GET /api/users — list teammates in the caller's client (ADMIN only). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { clientId: admin.cid ?? DEFAULT_CLIENT_ID },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

/** POST /api/users — invite a teammate into the caller's client (ADMIN only). */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = CreateUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (exists) return NextResponse.json({ error: "email already exists" }, { status: 409 });

  const user = await createUser({ ...parsed.data, clientId: admin.cid ?? DEFAULT_CLIENT_ID });
  return NextResponse.json({ user }, { status: 201 });
}
