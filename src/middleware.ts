import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ACCESS_COOKIE } from "@/lib/auth";
import { hostTenantSlug } from "@/lib/hostTenancy";

// Public paths that must NOT require auth.
const PUBLIC_PREFIXES = [
  "/login", "/api/auth", "/api/webhooks", "/api/health", "/api/leads",
  // Outbound link bouncer for template URL buttons — recipients are not logged in.
  "/go",
  // Legal pages — must stay public (Meta App Review links to them).
  "/privacy-policy", "/terms-and-conditions", "/data-deletion",
];
// Public exact paths (prefix match would over-match, e.g. "/" matches everything).
const PUBLIC_EXACT = new Set(["/", "/contacts-template.csv", "/tutorial.html"]);

// Edge runtime: verifies ONLY the short-lived (15m) access token. No Redis here,
// so refresh/rotation/revocation live in /api/auth/refresh (Node). When the
// access token has expired:
//   • API calls → 401; the client `apiFetch` wrapper refreshes + retries.
//   • Page navs → redirect to /login, which silently refreshes on mount and
//     forwards to `next` (seamless unless the session was actually revoked).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const claims = await verifyToken(req.cookies.get(ACCESS_COOKIE)?.value, "access");
  if (claims) {
    // Host ↔ tenant. A tenant subdomain serves exactly one client; the console
    // host serves everyone who has no subdomain of their own. Super-admins pass
    // everywhere (they are pinned to the host's tenant in the Node layer).
    // Tokens minted before this claim existed carry `slg: undefined` — let them
    // through here; getAuthContext re-checks against the database.
    const hostSlug = hostTenantSlug(req.headers.get("host"));
    const own = claims.slg;
    const mismatched =
      claims.role !== "SUPERADMIN" && own !== undefined &&
      (hostSlug ? own !== hostSlug : own !== null);
    if (mismatched) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "this address does not serve your workspace" }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("e", "host");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
