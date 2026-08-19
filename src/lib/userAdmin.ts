import { isAdminRole } from "./rbac";

// Pure guards for team management (edit / reset password / remove). The API
// routes are already gated to ADMIN by `requireAdmin` and scoped to the acting
// client; these rules cover what an admin still must not do inside their own
// tenant — escalate privileges, or lock the tenant out of its own account.

export interface Actor { email: string; role: string }
export interface TargetUser { email: string; role: string }

export interface UserWriteContext {
  actor: Actor;
  target: TargetUser;
  /** Admins (ADMIN or SUPERADMIN) left in the client once the target is excluded. */
  otherAdmins: number;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Why the actor may not edit this user (name, role or password), or null when
 * allowed. `newRole` is only supplied when the edit changes the role.
 */
export function userEditBlockReason(ctx: UserWriteContext, newRole?: string): string | null {
  const { actor, target, otherAdmins } = ctx;

  // A tenant admin must never be able to take over a super-admin account by
  // resetting its password.
  if (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN") {
    return "Only a super-admin can change a super-admin account.";
  }

  if (newRole && newRole !== target.role) {
    if (same(actor.email, target.email)) {
      return "You cannot change your own role — ask another admin.";
    }
    if (isAdminRole(target.role) && !isAdminRole(newRole) && otherAdmins === 0) {
      return "This is the only admin left — promote someone else before demoting them.";
    }
  }

  return null;
}

/** Why the actor may not delete this user, or null when allowed. */
export function userDeleteBlockReason(ctx: UserWriteContext): string | null {
  const { actor, target, otherAdmins } = ctx;

  if (same(actor.email, target.email)) {
    return "You cannot delete your own account.";
  }
  if (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN") {
    return "Only a super-admin can delete a super-admin account.";
  }
  if (isAdminRole(target.role) && otherAdmins === 0) {
    return "This is the only admin left — promote someone else first.";
  }

  return null;
}
