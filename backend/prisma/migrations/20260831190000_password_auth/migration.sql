-- Pre-launch: no real user data exists yet in any environment, so this clears
-- test/seed rows instead of trying to backfill a passwordHash for magic-link accounts.
DELETE FROM "ConversacionWA";
DELETE FROM "Aprobacion";
DELETE FROM "Gasto";
DROP TABLE "MagicLink";
DELETE FROM "Usuario";

ALTER TABLE "Usuario" ADD COLUMN "passwordHash" TEXT NOT NULL;
