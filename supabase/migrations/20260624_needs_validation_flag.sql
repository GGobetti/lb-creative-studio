-- Migration: add needs_validation flag to telegram_indexed_stls
-- Allows admins to hide STLs from public search pending review

ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS needs_validation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS telegram_indexed_stls_needs_validation_idx
  ON public.telegram_indexed_stls(needs_validation)
  WHERE needs_validation = true;
