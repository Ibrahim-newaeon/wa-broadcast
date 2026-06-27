import { describe, it, expect } from "vitest";
import { toE164 } from "./phone";

describe("toE164", () => {
  // POSITIVE: prepends the country code and strips the national trunk 0
  it("drops a national trunk 0 and prepends the country code", () => {
    expect(toE164("966", "050 000 0001")).toBe("966500000001");
  });

  // POSITIVE: does not double the country code if the user typed it again
  it("does not double a re-typed country code (with +)", () => {
    expect(toE164("966", "+966 50 000 0001")).toBe("966500000001");
  });

  // POSITIVE: a bare national number just gets the code prepended
  it("prepends the code to a bare national number", () => {
    expect(toE164("965", "5000 0003")).toBe("96550000003");
  });

  // NEGATIVE: strips all non-digits, never emits a '+'
  it("returns digits only (no '+', spaces, or dashes)", () => {
    expect(toE164("+20", "10-0000-0003")).toBe("201000000003");
    expect(toE164("20", "10-0000-0003")).toMatch(/^\d+$/);
  });
});
