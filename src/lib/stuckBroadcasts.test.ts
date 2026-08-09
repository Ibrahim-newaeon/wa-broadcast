import { describe, it, expect } from "vitest";
import { classifyStuck, candidateJobIds } from "./stuckBroadcasts";

const b = (id: string, ...contactIds: string[]) => ({
  id,
  recipients: contactIds.map((contactId) => ({ contactId })),
});

const none = () => false;
const all = () => true;

describe("candidateJobIds", () => {
  // POSITIVE: probes the current scheme and the pre-fix ":" scheme
  it("probes both the current and legacy job id schemes", () => {
    expect(candidateJobIds("bc1", "co1")).toEqual(["bc1_co1", "bc1:co1"]);
  });
});

describe("classifyStuck", () => {
  // POSITIVE: no jobs behind any recipient => stranded, the thing we clean up
  it("marks a broadcast with no queued jobs as stranded", () => {
    const { stranded, partial } = classifyStuck([b("bc1", "co1", "co2")], none);
    expect(stranded.map((x) => x.id)).toEqual(["bc1"]);
    expect(partial).toEqual([]);
  });

  // NEGATIVE: a scheduled campaign has delayed jobs — must never be stranded
  it("never strands a broadcast whose recipients all have jobs", () => {
    const { stranded, partial } = classifyStuck([b("bc1", "co1", "co2")], all);
    expect(stranded).toEqual([]);
    expect(partial).toEqual([{ broadcast: b("bc1", "co1", "co2"), queued: 2 }]);
  });

  // NEGATIVE: a single surviving job is enough to protect the whole broadcast
  it("protects a broadcast when even one recipient still has a job", () => {
    const hasJob = (_id: string, contactId: string) => contactId === "co2";
    const { stranded, partial } = classifyStuck([b("bc1", "co1", "co2", "co3")], hasJob);
    expect(stranded).toEqual([]);
    expect(partial.at(0)?.queued).toBe(1);
  });

  // NEGATIVE: nothing pending means nothing to clean — never select it
  it("ignores a broadcast with no pending recipients", () => {
    const { stranded, partial } = classifyStuck([b("bc1")], none);
    expect(stranded).toEqual([]);
    expect(partial).toEqual([]);
  });

  // POSITIVE: mixed input is split, not all-or-nothing
  it("splits stranded from partial across several broadcasts", () => {
    const hasJob = (id: string) => id === "safe";
    const { stranded, partial } = classifyStuck([b("stuck", "co1"), b("safe", "co2")], hasJob);
    expect(stranded.map((x) => x.id)).toEqual(["stuck"]);
    expect(partial.map((p) => p.broadcast.id)).toEqual(["safe"]);
  });

  // NEGATIVE: empty input is a no-op, not a crash
  it("returns empty results for no candidates", () => {
    expect(classifyStuck([], none)).toEqual({ stranded: [], partial: [] });
  });
});
