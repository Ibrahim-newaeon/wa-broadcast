import { NextResponse } from "next/server";
import { resolveRedirect } from "@/lib/links";

export const runtime = "nodejs";

/**
 * GET /go/:slug — bounce to an allowlisted URL without giving WhatsApp's
 * scraper anything to build a link-preview card from.
 *
 * Deliberately hand-rolled HTML rather than a page component: no <title>, no
 * meta description, no og: tags. A Next page would inject metadata and the card
 * would come back. The hop is client-side on purpose — a 302 would be followed
 * by the scraper straight to the destination. See lib/links.ts.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const dest = resolveRedirect(slug);
  if (!dest) return new NextResponse("Not found", { status: 404 });

  const js = JSON.stringify(dest); // safe inside <script>
  const href = dest.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="robots" content="noindex,nofollow"></head><body>` +
    // No-JS fallback: a bare anchor carries no card metadata.
    `<a href="${href}">Continue</a>` +
    `<script>location.replace(${js})</script>` +
    `</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
