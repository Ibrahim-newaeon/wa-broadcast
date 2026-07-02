// Pure role checks — shared by API guards and role-aware UI. Roles are
// SUPERADMIN | ADMIN | MEMBER (see prisma User.role).

/** True for roles allowed to manage data (templates, deletions, settings, campaigns). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}
