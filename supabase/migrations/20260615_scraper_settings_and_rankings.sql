-- ============================================================
-- Migração: Configurações do Scraper, favorites_count e Triggers
-- Criação de telegram_scraper_settings e sincronização de favoritos
-- ============================================================

-- 1. Criar tabela telegram_scraper_settings se não existir
create table if not exists public.telegram_scraper_settings (
  id              text primary key default 'default',
  target_groups   text[] not null default '{}',
  size_limit_mb   int not null default 750,
  updated_at      timestamptz not null default now()
);

-- Ativar RLS
alter table public.telegram_scraper_settings enable row level security;

-- Políticas
drop policy if exists "telegram_scraper_settings: admin all" on public.telegram_scraper_settings;
create policy "telegram_scraper_settings: admin all"
  on public.telegram_scraper_settings for all
  to authenticated
  using (public.is_admin());

-- Seed inicial de grupos e limite
insert into public.telegram_scraper_settings (id, target_groups, size_limit_mb)
values (
  'default',
  array[
    'LB Creative STls',
    '-1002436118005',
    'STL3DBrasilFree',
    'impressoresbrasil',
    '-1002718125777',
    '3D E STL SEM FREXCURA',
    'PokemonSTL',
    '-1001451642652',
    'Pokemon STL',
    'STLPrintingBR',
    '-1002761479154',
    'STL 3D Printing BR',
    'avante3d',
    '-1003744167247',
    'Avante3D STL''s'
  ],
  750
)
on conflict (id) do nothing;

-- 2. Adicionar coluna favorites_count na tabela telegram_indexed_stls se não existir
alter table public.telegram_indexed_stls
  add column if not exists favorites_count int not null default 0;

-- Sincronizar dados existentes
update public.telegram_indexed_stls s
set favorites_count = (
  select count(*)
  from public.telegram_user_favorites f
  where f.stl_id = s.id
);

-- 3. Trigger para manter favorites_count atualizado
create or replace function public.update_stl_favorites_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.telegram_indexed_stls
    set favorites_count = favorites_count + 1
    where id = new.stl_id;
  elsif tg_op = 'DELETE' then
    update public.telegram_indexed_stls
    set favorites_count = greatest(0, favorites_count - 1)
    where id = old.stl_id;
  end if;
  return null;
end;
$$;

drop trigger if exists tr_update_stl_favorites_count on public.telegram_user_favorites;
create trigger tr_update_stl_favorites_count
after insert or delete on public.telegram_user_favorites
for each row execute function public.update_stl_favorites_count();
