// Host → tenant binding. Pure: no DB or framework imports, so the edge
// middleware and the Node layer can share exactly the same rules.
//
// Two kinds of hostname serve the app:
//   • a TENANT host — `bia.massegat.com`, whose first label is a client slug.
//     It shows that client and nothing else, to everyone, super-admin included.
//   • the CONSOLE host — `app.massegat.com` (and the bare apex). Home for the
//     Default client, for every client without a subdomain, and the only place
//     a super-admin can switch tenants.
//
// A client only gets a subdomain when someone provisions DNS + a Caddy block,
// so `slug` set means "this client is served at its own hostname".

import { resolveActingClientId } from "./tenancy";

/** Labels that are never a tenant, so a client can't shadow the console. */
export const RESERVED_HOST_LABELS = new Set([
  "app", "www", "api", "admin", "static", "assets", "cdn", "mail", "webhooks",
]);

/** Strip the port and any trailing dot, lowercase. */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "").split(":")[0] ?? "";
}

/**
 * The tenant slug a hostname serves, or null for the console host.
 *
 * `bia.massegat.com` → "bia" · `app.massegat.com` → null ·
 * `massegat.com` → null · `localhost` → null.
 */
export function hostTenantSlug(host: string | null | undefined): string | null {
  if (!host) return null;
  const clean = normalizeHost(host);
  const labels = clean.split(".");
  // An apex (massegat.com) or a bare name (localhost) has no tenant label.
  if (labels.length < 3) return null;
  const label = labels[0]!;
  if (RESERVED_HOST_LABELS.has(label)) return null;
  return label;
}

/** The console hostname for a given host — `bia.massegat.com` → `app.massegat.com`. */
export function consoleHostFor(host: string | null | undefined): string {
  const clean = normalizeHost(host ?? "");
  const labels = clean.split(".");
  const base = labels.length >= 3 ? labels.slice(1).join(".") : clean;
  return base ? `app.${base}` : "the main address";
}

/** The registrable domain the app is served under — `bia.massegat.com` → `massegat.com`. */
export function baseDomainFor(host: string | null | undefined): string {
  const clean = normalizeHost(host ?? "");
  const labels = clean.split(".");
  return labels.length >= 3 ? labels.slice(1).join(".") : clean;
}

/** The hostname a client with `slug` is served at, relative to the current host. */
export function tenantHostFor(host: string | null | undefined, slug: string): string {
  const clean = normalizeHost(host ?? "");
  const labels = clean.split(".");
  const base = labels.length >= 3 ? labels.slice(1).join(".") : clean;
  return base ? `${slug}.${base}` : slug;
}

export interface HostAccessInput {
  /** Tenant slug from the Host header; null on the console host. */
  hostSlug: string | null;
  /** Client the host slug maps to; null when the slug matches no client. */
  hostClientId: string | null;
  role: string;
  ownClientId: string;
  /** Slug of the caller's own client — null when it has no subdomain. */
  ownSlug: string | null;
  /** Super-admin's acting-client cookie (ignored on a tenant host). */
  actingCookie?: string | undefined;
}

export type HostAccess =
  | { ok: true; clientId: string; pinned: boolean }
  | { ok: false; error: string };

const isSuper = (role: string) => role === "SUPERADMIN";

/**
 * Which client this request may act on, given who is asking and where they
 * asked. `pinned` means the tenant is fixed by the hostname or by the role —
 * the client switcher must not be offered.
 *
 * `host` is only used to phrase the redirect messages.
 */
export function resolveHostAccess(input: HostAccessInput, host: string): HostAccess {
  const { hostSlug, hostClientId, role, ownClientId, ownSlug, actingCookie } = input;

  // ── Tenant host: it serves exactly one client, whoever is asking. ──
  if (hostSlug) {
    if (!hostClientId) {
      return { ok: false, error: `${hostSlug} is not a workspace on this server.` };
    }
    // A super-admin is allowed in, but sees only this tenant — the acting-client
    // cookie is deliberately ignored here.
    if (isSuper(role)) return { ok: true, clientId: hostClientId, pinned: true };
    if (ownClientId === hostClientId) return { ok: true, clientId: ownClientId, pinned: true };
    return {
      ok: false,
      error: `This address serves ${hostSlug} only. Sign in at ${consoleHostFor(host)}.`,
    };
  }

  // ── Console host: Default, every client without a subdomain, super-admins. ──
  // The acting-client cookie keeps its existing meaning here: honoured for a
  // super-admin, ignored for everyone else.
  if (isSuper(role)) {
    return { ok: true, clientId: resolveActingClientId(role, ownClientId, actingCookie), pinned: false };
  }
  if (ownSlug) {
    return {
      ok: false,
      error: `Your workspace is at ${tenantHostFor(host, ownSlug)}. Sign in there.`,
    };
  }
  return { ok: true, clientId: resolveActingClientId(role, ownClientId, actingCookie), pinned: true };
}
