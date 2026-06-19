-- ============================================================
-- Migração: Busca e Indexação de STL via Telegram
-- Criação da tabela telegram_indexed_stls
-- ============================================================

create table if not exists public.telegram_indexed_stls (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  thumbnail_url       text,
  telegram_group_id   text not null,
  telegram_group_name text not null,
  telegram_message_id int8 not null,
  file_name           text not null,
  file_size_bytes     int8 not null,
  tags                text[] not null default '{}',
  created_at          timestamptz not null default now()
);

-- Ativar Row Level Security
alter table public.telegram_indexed_stls enable row level security;

-- Limpar políticas anteriores se existirem
drop policy if exists "telegram_indexed_stls: read authenticated" on public.telegram_indexed_stls;
drop policy if exists "telegram_indexed_stls: admin all" on public.telegram_indexed_stls;

-- Política de leitura: qualquer usuário autenticado pode pesquisar
create policy "telegram_indexed_stls: read authenticated"
  on public.telegram_indexed_stls for select
  to authenticated
  using (true);

-- Política de escrita: apenas administradores (sysadmin)
create policy "telegram_indexed_stls: admin all"
  on public.telegram_indexed_stls for all
  using (public.is_admin());

-- Índices para otimizar a busca por título e tags
create index if not exists telegram_indexed_stls_title_idx on public.telegram_indexed_stls (title);
create index if not exists telegram_indexed_stls_tags_idx on public.telegram_indexed_stls using gin (tags);
