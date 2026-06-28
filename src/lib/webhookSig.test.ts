import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "./webhookSig";

const sign = (secret: string, body: string) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ entry: [{ id: "WABA1", changes: [] }] });

  // POSITIVE: a signature made with the matching secret verifies
  it("accepts a signature made with the same secret", () => {
    expect(verifyWebhookSignature("secretA", body, sign("secretA", body))).toBe(true);
  });

  // NEGATIVE: a different client's secret must not verify (per-client isolation)
  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature("secretB", body, sign("secretA", body))).toBe(false);
  });

  // NEGATIVE: a tampered body breaks the signature
  it("rejects when the body was tampered with", () => {
    const sig = sign("secretA", body);
    expect(verifyWebhookSignature("secretA", body + " ", sig)).toBe(false);
  });

  // NEGATIVE: missing header / empty secret reject cleanly (no throw)
  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature("secretA", body, null)).toBe(false);
  });
  it("rejects when no app secret is configured", () => {
    expect(verifyWebhookSignature("", body, sign("secretA", body))).toBe(false);
  });
  it("rejects a malformed (wrong-length) signature without throwing", () => {
    expect(verifyWebhookSignature("secretA", body, "sha256=deadbeef")).toBe(false);
  });
});
