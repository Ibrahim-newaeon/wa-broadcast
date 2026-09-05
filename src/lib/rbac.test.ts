import { describe, it, expect } from "vitest";
import { isAdminRole, canManageTemplates } from "./rbac";

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

describe("canManageTemplates", () => {
  it("accepts every signed-in role, members included", () => {
    expect(canManageTemplates("MEMBER")).toBe(true);
    expect(canManageTemplates("ADMIN")).toBe(true);
    expect(canManageTemplates("SUPERADMIN")).toBe(true);
  });
  it("rejects missing or unknown roles", () => {
    expect(canManageTemplates(undefined)).toBe(false);
    expect(canManageTemplates(null)).toBe(false);
    expect(canManageTemplates("")).toBe(false);
    expect(canManageTemplates("GUEST")).toBe(false);
    expect(canManageTemplates("member")).toBe(false); // case-sensitive by design
  });
  it("is strictly wider than isAdminRole", () => {
    for (const role of ["MEMBER", "ADMIN", "SUPERADMIN"]) {
      if (isAdminRole(role)) expect(canManageTemplates(role)).toBe(true);
    }
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(canManageTemplates("MEMBER")).toBe(true);
  });
});
