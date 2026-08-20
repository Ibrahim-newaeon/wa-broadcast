import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BulkAddToListSchema } from "@/lib/validation";
import { getClientId } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/contacts/bulk-list — add many contacts to one list.
 * Body: { ids: string[], listId: string }
 *
 * Not admin-gated: this is ordinary audience work, the same as importing a CSV
 * straight into a list, and it is reversible from the row editor.
 *
 * Adding only — never removing. The bulk control exists to fix "these 40 people
 * should have been in the September list", and a bulk *remove* is the kind of
 * thing that is easy to fire by accident and hard to undo, so it stays a
 * per-contact action.
 */
export async function POST(req: NextRequest) {
  const parsed = BulkAddToListSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const { ids, listId } = parsed.data;
  const clientId = await getClientId(req);

  // Both the list and the contacts must belong to the caller's client, or a
  // guessed id would reach across tenants.
  const list = await prisma.contactList.findFirst({
    where: { id: listId, clientId },
    select: { id: true, name: true, archived: true },
  });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 400 });
  if (list.archived) {
    return NextResponse.json({ error: "That list is archived. Restore it first." }, { status: 400 });
  }

  const owned = await prisma.contact.findMany({
    where: { id: { in: ids }, clientId },
    select: { id: true },
  });

  const result = await prisma.contactListMembership.createMany({
    data: owned.map((c) => ({ contactId: c.id, listId })),
    skipDuplicates: true, // already-members are a no-op, not an error
  });

  const added = result.count;
  const alreadyIn = owned.length - added;
  const skipped = ids.length - owned.length;

  if (added > 0) {
    void audit(req, "contacts.bulk_listed", list.name, { added, alreadyIn, skipped });
  }
  return NextResponse.json({ ok: true, added, alreadyIn, skipped, listName: list.name });
}
