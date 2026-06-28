-- Per-client uniqueness: two clients may now hold the same phone / template name.
-- Existing rows are all the bootstrap client with previously-unique values, so
-- the composite indexes can't collide.
DROP INDEX "Contact_phone_key";
CREATE UNIQUE INDEX "Contact_clientId_phone_key" ON "Contact"("clientId", "phone");

DROP INDEX "Template_name_language_key";
CREATE UNIQUE INDEX "Template_clientId_name_language_key" ON "Template"("clientId", "name", "language");

DROP INDEX "OptOut_phone_key";
CREATE UNIQUE INDEX "OptOut_clientId_phone_key" ON "OptOut"("clientId", "phone");
