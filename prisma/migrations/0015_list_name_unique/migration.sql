-- Enforce unique list names per client.
-- Defensive dedupe first: if any client already has duplicate list names, keep
-- the earliest-created one untouched and suffix the rest with a short id slice,
-- so the unique index below can always be created (deploy never fails).
UPDATE "ContactList" cl
SET "name" = cl."name" || ' (' || left(cl."id", 6) || ')'
WHERE EXISTS (
  SELECT 1 FROM "ContactList" other
  WHERE other."clientId" = cl."clientId"
    AND other."name" = cl."name"
    AND (other."createdAt" < cl."createdAt"
         OR (other."createdAt" = cl."createdAt" AND other."id" < cl."id"))
);

CREATE UNIQUE INDEX "ContactList_clientId_name_key" ON "ContactList"("clientId", "name");
