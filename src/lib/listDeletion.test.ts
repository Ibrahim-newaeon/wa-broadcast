import { describe, it, expect } from "vitest";
import { listDeleteBlockReason } from "./listDeletion";

describe("listDeleteBlockReason", () => {
  it("allows deletion when nothing references the list", () => {
    expect(listDeleteBlockReason("VIPs", { broadcasts: 0, campaigns: 0 })).toBeNull();
  });

  it("blocks on broadcasts and names the count", () => {
    const reason = listDeleteBlockReason("VIPs", { broadcasts: 3, campaigns: 0 });
    expect(reason).toContain("VIPs");
    expect(reason).toContain("3 broadcasts");
    expect(reason).not.toContain("campaign");
    // The refusal must name the way out, or it is a dead end.
    expect(reason).toContain("Archive it instead");
  });

  it("blocks on recurring campaigns alone", () => {
    expect(listDeleteBlockReason("VIPs", { broadcasts: 0, campaigns: 1 })).toContain("1 recurring campaign");
  });

  it("mentions both kinds of reference", () => {
    const reason = listDeleteBlockReason("VIPs", { broadcasts: 2, campaigns: 1 });
    expect(reason).toContain("2 broadcasts");
    expect(reason).toContain("1 recurring campaign");
  });

  it("uses singular wording for a single broadcast", () => {
    expect(listDeleteBlockReason("VIPs", { broadcasts: 1, campaigns: 0 })).toContain("1 broadcast,");
  });
});
