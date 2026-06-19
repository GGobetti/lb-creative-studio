-- ============================================================
-- Migração: Monitoramento de Processamento do Scraper
-- Criação da tabela telegram_scraper_jobs
-- ============================================================

create table if not exists public.telegram_scraper_jobs (
  id                  uuid primary key default gen_random_uuid(),
  file_name           text not null,
  chat_title          text not null,
  status              text not null default 'pending', -- 'pending', 'downloading_file', 'uploading_vault', 'indexing', 'completed', 'failed'
  error_message       text,
  file_size_bytes     int8,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Ativar Row Level Security
alter table public.telegram_scraper_jobs enable row level security;

-- Limpar políticas anteriores se existirem
drop policy if exists "telegram_scraper_jobs: admin all" on public.telegram_scraper_jobs;

-- Política de acesso total apenas para administradores (sysadmin)
create policy "telegram_scraper_jobs: admin all"
  on public.telegram_scraper_jobs for all
  to authenticated
  using (public.is_admin());
