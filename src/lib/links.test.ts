import { describe, it, expect } from "vitest";
import { parseSlug, isAllowedDestination } from "./links";

describe("parseSlug", () => {
  // POSITIVE: the namespaced form templates are expected to use
  it("accepts a client-namespaced slug", () => {
    expect(parseSlug("bia-instagram")).toBe("bia-instagram");
  });

  // POSITIVE: tolerant of case and stray whitespace, as the old allowlist was
  it("lowercases and trims", () => {
    expect(parseSlug("  BIA-Instagram ")).toBe("bia-instagram");
  });

  // NEGATIVE: a URL in the slug position must never survive parsing —
  // this is what keeps /go from becoming an open redirect
  it("rejects a URL passed as the slug", () => {
    expect(parseSlug("https://evil.example.com")).toBeNull();
    expect(parseSlug("//evil.example.com")).toBeNull();
  });

  // NEGATIVE: path traversal must not survive
  it("rejects path separators", () => {
    expect(parseSlug("../secret")).toBeNull();
    expect(parseSlug("a/b")).toBeNull();
  });

  // NEGATIVE: empty, too short, and whitespace-bearing slugs
  it("rejects empty, single-character and spaced slugs", () => {
    expect(parseSlug("")).toBeNull();
    expect(parseSlug("   ")).toBeNull();
    expect(parseSlug("a")).toBeNull();
    expect(parseSlug("has space")).toBeNull();
  });

  // NEGATIVE: hyphens may join words but must not lead or trail
  it("rejects leading and trailing hyphens", () => {
    expect(parseSlug("-leading")).toBeNull();
    expect(parseSlug("trailing-")).toBeNull();
  });
});

describe("isAllowedDestination", () => {
  // POSITIVE: ordinary web destinations
  it("allows http and https URLs", () => {
    expect(isAllowedDestination("https://www.instagram.com/britishinternational")).toBe(true);
    expect(isAllowedDestination("http://example.com/path?a=1")).toBe(true);
  });

  // NEGATIVE: the reason this function exists. Destinations now come from
  // admin input, and /go renders one into an <a href>. A javascript: or data:
  // URL there is stored XSS against anyone who taps the button.
  it("rejects script-bearing schemes", () => {
    expect(isAllowedDestination("javascript:alert(1)")).toBe(false);
    expect(isAllowedDestination("JavaScript:alert(1)")).toBe(false);
    expect(isAllowedDestination("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isAllowedDestination("vbscript:msgbox(1)")).toBe(false);
  });

  // NEGATIVE: must be absolute — a relative target would bounce within the app
  it("rejects relative and schemeless targets", () => {
    expect(isAllowedDestination("/relative")).toBe(false);
    expect(isAllowedDestination("//evil.example.com")).toBe(false);
    expect(isAllowedDestination("example.com")).toBe(false);
    expect(isAllowedDestination("")).toBe(false);
  });

  // NEGATIVE: non-web schemes have no business in a template button
  it("rejects non-web schemes", () => {
    expect(isAllowedDestination("ftp://example.com")).toBe(false);
    expect(isAllowedDestination("file:///etc/passwd")).toBe(false);
  });
});
