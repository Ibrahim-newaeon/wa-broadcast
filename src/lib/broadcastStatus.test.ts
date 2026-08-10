import { describe, it, expect } from "vitest";
import { statusAfterEnqueue } from "./broadcastStatus";

describe("statusAfterEnqueue", () => {
  // NEGATIVE: total enqueue failure — the job-id outage case
  it("fails the broadcast when nothing reached the queue", () => {
    expect(statusAfterEnqueue({ queued: 0, total: 3, sent: 0, failed: 3 })).toBe("FAILED");
  });

  // POSITIVE: healthy send still in flight — leave it to the worker
  it("leaves a broadcast alone while jobs are still in flight", () => {
    expect(statusAfterEnqueue({ queued: 3, total: 3, sent: 0, failed: 0 })).toBeNull();
  });

  // POSITIVE: a scheduled broadcast is queued but nothing has run yet
  it("leaves a scheduled broadcast alone", () => {
    expect(statusAfterEnqueue({ queued: 10, total: 10, sent: 0, failed: 0 })).toBeNull();
  });

  // POSITIVE: partial failure, remaining jobs still running
  it("leaves a partially-enqueued broadcast alone while the rest run", () => {
    expect(statusAfterEnqueue({ queued: 2, total: 3, sent: 0, failed: 1 })).toBeNull();
  });

  // POSITIVE: the race this function exists for — queued jobs all finished
  // before the enqueue failures were recorded, so no further event will fire
  it("completes when the failures close the gap after the last job finished", () => {
    expect(statusAfterEnqueue({ queued: 2, total: 3, sent: 2, failed: 1 })).toBe("COMPLETED");
  });

  // POSITIVE: ordinary full completion
  it("completes when everything is accounted for", () => {
    expect(statusAfterEnqueue({ queued: 3, total: 3, sent: 3, failed: 0 })).toBe("COMPLETED");
  });

  // NEGATIVE: counts overshooting total must not wedge it open
  it("completes when counts exceed the total", () => {
    expect(statusAfterEnqueue({ queued: 2, total: 2, sent: 2, failed: 1 })).toBe("COMPLETED");
  });

  // NEGATIVE: zero queued takes precedence over an already-settled count
  it("prefers FAILED over COMPLETED when nothing was queued", () => {
    expect(statusAfterEnqueue({ queued: 0, total: 2, sent: 0, failed: 2 })).toBe("FAILED");
  });
});
