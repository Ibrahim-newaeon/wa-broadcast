-- Limited-time-offer templates: the offer banner text lives on the template
-- (non-null = LTO); a countdown offer needs an expiry supplied per broadcast.
ALTER TABLE "Template" ADD COLUMN "ltoText" TEXT;
ALTER TABLE "Template" ADD COLUMN "ltoExpiration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Broadcast" ADD COLUMN "ltoExpiresAt" TIMESTAMP(3);
