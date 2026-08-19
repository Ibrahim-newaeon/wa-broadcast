import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, getAuthContext } from "@/lib/users";
import { ACTING_CLIENT_COOKIE, cookieBase, ACCESS_MAX_AGE } from "@/lib/auth";

export const runtime = "nodejs";

const Schema = z.object({ clientId: z.string().min(1) });

/** POST /api/clients/switch — a SUPERADMIN sets the tenant they act as. */
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // On a tenant subdomain the hostname fixes the client — switching there would
  // silently contradict the address bar.
  const ctx = await getAuthContext(req);
  if (ctx?.pinned) {
    return NextResponse.json(
      { error: "this address serves one workspace — switch clients on the console host" },
      { status: 409 },
    );
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true, name: true } });
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const res = NextResponse.json({ ok: true, clientId: client.id, name: client.name });
  // Longer-lived than the access token so the choice survives token refreshes.
  res.cookies.set(ACTING_CLIENT_COOKIE, client.id, { ...cookieBase, maxAge: ACCESS_MAX_AGE * 96 }); // ~24h
  return res;
}
