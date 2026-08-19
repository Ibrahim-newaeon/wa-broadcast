/**
 * Outbound link bouncer for /go/<slug>.
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
 * Destinations live in the RedirectLink table, one row per client — never taken
 * from a query string, which would turn the app into a phishing relay.
 */

/** 2–64 chars, lowercase alphanumeric, inner hyphens only. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

/**
 * Normalise a slug and confirm it is well-formed, or null.
 *
 * Rejecting anything with a scheme, slash or space is what keeps /go from
 * being talked into an open redirect by a crafted path.
 */
export function parseSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  return SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * May this URL be used as a /go destination?
 *
 * Destinations come from admin input now, and /go renders one into an <a href>.
 * A `javascript:` or `data:` URL there is stored XSS against every recipient who
 * taps the button, so the scheme allowlist is a security control, not a nicety.
 */
export function isAllowedDestination(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false; // relative, schemeless or unparseable
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}
