import { describe, it, expect } from "vitest";
import { isAdminRole } from "./rbac";

describe("isAdminRole", () => {
  it("accepts ADMIN and SUPERADMIN", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPERADMIN")).toBe(true);
  });
  it("rejects MEMBER", () => {
    expect(isAdminRole("MEMBER")).toBe(false);
  });
  it("rejects missing or unknown roles", () => {
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole("admin")).toBe(false); // case-sensitive by design
  });
});
