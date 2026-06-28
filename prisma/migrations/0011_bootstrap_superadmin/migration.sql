-- Promote the bootstrap client's existing admin(s) to SUPERADMIN so they can
-- create and manage other clients.
UPDATE "User" SET "role" = 'SUPERADMIN' WHERE "clientId" = 'default' AND "role" = 'ADMIN';
