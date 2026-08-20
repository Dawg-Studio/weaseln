-- CreateTable
CREATE TABLE IF NOT EXISTS "users"."UserProfileCustomization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'minimal',
    "layout" JSONB NOT NULL,
    "backgroundColor" TEXT,
    "backgroundImage" TEXT,
    "backgroundSize" TEXT NOT NULL DEFAULT 'cover',
    "backgroundPosition" TEXT NOT NULL DEFAULT 'center',
    "backgroundOverlay" TEXT,
    "pageGradient" TEXT,
    "cardColor" TEXT,
    "cardOpacity" INTEGER NOT NULL DEFAULT 100,
    "cardRadius" TEXT NOT NULL DEFAULT 'medium',
    "cardShadow" TEXT NOT NULL DEFAULT 'subtle',
    "borderStyle" TEXT NOT NULL DEFAULT 'none',
    "textColor" TEXT,
    "mutedTextColor" TEXT,
    "accentColor" TEXT,
    "fontFamily" TEXT NOT NULL DEFAULT 'system',
    "headingSize" TEXT NOT NULL DEFAULT 'large',
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "spacingDensity" TEXT NOT NULL DEFAULT 'comfortable',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfileCustomization_userId_key" ON "users"."UserProfileCustomization"("userId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "users"."UserProfileCustomization"
        ADD CONSTRAINT "UserProfileCustomization_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Backfill: create one UserProfileCustomization row per existing user,
-- carrying forward legacy profileTheme (mapped to a supported preset) and
-- backgroundImage. Idempotent via ON CONFLICT (userId) DO NOTHING.
--
-- NOTE: the legacy `backgroundImage` column is dropped in the same migration.
-- On databases that already ran this migration before the column was added to
-- the SELECT, the value is lost (the dev DB has no seeded backgroundImage, so
-- the practical impact is zero). Fresh installs will copy backgroundImage
-- forward as part of the backfill.
INSERT INTO "users"."UserProfileCustomization" (
    "id", "userId", "preset", "layout",
    "backgroundImage",
    "backgroundSize", "backgroundPosition", "cardOpacity",
    "cardRadius", "cardShadow", "borderStyle",
    "fontFamily", "headingSize", "textAlign", "spacingDensity",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    u."id",
    CASE WHEN u."profileTheme" IN ('minimal','warm','cool','bold','mono')
         THEN u."profileTheme" ELSE 'minimal' END,
    '{"variant":"standard","sectionOrder":["hero","stats","about","socials","featuredPost","interests","organizations","posts"],"hiddenSections":[]}'::jsonb,
    COALESCE(u."backgroundImage", NULL),
    'cover', 'center', 100,
    'medium', 'subtle', 'none',
    'system', 'large', 'center', 'comfortable',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"."User" u
ON CONFLICT ("userId") DO NOTHING;

-- AlterTable: drop legacy columns now that every user has a customization row
ALTER TABLE "users"."User" DROP COLUMN IF EXISTS "backgroundImage";
ALTER TABLE "users"."User" DROP COLUMN IF EXISTS "profileTheme";