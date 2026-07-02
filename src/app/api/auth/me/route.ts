import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/users";
import { isAdminRole } from "@/lib/rbac";

export const runtime = "nodejs";

/** GET /api/auth/me — the caller's identity claims (for role-aware UI). */
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ email: ctx.email, role: ctx.role, clientId: ctx.clientId, isAdmin: isAdminRole(ctx.role) });
}
