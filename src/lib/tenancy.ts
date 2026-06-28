// Pure multi-tenant helpers — no DB/framework imports so they're trivially
// unit-testable and safe to share between edge/node code.

export const DEFAULT_CLIENT_ID = "default";

/**
 * Resolve the clientId a request should act on.
 * A SUPERADMIN may override their own tenant via the acting-client cookie;
 * every other role is hard-pinned to their own clientId (the cookie is ignored,
 * so a forged `acid` cookie from a non-super-admin can never cross tenants).
 */
export function resolveActingClientId(
  role: string | undefined,
  ownClientId: string | undefined,
  actingCookie: string | undefined,
): string {
  const own = ownClientId || DEFAULT_CLIENT_ID;
  if (role === "SUPERADMIN" && actingCookie) return actingCookie;
  return own;
}
