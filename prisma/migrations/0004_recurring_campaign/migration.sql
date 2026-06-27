-- 0004 — recurring / drip campaigns.
CREATE TABLE "RecurringCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "variableMap" JSONB NOT NULL DEFAULT '[]',
    "cron" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringCampaign_active_idx" ON "RecurringCampaign"("active");
