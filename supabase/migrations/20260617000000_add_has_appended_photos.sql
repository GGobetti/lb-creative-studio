-- Migration: add has_appended_photos column to telegram_indexed_stls
ALTER TABLE "public"."telegram_indexed_stls"
ADD COLUMN IF NOT EXISTS "has_appended_photos" boolean DEFAULT false;

-- Create an index to optimize filtering in the admin panel
CREATE INDEX IF NOT EXISTS "idx_telegram_indexed_stls_has_appended_photos" ON "public"."telegram_indexed_stls" ("has_appended_photos") WHERE "has_appended_photos" = true;
