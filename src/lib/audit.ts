import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getAuthContext } from "./users";

/**
 * Append an audit-log entry for the caller's action. Best-effort: never throws
 * and never blocks the action it describes — call it fire-and-forget
 * (`void audit(req, ...)`) or awaited when ordering matters.
 */
export async function audit(
  req: NextRequest,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) return; // unauthenticated callers are rejected upstream
    await prisma.auditLog.create({
      data: {
        clientId: ctx.clientId,
        actor: ctx.email,
        role: ctx.role,
        action,
        target: target ?? null,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error(`[audit] failed to record ${action}:`, err instanceof Error ? err.message : err);
  }
}
