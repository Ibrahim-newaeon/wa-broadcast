-- A subdomain only binds a client once it actually resolves: the record has to
-- exist in DNS and the server has to serve the hostname. Storing the slug and
-- activating it are therefore two steps, so saving one can never lock a
-- client's users out of an address that isn't live yet.
ALTER TABLE "Client" ADD COLUMN "slugActive" BOOLEAN NOT NULL DEFAULT false;

-- Every slug that exists today is already served (bia.massegat.com), so it
-- stays bound across this migration.
UPDATE "Client" SET "slugActive" = true WHERE "slug" IS NOT NULL;
