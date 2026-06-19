-- ============================================================
-- Migração: Adicionar suporte a Categorias de Impressora (Resina/FDM)
-- Adiciona a coluna printer_type e nova estrutura jsonb para grupos
-- ============================================================

-- 1. Adicionar printer_type nas tabelas de arquivos e jobs
alter table public.telegram_indexed_stls
add column if not exists printer_type text default null;

alter table public.telegram_scraper_jobs
add column if not exists printer_type text default null;

-- 2. Adicionar a nova estrutura de grupos
alter table public.telegram_scraper_settings
add column if not exists groups_config jsonb default '[]'::jsonb;

-- 3. Migrar dados antigos (target_groups) para a nova estrutura jsonb (groups_config)
-- Define todos os grupos antigos como 'fdm' por padrão, conforme solicitado
update public.telegram_scraper_settings
set groups_config = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', g,
        'type', 'fdm'
      )
    )
    from unnest(target_groups) as g
  ), 
  '[]'::jsonb
);
