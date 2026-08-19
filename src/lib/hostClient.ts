import { prisma } from "./db";

// slug ⇆ clientId, needed on every authenticated request to bind a hostname to
// a tenant. The map only changes when a client is created, renamed or deleted,
// so it is cached in-process for a minute and invalidated on those writes.

const TTL_MS = 60_000;

interface Cached { at: number; bySlug: Map<string, string>; byClient: Map<string, string> }
let cache: Cached | null = null;

async function load(): Promise<Cached> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const rows = await prisma.client.findMany({
    where: { slug: { not: null } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map<string, string>();
  const byClient = new Map<string, string>();
  for (const r of rows) {
    const slug = r.slug!.toLowerCase();
    bySlug.set(slug, r.id);
    byClient.set(r.id, slug);
  }
  cache = { at: Date.now(), bySlug, byClient };
  return cache;
}

/** The client served at `<slug>.<domain>`, or null when no client claims it. */
export async function clientIdBySlug(slug: string): Promise<string | null> {
  return (await load()).bySlug.get(slug.toLowerCase()) ?? null;
}

/** The subdomain a client is served at, or null when it has none. */
export async function slugByClientId(clientId: string): Promise<string | null> {
  return (await load()).byClient.get(clientId) ?? null;
}

/** Drop the cache — call after any write that changes a client's slug. */
export function invalidateHostClientCache(): void {
  cache = null;
}
