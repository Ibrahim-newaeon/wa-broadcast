import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSlug, isAllowedDestination } from "@/lib/links";

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
  const { slug: raw } = await ctx.params;
  const slug = parseSlug(raw);
  if (!slug) return new NextResponse("Not found", { status: 404 });

  const link = await prisma.redirectLink.findUnique({ where: { slug }, select: { url: true } });
  // Re-check the scheme at render time even though the API validates on write:
  // this value is about to be interpolated into an <a href>, and a row could
  // predate the check or have been written by hand.
  if (!link || !isAllowedDestination(link.url)) return new NextResponse("Not found", { status: 404 });
  const dest = link.url;

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
