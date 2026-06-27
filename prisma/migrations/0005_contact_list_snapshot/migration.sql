-- 0005 — contact list snapshots (restorable membership backups).
CREATE TABLE "ContactListSnapshot" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "memberIds" JSONB NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactListSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactListSnapshot_listId_idx" ON "ContactListSnapshot"("listId");
ALTER TABLE "ContactListSnapshot" ADD CONSTRAINT "ContactListSnapshot_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
