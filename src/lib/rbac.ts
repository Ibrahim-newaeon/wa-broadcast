// Pure role checks — shared by API guards and role-aware UI. Roles are
// SUPERADMIN | ADMIN | MEMBER (see prisma User.role).

/** Every role a signed-in tenant user can hold. Anything else is not a user. */
const KNOWN_ROLES = new Set(["SUPERADMIN", "ADMIN", "MEMBER"]);

/** True for roles allowed to manage data (deletions, settings, campaigns). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * True for roles allowed to author templates: draft one, upload its media
 * sample to Meta, and submit it for approval.
 *
 * Members are included deliberately. Submitting a template is a *proposal*, not
 * a send — Meta reviews every submission and it stays PENDING until approved,
 * so the blast radius is a rejected draft rather than a message to customers.
 * Broadcasting with an approved template remains admin-only. Every submission
 * is attributed to its author in the audit log (`template.submitted`).
 */
export function canManageTemplates(role: string | null | undefined): boolean {
  return typeof role === "string" && KNOWN_ROLES.has(role);
}
