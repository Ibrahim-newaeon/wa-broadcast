-- Two-way messaging: conversation threads + individual messages (per client).
CREATE TABLE "Conversation" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT NOT NULL,
  "phone"         TEXT NOT NULL,
  "contactId"     TEXT,
  "lastInboundAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastPreview"   TEXT,
  "unread"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Conversation_clientId_phone_key" ON "Conversation"("clientId", "phone");
CREATE INDEX "Conversation_clientId_lastMessageAt_idx" ON "Conversation"("clientId", "lastMessageAt");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Message" (
  "id"             TEXT NOT NULL,
  "clientId"       TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "direction"      TEXT NOT NULL,
  "type"           TEXT NOT NULL DEFAULT 'text',
  "text"           TEXT,
  "mediaId"        TEXT,
  "mediaMime"      TEXT,
  "mediaFilename"  TEXT,
  "wamid"          TEXT,
  "status"         TEXT,
  "error"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Message_wamid_key" ON "Message"("wamid");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_wamid_idx" ON "Message"("wamid");
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
