import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/users";
import { baseDomainFor } from "@/lib/hostTenancy";
import { invalidateHostClientCache } from "@/lib/hostClient";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/clients/:id/verify-host — prove a client's subdomain is live, then
 * bind it (SUPERADMIN only).
 *
 * The check is deliberately end-to-end: it requests
 * `https://<slug>.<domain>/api/health` from the outside. That only answers once
 * BOTH halves of the provisioning exist — the DNS record, and a server block
 * holding a certificate for the name. Anything short of a 200 leaves the
 * subdomain saved but inactive, so the client's users keep working on the
 * console host meanwhile.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, slugActive: true },
  });
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  if (!client.slug) return NextResponse.json({ error: "this client has no subdomain to verify" }, { status: 400 });

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const domain = baseDomainFor(host);
  const target = `${client.slug}.${domain}`;

  let reachable = false;
  let detail = "";
  try {
    const res = await fetch(`https://${target}/api/health`, {
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
      cache: "no-store",
    });
    reachable = res.status === 200;
    if (!reachable) detail = `answered HTTP ${res.status}`;
  } catch (err) {
    // DNS not propagated, no route to host, or no certificate for the name.
    detail = err instanceof Error ? err.message : "unreachable";
  }

  if (!reachable) {
    return NextResponse.json(
      {
        ok: false,
        host: target,
        error: `https://${target} did not answer${detail ? ` (${detail})` : ""}. Add the DNS record and the server block, then try again — DNS can take a few minutes.`,
      },
      { status: 409 },
    );
  }

  if (!client.slugActive) {
    await prisma.client.update({ where: { id }, data: { slugActive: true } });
    invalidateHostClientCache();
    void audit(req, "client.subdomain_activated", client.name, { host: target });
  }

  return NextResponse.json({ ok: true, host: target, slugActive: true });
}
