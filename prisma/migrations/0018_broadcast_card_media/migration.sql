-- Per-broadcast carousel card media overrides ("" = keep template default).
ALTER TABLE "Broadcast" ADD COLUMN "cardMediaUrls" JSONB;
