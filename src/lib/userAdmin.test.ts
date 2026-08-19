import { describe, it, expect } from "vitest";
import { userEditBlockReason, userDeleteBlockReason, type UserWriteContext } from "./userAdmin";

const ctx = (over: Partial<UserWriteContext> = {}): UserWriteContext => ({
  actor: { email: "admin@x.com", role: "ADMIN" },
  target: { email: "member@x.com", role: "MEMBER" },
  otherAdmins: 1,
  ...over,
});

describe("userEditBlockReason", () => {
  it("allows an admin to edit a member", () => {
    expect(userEditBlockReason(ctx())).toBeNull();
  });

  it("stops an admin from touching a super-admin (password-reset takeover)", () => {
    const reason = userEditBlockReason(ctx({ target: { email: "boss@x.com", role: "SUPERADMIN" } }));
    expect(reason).toContain("super-admin");
  });

  it("lets a super-admin edit another super-admin", () => {
    expect(userEditBlockReason(ctx({
      actor: { email: "boss@x.com", role: "SUPERADMIN" },
      target: { email: "other@x.com", role: "SUPERADMIN" },
    }))).toBeNull();
  });

  it("stops an admin from changing their own role", () => {
    expect(userEditBlockReason(ctx({
      target: { email: "admin@x.com", role: "ADMIN" },
    }), "MEMBER")).toContain("your own role");
  });

  it("matches the actor to the target case-insensitively", () => {
    expect(userEditBlockReason(ctx({
      target: { email: "ADMIN@X.com", role: "ADMIN" },
    }), "MEMBER")).toContain("your own role");
  });

  it("stops the last admin being demoted", () => {
    expect(userEditBlockReason(ctx({
      target: { email: "other@x.com", role: "ADMIN" },
      otherAdmins: 0,
    }), "MEMBER")).toContain("only admin left");
  });

  it("allows demoting an admin while another admin remains", () => {
    expect(userEditBlockReason(ctx({
      target: { email: "other@x.com", role: "ADMIN" },
      otherAdmins: 1,
    }), "MEMBER")).toBeNull();
  });

  it("allows a password reset on the last admin (no role change)", () => {
    expect(userEditBlockReason(ctx({
      target: { email: "other@x.com", role: "ADMIN" },
      otherAdmins: 0,
    }))).toBeNull();
  });

  it("ignores a role field that repeats the current role", () => {
    expect(userEditBlockReason(ctx({
      target: { email: "admin@x.com", role: "ADMIN" },
    }), "ADMIN")).toBeNull();
  });
});

describe("userDeleteBlockReason", () => {
  it("allows an admin to delete a member", () => {
    expect(userDeleteBlockReason(ctx())).toBeNull();
  });

  it("stops self-deletion", () => {
    expect(userDeleteBlockReason(ctx({
      target: { email: "admin@x.com", role: "ADMIN" },
    }))).toContain("your own account");
  });

  it("stops an admin from deleting a super-admin", () => {
    expect(userDeleteBlockReason(ctx({
      target: { email: "boss@x.com", role: "SUPERADMIN" },
    }))).toContain("super-admin");
  });

  it("stops deleting the last admin", () => {
    expect(userDeleteBlockReason(ctx({
      target: { email: "other@x.com", role: "ADMIN" },
      otherAdmins: 0,
    }))).toContain("only admin left");
  });

  it("allows deleting an admin while another remains", () => {
    expect(userDeleteBlockReason(ctx({
      target: { email: "other@x.com", role: "ADMIN" },
      otherAdmins: 2,
    }))).toBeNull();
  });
});
