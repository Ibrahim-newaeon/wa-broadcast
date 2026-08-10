/**
 * Allowlisted outbound links for /go/<slug>.
 *
 * Why this exists: WhatsApp scrapes the destination of a template's URL button
 * and renders an Open Graph card above the message body. There is no Cloud API
 * parameter to suppress it — `preview_url` applies to free-form text messages
 * only. The one lever available is what the button points at, so template URL
 * buttons point here instead, and /go serves a page with no title, no
 * description and no og: tags. With nothing to scrape there is no card.
 *
 * The redirect itself must happen in the browser, not as a 301/302: the scraper
 * follows HTTP redirects and would just end up scraping the destination.
 *
 * This is an allowlist, never an open redirect — taking the destination from a
 * query string would turn the app into a phishing relay.
 */
export const REDIRECT_LINKS: Record<string, string> = {
  instagram: "https://www.instagram.com/britishinternational",
};

/**
 * Resolve a /go/<slug> to its destination, or null when the slug is unknown.
 *
 * Own-property check, not a bare lookup: "constructor" and "toString" would
 * otherwise resolve to inherited Object members instead of 404ing.
 */
export function resolveRedirect(slug: string): string | null {
  const key = slug.trim().toLowerCase();
  if (!Object.hasOwn(REDIRECT_LINKS, key)) return null;
  const dest = REDIRECT_LINKS[key];
  return typeof dest === "string" ? dest : null;
}
