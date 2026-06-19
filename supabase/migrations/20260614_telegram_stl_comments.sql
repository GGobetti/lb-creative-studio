-- ============================================================
-- Migração: Comentários nos Arquivos STL do Telegram
-- Criação da tabela telegram_stl_comments e políticas RLS
-- ============================================================

create table if not exists public.telegram_stl_comments (
  id           uuid primary key default gen_random_uuid(),
  stl_id       uuid not null references public.telegram_indexed_stls(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  comment_text text not null,
  created_at   timestamptz not null default now()
);

-- Habilitar RLS
alter table public.telegram_stl_comments enable row level security;

-- Limpar políticas anteriores se existirem
drop policy if exists "telegram_stl_comments: read authenticated" on public.telegram_stl_comments;
drop policy if exists "telegram_stl_comments: insert own" on public.telegram_stl_comments;
drop policy if exists "telegram_stl_comments: delete own or admin" on public.telegram_stl_comments;

-- Políticas
create policy "telegram_stl_comments: read authenticated"
  on public.telegram_stl_comments for select
  to authenticated
  using (true);

create policy "telegram_stl_comments: insert own"
  on public.telegram_stl_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "telegram_stl_comments: delete own or admin"
  on public.telegram_stl_comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Índices para otimizar queries de comentários por STL
create index if not exists telegram_stl_comments_stl_idx on public.telegram_stl_comments(stl_id);
