import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one contact").max(500),
});

/**
 * POST /api/contacts/bulk-delete — delete many contacts in one request.
 * Body: { ids: string[] }
 * Deletes one-by-one so a contact with broadcast history (FK RESTRICT) is
 * skipped rather than failing the whole batch.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = BulkDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const clientId = await getClientId(req);
  let deleted = 0;
  let skipped = 0;
  for (const id of parsed.data.ids) {
    try {
      // Scoped delete — count 0 means not found / not this client's.
      const r = await prisma.contact.deleteMany({ where: { id, clientId } });
      if (r.count > 0) deleted++;
      else skipped++;
    } catch {
      // Has broadcast history (FK RESTRICT) — leave it in place.
      skipped++;
    }
  }

  if (deleted > 0) void audit(req, "contacts.bulk_deleted", null, { deleted, skipped });
  return NextResponse.json({ ok: true, deleted, skipped });
}
