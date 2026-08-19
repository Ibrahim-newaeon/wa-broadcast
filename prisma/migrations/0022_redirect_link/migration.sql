-- Redirect destinations move out of the hardcoded REDIRECT_LINKS map in
-- src/lib/links.ts and into the database, so a client can add a template button
-- destination without a code change and a deploy.
--
-- The slug is globally unique rather than unique-per-client: /go is served on
-- the apex, which is not bound to a tenant, so the slug alone identifies the
-- row. Clients namespace their slugs by convention (bia-instagram).
CREATE TABLE "RedirectLink" (
    "id"        TEXT NOT NULL,
    "clientId"  TEXT NOT NULL DEFAULT 'default',
    "slug"      TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RedirectLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RedirectLink_slug_key" ON "RedirectLink"("slug");
CREATE INDEX "RedirectLink_clientId_idx" ON "RedirectLink"("clientId");

-- Carry the one hardcoded link across. Selected from Client rather than
-- hardcoded to a cuid: this migration also runs on deployments that have no
-- 'bia' client, where it correctly inserts nothing.
--
-- Both spellings are seeded on purpose. 'instagram' keeps every URL already
-- printed in an approved template working; 'bia-instagram' is the namespaced
-- form new templates should use, so the next client's Instagram link does not
-- collide with this one.
INSERT INTO "RedirectLink" ("id", "clientId", "slug", "url", "createdAt", "updatedAt")
SELECT 'seed-instagram', c."id", 'instagram',
       'https://www.instagram.com/britishinternational', NOW(), NOW()
FROM "Client" c WHERE c."slug" = 'bia'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RedirectLink" ("id", "clientId", "slug", "url", "createdAt", "updatedAt")
SELECT 'seed-bia-instagram', c."id", 'bia-instagram',
       'https://www.instagram.com/britishinternational', NOW(), NOW()
FROM "Client" c WHERE c."slug" = 'bia'
ON CONFLICT ("slug") DO NOTHING;
