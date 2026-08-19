-- A list that has been broadcast to cannot be deleted (Broadcast.listId is
-- FK-restricted so send history keeps its list name). Archiving hides it from
-- the pickers and the Lists page instead, leaving every broadcast intact.
ALTER TABLE "ContactList" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
