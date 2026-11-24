-- Post / PostDraft background columns (#21, per-post visual customization).
--
-- These columns reached the database through `prisma db push`, which can no
-- longer run here, so the SQL that describes them was never written down. It
-- is written down now so the migration history matches prisma/schema.prisma.
-- Every column is IF NOT EXISTS, so a database that already has them (which
-- every deployed one does) is untouched.

ALTER TABLE "posts"."Post"
    ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS "backgroundFit" TEXT NOT NULL DEFAULT 'cover',
    ADD COLUMN IF NOT EXISTS "backgroundImage" TEXT,
    ADD COLUMN IF NOT EXISTS "backgroundPattern" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "posts"."PostDraft"
    ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS "backgroundFit" TEXT NOT NULL DEFAULT 'cover',
    ADD COLUMN IF NOT EXISTS "backgroundImage" TEXT,
    ADD COLUMN IF NOT EXISTS "backgroundPattern" TEXT NOT NULL DEFAULT 'none';
