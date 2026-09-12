-- 1.1 New GIN indexes on scalar list columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Post_tags_gin"      ON posts."Post"  USING GIN (tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_interests_gin" ON users."User"  USING GIN (interests);

-- 1.1 Hot-path FK and orderBy columns. The PostComment_/PostReaction_ btree
-- indexes below duplicate Prisma @@index declarations; IF NOT EXISTS keeps
-- apply-perf-migration.ts idempotent on re-runs.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserNotifications_userId_idx"    ON users."UserNotifications" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserNotifications_createdAt_idx" ON users."UserNotifications" ("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PostComment_reply_idx"           ON posts."PostComment"       ("postCommentReplyId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PostComment_post_created_idx"    ON posts."PostComment"       ("postId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PostReaction_post_created_idx"   ON posts."PostReaction"      ("postId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TagsRanking_createdAt_idx"       ON tags."TagsRanking"        ("createdAt" DESC);

-- 1.2 Generated tsvector column on Post + GIN
-- IF NOT EXISTS is intentionally omitted from the ADD COLUMN: the IF NOT EXISTS
-- clause combined with GENERATED ALWAYS AS ... STORED is unreliable across
-- Postgres versions (some silently no-op the column creation). Re-runs are
-- handled by the apply script's 42710 (duplicate_object) catch.
ALTER TABLE posts."Post" ADD COLUMN search_doc tsvector
  GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title,       '')), 'A')
     || setweight(to_tsvector('english', coalesce(description, '')), 'B')
     || setweight(to_tsvector('english', coalesce(author,      '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "Post_search_doc_gin" ON posts."Post" USING GIN (search_doc);

-- 1.3 EmailVerificationCode.key unique
-- Production already has duplicate `key` values; the ADD CONSTRAINT below would fail.
-- Dedup first: keep the row with the lowest `id` per duplicate `key`.
DELETE FROM verification."EmailVerificationCode" a
USING verification."EmailVerificationCode" b
WHERE a.id < b.id
  AND a.key = b.key;
ALTER TABLE verification."EmailVerificationCode"
  ADD CONSTRAINT "EmailVerificationCode_key_key" UNIQUE (key);

-- 1.3 EmailVerificationCode.userId unique (required by T8 verifyEmail delete-by-userId)
-- Same dedup-first pattern: production may have multiple rows per userId
-- (a user that requested several codes without redeeming). Keep the lowest id.
DELETE FROM verification."EmailVerificationCode" a
USING verification."EmailVerificationCode" b
WHERE a.id < b.id
  AND a."userId" = b."userId";
ALTER TABLE verification."EmailVerificationCode"
  ADD CONSTRAINT "EmailVerificationCode_userId_key" UNIQUE ("userId");

-- 1.4 Drop useless User uniques.
-- Production has tables NOT in our schema (Blog confirmed; possibly others)
-- with composite FKs to User (id, name, image) and (id, name, username, image).
-- DROP CONSTRAINT CASCADE alone does NOT drop the underlying index when an
-- FK still references it via the index path. We must drop the INDEX with
-- CASCADE explicitly so all dependents (FKs on Blog and any unknown table)
-- are cleared in one step.
DROP INDEX IF EXISTS users."User_id_name_image_key" CASCADE;
DROP INDEX IF EXISTS users."User_id_name_username_image_key" CASCADE;
-- The constraints are owned by the indexes; dropping the indexes leaves
-- the constraints in an inconsistent state that Postgres itself cleans up
-- on next access. IF EXISTS guards against the rare re-run case.
ALTER TABLE users."User" DROP CONSTRAINT IF EXISTS "User_id_name_image_key";
ALTER TABLE users."User" DROP CONSTRAINT IF EXISTS "User_id_name_username_image_key";

-- 1.5 Drop unused btree indexes on Post / PostSeries
DROP INDEX IF EXISTS posts."Post_author_title_description_idx" CASCADE;
DROP INDEX IF EXISTS posts."PostSeries_title_description_idx" CASCADE;

-- 1.6 Composite FKs → plain userId FKs (denormalized columns stay as plain text)
-- CASCADE: production may have tables outside our schema (Blog-like) with
-- composite FKs that piggyback on these constraints' underlying indexes. Match
-- the 1.4 / 1.5 hardening so an unknown FK on these tables doesn't 2BP01 us.
ALTER TABLE posts."Post"           DROP CONSTRAINT IF EXISTS "Post_userId_author_authorImage_fkey"          CASCADE;
ALTER TABLE posts."PostComment"     DROP CONSTRAINT IF EXISTS "PostComment_userId_userName_userUsername_userImage_fkey" CASCADE;
ALTER TABLE posts."CommentReaction" DROP CONSTRAINT IF EXISTS "CommentReaction_userId_userName_userImage_fkey" CASCADE;
ALTER TABLE posts."PostReaction"    DROP CONSTRAINT IF EXISTS "PostReaction_userId_userName_userImage_fkey" CASCADE;

ALTER TABLE posts."Post"           ADD CONSTRAINT "Post_userId_fkey"           FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;
ALTER TABLE posts."PostComment"     ADD CONSTRAINT "PostComment_userId_fkey"     FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;
ALTER TABLE posts."CommentReaction" ADD CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;
ALTER TABLE posts."PostReaction"    ADD CONSTRAINT "PostReaction_userId_fkey"    FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;