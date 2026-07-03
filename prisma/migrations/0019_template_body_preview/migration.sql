-- Mirror the template's message text + buttons locally so the broadcast form
-- can preview the message. Backfilled by the next template sync.
ALTER TABLE "Template" ADD COLUMN "bodyText" TEXT;
ALTER TABLE "Template" ADD COLUMN "footerText" TEXT;
ALTER TABLE "Template" ADD COLUMN "buttons" JSONB;
