-- 0006 — no-code WhatsApp connection settings (single row).
CREATE TABLE "WhatsAppConfig" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "accessToken" TEXT,
    "appSecret" TEXT,
    "webhookVerifyToken" TEXT,
    "graphApiVersion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppConfig_pkey" PRIMARY KEY ("id")
);
