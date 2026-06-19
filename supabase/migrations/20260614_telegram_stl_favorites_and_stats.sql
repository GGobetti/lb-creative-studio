-- ============================================================
-- Migração: Favoritos e Estatísticas de Download de STLs do Telegram
-- Adiciona colunas extras e cria tabela de favoritos
-- ============================================================

-- 1. Atualizar tabela telegram_indexed_stls
alter table public.telegram_indexed_stls 
  add column if not exists photos text[] not null default '{}',
  add column if not exists download_count int not null default 0;

-- 2. Criar tabela telegram_user_favorites
create table if not exists public.telegram_user_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  stl_id     uuid not null references public.telegram_indexed_stls(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, stl_id)
);

-- Ativar RLS
alter table public.telegram_user_favorites enable row level security;

-- Limpar políticas anteriores se existirem
drop policy if exists "telegram_user_favorites: own select" on public.telegram_user_favorites;
drop policy if exists "telegram_user_favorites: own insert" on public.telegram_user_favorites;
drop policy if exists "telegram_user_favorites: own delete" on public.telegram_user_favorites;

-- Políticas
create policy "telegram_user_favorites: own select"
  on public.telegram_user_favorites for select
  using (auth.uid() = user_id);

create policy "telegram_user_favorites: own insert"
  on public.telegram_user_favorites for insert
  with check (auth.uid() = user_id);

create policy "telegram_user_favorites: own delete"
  on public.telegram_user_favorites for delete
  using (auth.uid() = user_id);

-- Índice para otimizar queries de favoritos por usuário
create index if not exists telegram_user_favorites_user_idx on public.telegram_user_favorites(user_id);
