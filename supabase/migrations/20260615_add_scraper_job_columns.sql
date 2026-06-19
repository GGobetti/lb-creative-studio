-- ============================================================
-- Migração: Adicionar Colunas para Aprovação de Jobs no Scraper
-- ============================================================

-- Adicionar colunas necessárias na tabela telegram_scraper_jobs
alter table public.telegram_scraper_jobs
  add column if not exists telegram_message_id bigint,
  add column if not exists telegram_group_id text,
  add column if not exists photos text[] default '{}';

-- Atualizar descrição dos status possíveis comentados
comment on column public.telegram_scraper_jobs.status is 'pending, pending_approval, downloading_file, uploading_vault, indexing, completed, failed, rejected';
