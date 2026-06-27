-- 0002 — persist variableMap on Broadcast so failed recipients can be retried.
ALTER TABLE "Broadcast" ADD COLUMN "variableMap" JSONB NOT NULL DEFAULT '[]';
