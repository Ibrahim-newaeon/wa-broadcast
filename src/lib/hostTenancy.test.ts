import { describe, it, expect } from "vitest";
import { hostTenantSlug, consoleHostFor, tenantHostFor, resolveHostAccess, type HostAccessInput } from "./hostTenancy";

describe("hostTenantSlug", () => {
  it("reads the tenant label off a subdomain", () => {
    expect(hostTenantSlug("bia.massegat.com")).toBe("bia");
  });

  it("treats the console host as no tenant", () => {
    expect(hostTenantSlug("app.massegat.com")).toBeNull();
  });

  it("treats the apex as no tenant", () => {
    expect(hostTenantSlug("massegat.com")).toBeNull();
  });

  it("ignores port, case and a trailing dot", () => {
    expect(hostTenantSlug("BIA.Massegat.com:3000")).toBe("bia");
    expect(hostTenantSlug("bia.massegat.com.")).toBe("bia");
  });

  it("still binds the legacy whatsapp-broadcast.com hostname", () => {
    expect(hostTenantSlug("bia.whatsapp-broadcast.com")).toBe("bia");
  });

  it("has no tenant on localhost or an empty host", () => {
    expect(hostTenantSlug("localhost:3000")).toBeNull();
    expect(hostTenantSlug("")).toBeNull();
    expect(hostTenantSlug(null)).toBeNull();
  });

  it("never lets a reserved label act as a tenant", () => {
    for (const h of ["www.massegat.com", "api.massegat.com", "admin.massegat.com"]) {
      expect(hostTenantSlug(h)).toBeNull();
    }
  });
});

describe("host name helpers", () => {
  it("derives the console host from a tenant host", () => {
    expect(consoleHostFor("bia.massegat.com")).toBe("app.massegat.com");
    expect(consoleHostFor("massegat.com")).toBe("app.massegat.com");
  });

  it("derives a tenant host from the current host", () => {
    expect(tenantHostFor("app.massegat.com", "acme")).toBe("acme.massegat.com");
  });
});

const HOST = "bia.massegat.com";
const CONSOLE = "app.massegat.com";

const input = (over: Partial<HostAccessInput> = {}): HostAccessInput => ({
  hostSlug: "bia",
  hostClientId: "c_bia",
  role: "ADMIN",
  ownClientId: "c_bia",
  ownSlug: "bia",
  ...over,
});

describe("resolveHostAccess — tenant host", () => {
  it("lets the tenant's own user in, pinned", () => {
    expect(resolveHostAccess(input(), HOST)).toEqual({ ok: true, clientId: "c_bia", pinned: true });
  });

  it("lets a super-admin in but pins them to that tenant", () => {
    const r = resolveHostAccess(input({ role: "SUPERADMIN", ownClientId: "default", ownSlug: null }), HOST);
    expect(r).toEqual({ ok: true, clientId: "c_bia", pinned: true });
  });

  it("ignores a super-admin's acting-client cookie on a tenant host", () => {
    const r = resolveHostAccess(input({ role: "SUPERADMIN", ownClientId: "default", ownSlug: null, actingCookie: "c_other" }), HOST);
    expect(r).toEqual({ ok: true, clientId: "c_bia", pinned: true });
  });

  it("refuses a user from another client and points at the console", () => {
    const r = resolveHostAccess(input({ ownClientId: "default", ownSlug: null }), HOST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("serves bia only");
      expect(r.error).toContain("app.massegat.com");
    }
  });

  it("refuses a hostname whose slug matches no client", () => {
    const r = resolveHostAccess(input({ hostSlug: "ghost", hostClientId: null }), "ghost.massegat.com");
    expect(r.ok).toBe(false);
  });
});

describe("resolveHostAccess — console host", () => {
  const console_ = (over: Partial<HostAccessInput> = {}) =>
    resolveHostAccess(input({ hostSlug: null, hostClientId: null, ...over }), CONSOLE);

  it("gives a super-admin the switcher", () => {
    expect(console_({ role: "SUPERADMIN", ownClientId: "default", ownSlug: null }))
      .toEqual({ ok: true, clientId: "default", pinned: false });
  });

  it("honours a super-admin's acting client there", () => {
    expect(console_({ role: "SUPERADMIN", ownClientId: "default", ownSlug: null, actingCookie: "c_bia" }))
      .toEqual({ ok: true, clientId: "c_bia", pinned: false });
  });

  it("lets in a client that has no subdomain, pinned to itself", () => {
    expect(console_({ ownClientId: "c_acme", ownSlug: null }))
      .toEqual({ ok: true, clientId: "c_acme", pinned: true });
  });

  it("sends a user whose client has a subdomain back to it", () => {
    const r = console_({ ownClientId: "c_bia", ownSlug: "bia" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("bia.massegat.com");
  });
});
