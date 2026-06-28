import { describe, it, expect } from "vitest";
import { resolveActingClientId, DEFAULT_CLIENT_ID } from "./tenancy";

describe("resolveActingClientId", () => {
  // POSITIVE: a super-admin's acting-client cookie overrides their own tenant
  it("lets a SUPERADMIN act as another client via the cookie", () => {
    expect(resolveActingClientId("SUPERADMIN", "default", "client_b")).toBe("client_b");
  });

  it("falls back to the super-admin's own client when no cookie is set", () => {
    expect(resolveActingClientId("SUPERADMIN", "client_a", undefined)).toBe("client_a");
  });

  // NEGATIVE: non-super-admins can NEVER cross tenants, even with a forged cookie
  it("ignores the acting cookie for ADMIN (no cross-tenant access)", () => {
    expect(resolveActingClientId("ADMIN", "client_a", "client_b")).toBe("client_a");
  });

  it("ignores the acting cookie for MEMBER", () => {
    expect(resolveActingClientId("MEMBER", "client_a", "client_b")).toBe("client_a");
  });

  it("ignores the acting cookie for an unknown/undefined role", () => {
    expect(resolveActingClientId(undefined, "client_a", "client_b")).toBe("client_a");
  });

  // Defensive: missing ownClientId falls back to the bootstrap tenant
  it("defaults to the bootstrap client when ownClientId is missing", () => {
    expect(resolveActingClientId("MEMBER", undefined, undefined)).toBe(DEFAULT_CLIENT_ID);
  });

  it("an empty acting cookie does not override", () => {
    expect(resolveActingClientId("SUPERADMIN", "client_a", "")).toBe("client_a");
  });
});
