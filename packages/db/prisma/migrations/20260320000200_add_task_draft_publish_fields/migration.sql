-- AlterTable
ALTER TABLE "tasks"
  ADD COLUMN "source_text" TEXT,
  ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "published_at" TIMESTAMPTZ;

-- Backfill
UPDATE "tasks"
SET "published_at" = "created_at"
WHERE "is_published" = true
  AND "published_at" IS NULL;
