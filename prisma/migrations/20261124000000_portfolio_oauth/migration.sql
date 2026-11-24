-- Portfolio + OAuth schema.
--
-- `prisma db push` must never run against this database: it diffs the schema
-- against a database that still holds the legacy blogs."Blog" table and the
-- perf artifacts, and its "fix" is to drop them. So every column and table the
-- Prisma schema declares is applied here instead, additively and idempotently,
-- by scripts/apply-perf-migration.ts on every build.
--
-- Generated with `prisma migrate diff` from the schema as it was before the
-- portfolio and OAuth features, then made re-runnable (IF NOT EXISTS).

CREATE SCHEMA IF NOT EXISTS "oauth";

-- users."User": resume fields + skills (portfolio feature)
ALTER TABLE "users"."User"
    ADD COLUMN IF NOT EXISTS "resumePublic" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "resumePublicId" TEXT,
    ADD COLUMN IF NOT EXISTS "resumeUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "skills" TEXT[];

CREATE TABLE IF NOT EXISTS "oauth"."OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" JSONB NOT NULL,
    "scopes" TEXT[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "oauth"."OAuthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "oauth"."OAuthRefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users"."PortfolioShowcase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "layout" TEXT NOT NULL DEFAULT 'grid',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioShowcase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users"."PortfolioItem" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "gallery" TEXT[],
    "link" TEXT,
    "tags" TEXT[],
    "date" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "users"."UserExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'work',
    "org" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExperience_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OAuthClient_clientId_key" ON "oauth"."OAuthClient"("clientId");

CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAuthorizationCode_codeHash_key" ON "oauth"."OAuthAuthorizationCode"("codeHash");

CREATE UNIQUE INDEX IF NOT EXISTS "OAuthRefreshToken_tokenHash_key" ON "oauth"."OAuthRefreshToken"("tokenHash");

CREATE INDEX IF NOT EXISTS "PortfolioShowcase_userId_idx" ON "users"."PortfolioShowcase"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioShowcase_userId_slug_key" ON "users"."PortfolioShowcase"("userId", "slug");

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioItem_showcaseId_slug_key" ON "users"."PortfolioItem"("showcaseId", "slug");

CREATE INDEX IF NOT EXISTS "UserExperience_userId_idx" ON "users"."UserExperience"("userId");

ALTER TABLE "oauth"."OAuthClient" ADD CONSTRAINT "OAuthClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"."PortfolioShowcase" ADD CONSTRAINT "PortfolioShowcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"."PortfolioItem" ADD CONSTRAINT "PortfolioItem_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "users"."PortfolioShowcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"."UserExperience" ADD CONSTRAINT "UserExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
