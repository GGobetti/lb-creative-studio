-- ============================================================
-- Migração: Ajustes de Perfil e Histórico de Downloads
-- Adiciona colunas extras ao perfil e cria tabela de logs de downloads
-- ============================================================

-- 1. Atualizar a tabela profiles com os novos campos
alter table public.profiles 
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists address text,
  add column if not exists language text default 'pt' check (language in ('pt', 'en'));

-- 2. Criar a tabela de histórico de downloads de STL
create table if not exists public.telegram_downloads_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  stl_id        uuid not null references public.telegram_indexed_stls(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

-- 3. Habilitar RLS na tabela de downloads
alter table public.telegram_downloads_history enable row level security;

-- 4. Criar políticas de acesso
drop policy if exists "telegram_downloads_history: own select" on public.telegram_downloads_history;
drop policy if exists "telegram_downloads_history: own insert" on public.telegram_downloads_history;
drop policy if exists "telegram_downloads_history: admin all" on public.telegram_downloads_history;

create policy "telegram_downloads_history: own select"
  on public.telegram_downloads_history for select
  using (auth.uid() = user_id);

create policy "telegram_downloads_history: own insert"
  on public.telegram_downloads_history for insert
  with check (auth.uid() = user_id);

create policy "telegram_downloads_history: admin all"
  on public.telegram_downloads_history for all
  using (public.is_admin());

-- 5. Criar índices para otimização de performance
create index if not exists telegram_downloads_history_user_idx on public.telegram_downloads_history(user_id);
create index if not exists telegram_downloads_history_stl_idx on public.telegram_downloads_history(stl_id);
