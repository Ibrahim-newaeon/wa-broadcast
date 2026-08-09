import { describe, it, expect } from "vitest";
import { sendJobId } from "./jobId";

describe("sendJobId", () => {
  // POSITIVE: joins the parts with "_" so the id stays readable and unique
  it("joins parts with an underscore", () => {
    expect(sendJobId("bcast1", "contact1")).toBe("bcast1_contact1");
  });

  // POSITIVE: the retry form (three parts) is still one legal id
  it("joins three parts", () => {
    expect(sendJobId("bcast1", "contact1", "r1700000000000")).toBe("bcast1_contact1_r1700000000000");
  });

  // POSITIVE: deterministic — same inputs dedupe to the same job
  it("is deterministic for the same parts", () => {
    expect(sendJobId("a", "b")).toBe(sendJobId("a", "b"));
  });

  // NEGATIVE: BullMQ throws "Custom Id cannot contain :" — never emit one
  it("never emits a colon, even when a part contains one", () => {
    expect(sendJobId("bc:1", "co:2")).toBe("bc-1_co-2");
    expect(sendJobId("bc:1", "co:2")).not.toContain(":");
  });

  // NEGATIVE: BullMQ also rejects ids that parse as integers
  it("does not produce a bare integer id from numeric parts", () => {
    const id = sendJobId(12, 34);
    expect(id).toBe("12_34");
    expect(`${parseInt(id, 10)}`).not.toBe(id);
  });
});
