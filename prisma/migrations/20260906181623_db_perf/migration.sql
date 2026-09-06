-- 1.1 New GIN indexes on scalar list columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Post_tags_gin"      ON posts."Post"  USING GIN (tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_interests_gin" ON users."User"  USING GIN (interests);

-- 1.1 Hot-path FK and orderBy columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserNotifications_userId_idx"    ON users."UserNotifications" ("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserNotifications_createdAt_idx" ON users."UserNotifications" ("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PostComment_reply_idx"           ON posts."PostComment"       ("postCommentReplyId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PostComment_post_created_idx"    ON posts."PostComment"       ("postId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PostReaction_post_created_idx"   ON posts."PostReaction"      ("postId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TagsRanking_createdAt_idx"       ON tags."TagsRanking"        ("createdAt" DESC);

-- 1.2 Generated tsvector column on Post + GIN
ALTER TABLE posts."Post" ADD COLUMN IF NOT EXISTS search_doc tsvector
  GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title,       '')), 'A')
     || setweight(to_tsvector('english', coalesce(description, '')), 'B')
     || setweight(to_tsvector('english', coalesce(author,      '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "Post_search_doc_gin" ON posts."Post" USING GIN (search_doc);

-- 1.3 EmailVerificationCode.key unique
ALTER TABLE verification."EmailVerificationCode"
  ADD CONSTRAINT "EmailVerificationCode_key_key" UNIQUE (key);

-- 1.3 EmailVerificationCode.userId unique (required by T8 verifyEmail delete-by-userId)
ALTER TABLE verification."EmailVerificationCode"
  ADD CONSTRAINT "EmailVerificationCode_userId_key" UNIQUE ("userId");

-- 1.4 Drop useless User uniques
ALTER TABLE users."User" DROP CONSTRAINT IF EXISTS "User_id_name_image_key";
ALTER TABLE users."User" DROP CONSTRAINT IF EXISTS "User_id_name_username_image_key";

-- 1.5 Drop unused btree indexes on Post / PostSeries
DROP INDEX IF EXISTS posts."Post_author_title_description_idx";
DROP INDEX IF EXISTS posts."PostSeries_title_description_idx";

-- 1.6 Composite FKs → plain userId FKs (denormalized columns stay as plain text)
ALTER TABLE posts."Post"           DROP CONSTRAINT IF EXISTS "Post_userId_author_authorImage_fkey";
ALTER TABLE posts."PostComment"     DROP CONSTRAINT IF EXISTS "PostComment_userId_userName_userUsername_userImage_fkey";
ALTER TABLE posts."CommentReaction" DROP CONSTRAINT IF EXISTS "CommentReaction_userId_userName_userImage_fkey";
ALTER TABLE posts."PostReaction"    DROP CONSTRAINT IF EXISTS "PostReaction_userId_userName_userImage_fkey";

ALTER TABLE posts."Post"           ADD CONSTRAINT "Post_userId_fkey"           FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;
ALTER TABLE posts."PostComment"     ADD CONSTRAINT "PostComment_userId_fkey"     FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;
ALTER TABLE posts."CommentReaction" ADD CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;
ALTER TABLE posts."PostReaction"    ADD CONSTRAINT "PostReaction_userId_fkey"    FOREIGN KEY ("userId") REFERENCES users."User"(id) ON DELETE CASCADE;