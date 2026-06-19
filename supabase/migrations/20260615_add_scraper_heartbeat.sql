-- ============================================================
-- Migração: Adicionar Coluna de Heartbeat para o Scraper
-- ============================================================

alter table public.telegram_scraper_settings
  add column if not exists last_heartbeat timestamptz default now();
