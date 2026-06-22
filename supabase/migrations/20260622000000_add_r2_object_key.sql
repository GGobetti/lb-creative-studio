-- Fase 1A — Migração de entrega para Cloudflare R2
-- Armazena a chave do objeto STL no bucket R2. NULL = arquivo ainda no Telegram Vault (legado).
-- O download do studio gera uma presigned URL a partir desta chave (ver api/telegram/download).

ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS r2_object_key text;

COMMENT ON COLUMN public.telegram_indexed_stls.r2_object_key IS
  'Chave do objeto no bucket Cloudflare R2 (ex.: stl/<file_hash>.stl). NULL = legado no Telegram Vault.';
