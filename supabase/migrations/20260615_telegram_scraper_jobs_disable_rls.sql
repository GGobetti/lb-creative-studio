-- ============================================================
-- Migração: Desativar RLS na tabela telegram_scraper_jobs
-- Para resolver o problema de carregamento de registros no frontend
-- ============================================================

alter table public.telegram_scraper_jobs disable row level security;
