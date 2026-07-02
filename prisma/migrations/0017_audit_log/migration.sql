-- Append-only audit trail: who did what, when, in which tenant.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL DEFAULT 'default',
    "actor" TEXT NOT NULL,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_clientId_createdAt_idx" ON "AuditLog"("clientId", "createdAt");
