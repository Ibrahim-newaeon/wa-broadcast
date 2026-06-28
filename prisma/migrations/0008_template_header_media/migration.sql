-- Media header support for sending: store the template's header format and the
-- per-broadcast media URL used for the header component.
ALTER TABLE "Template" ADD COLUMN "headerFormat" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "headerMediaUrl" TEXT;
