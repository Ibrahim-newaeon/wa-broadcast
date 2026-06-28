-- Multi-tenant foundation: a Client table + clientId on every top-level model,
-- backfilled to a bootstrap "default" client so existing data keeps working.
CREATE TABLE "Client" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- Bootstrap client that owns all pre-existing data.
INSERT INTO "Client" ("id", "name") VALUES ('default', 'Default');

-- clientId on each owned model (NOT NULL, defaults to the bootstrap client).
ALTER TABLE "Contact"           ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "ContactList"       ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Template"          ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Broadcast"         ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "RecurringCampaign" ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "User"              ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "OptOut"            ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "WhatsAppConfig"    ADD COLUMN "clientId" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "Contact_clientId_idx"           ON "Contact"("clientId");
CREATE INDEX "ContactList_clientId_idx"       ON "ContactList"("clientId");
CREATE INDEX "Template_clientId_idx"          ON "Template"("clientId");
CREATE INDEX "Broadcast_clientId_idx"         ON "Broadcast"("clientId");
CREATE INDEX "RecurringCampaign_clientId_idx" ON "RecurringCampaign"("clientId");
CREATE INDEX "User_clientId_idx"              ON "User"("clientId");
CREATE INDEX "OptOut_clientId_idx"            ON "OptOut"("clientId");
CREATE UNIQUE INDEX "WhatsAppConfig_clientId_key" ON "WhatsAppConfig"("clientId");
