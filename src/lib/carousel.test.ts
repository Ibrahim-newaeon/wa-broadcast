import { describe, it, expect } from "vitest";
import { resolveCarouselCards } from "./carousel";

const CARDS = [
  { format: "IMAGE", mediaUrl: "https://x.co/a.jpg", body: "Card A" },
  { format: "VIDEO", mediaUrl: "https://x.co/b.mp4", body: "Card B" },
];

describe("resolveCarouselCards", () => {
  // POSITIVE: no overrides → template defaults, stripped to send shape
  it("returns the template's card media when no overrides are given", () => {
    expect(resolveCarouselCards(CARDS)).toEqual([
      { format: "IMAGE", mediaUrl: "https://x.co/a.jpg" },
      { format: "VIDEO", mediaUrl: "https://x.co/b.mp4" },
    ]);
  });

  // POSITIVE: overrides replace media per index; "" keeps the default
  it("applies per-card overrides and keeps defaults for blank entries", () => {
    expect(resolveCarouselCards(CARDS, ["https://y.co/new.jpg", ""])).toEqual([
      { format: "IMAGE", mediaUrl: "https://y.co/new.jpg" },
      { format: "VIDEO", mediaUrl: "https://x.co/b.mp4" },
    ]);
  });

  // POSITIVE: a short overrides array only touches the cards it covers
  it("leaves cards beyond the overrides array untouched", () => {
    expect(resolveCarouselCards(CARDS, ["https://y.co/new.jpg"])).toEqual([
      { format: "IMAGE", mediaUrl: "https://y.co/new.jpg" },
      { format: "VIDEO", mediaUrl: "https://x.co/b.mp4" },
    ]);
  });

  // NEGATIVE: whitespace-only override is treated as "keep the default"
  it("ignores whitespace-only overrides", () => {
    const out = resolveCarouselCards(CARDS, ["   ", "https://y.co/b2.mp4"]);
    expect(out).toEqual([
      { format: "IMAGE", mediaUrl: "https://x.co/a.jpg" },
      { format: "VIDEO", mediaUrl: "https://y.co/b2.mp4" },
    ]);
  });

  // NEGATIVE: not a carousel template → null (regardless of overrides)
  it("returns null when the template has no cards", () => {
    expect(resolveCarouselCards(null)).toBeNull();
    expect(resolveCarouselCards(undefined, ["https://y.co/a.jpg"])).toBeNull();
    expect(resolveCarouselCards([], ["https://y.co/a.jpg"])).toBeNull();
    expect(resolveCarouselCards("not-an-array")).toBeNull();
  });
});
