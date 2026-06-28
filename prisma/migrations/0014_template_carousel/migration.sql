-- Carousel templates: store the card definitions (media URL/format + static body
-- and button per card) so every broadcast of the template reuses them.
ALTER TABLE "Template" ADD COLUMN "cards" JSONB;
