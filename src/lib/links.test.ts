import { describe, it, expect } from "vitest";
import { resolveRedirect, REDIRECT_LINKS } from "./links";

describe("resolveRedirect", () => {
  // POSITIVE: a known slug resolves to its destination
  it("resolves an allowlisted slug", () => {
    expect(resolveRedirect("instagram")).toBe(REDIRECT_LINKS.instagram);
  });

  // POSITIVE: tolerant of case and stray whitespace
  it("is case-insensitive and trims", () => {
    expect(resolveRedirect("  Instagram ")).toBe(REDIRECT_LINKS.instagram);
  });

  // NEGATIVE: unknown slugs resolve to null, never a redirect
  it("returns null for an unknown slug", () => {
    expect(resolveRedirect("nope")).toBeNull();
  });

  // NEGATIVE: must never behave as an open redirect
  it("never resolves an arbitrary URL passed as the slug", () => {
    expect(resolveRedirect("https://evil.example.com")).toBeNull();
    expect(resolveRedirect("//evil.example.com")).toBeNull();
  });

  // NEGATIVE: prototype keys must not leak through the lookup
  it("does not resolve inherited object properties", () => {
    expect(resolveRedirect("constructor")).toBeNull();
    expect(resolveRedirect("toString")).toBeNull();
  });
});
