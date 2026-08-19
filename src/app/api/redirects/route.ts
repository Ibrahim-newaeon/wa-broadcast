import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClientId, requireAdmin } from "@/lib/users";
import { CreateRedirectSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GET /api/redirects — this client's /go/<slug> destinations.
 *
 * Admin-only, like the rest of management: a redirect decides where a template
 * button sends a recipient, so it is closer to a credential than to campaign
 * content.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const links = await prisma.redirectLink.findMany({
    where: { clientId: await getClientId(req) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ links });
}

/** POST /api/redirects — add a destination. */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = CreateRedirectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { slug, url } = parsed.data;
  const clientId = await getClientId(req);

  try {
    const link = await prisma.redirectLink.create({ data: { slug, url, clientId } });
    void audit(req, "redirect.created", slug, { url });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    // Slugs are unique across every client, so the clash may belong to another
    // tenant. Say only that it is taken — never whose it is.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `“${slug}” is already taken.` }, { status: 409 });
    }
    throw err;
  }
}
