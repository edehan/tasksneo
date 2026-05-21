ALTER TABLE "users" ADD COLUMN "locale" VARCHAR(16);

UPDATE "users" SET "locale" = 'zh-CN' WHERE "locale" IS NULL;

ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'en';
ALTER TABLE "users" ALTER COLUMN "locale" SET NOT NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_locale_check"
  CHECK ("locale" IN ('en', 'zh-CN', 'fr', 'ja'));
