-- ============================================================
-- LB Creative Studio — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. PROFILES
-- Auto-created for every new auth.users row via trigger below
-- ----------------------------------------------------------------
create table public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  email     text        not null,
  role      text        not null default 'user' check (role in ('user', 'sysadmin')),
  plan      text        not null default 'free' check (plan in ('free', 'basic', 'pro')),
  credits   int         not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 1.1 Helper for RLS: Check if user is admin without recursion
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'sysadmin'
  );
end;
$$;

-- Each user can read/update their own row
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = 'user'); -- users cannot self-promote to admin

-- Admins can do everything
create policy "profiles: admin all"
  on public.profiles for all
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 2. CATALOG ITEMS  (admin-managed product library)
-- params_schema example:
-- {
--   "sliders": [{"key":"depth","label":"Profundidade","min":1,"max":20,"default":5,"unit":"mm"}],
--   "text_inputs": [{"key":"line1","label":"Linha 1","maxLength":30}]
-- }
-- ----------------------------------------------------------------
create table public.catalog_items (
  id               uuid        primary key default gen_random_uuid(),
  title            text        not null,
  description      text,
  type             text        not null check (type in ('hybrid_parametric', 'image_to_3d')),
  thumbnail_url    text,
  base_glb_url     text,                        -- null for image_to_3d items (for now)
  params_schema    jsonb       not null default '{}',
  price_in_credits int         not null default 1 check (price_in_credits >= 0),
  price_free       int         not null default 2 check (price_free >= 0),
  price_basic      int         not null default 1 check (price_basic >= 0),
  price_pro        int         not null default 1 check (price_pro >= 0),
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now()
);

alter table public.catalog_items enable row level security;

create policy "catalog_items: public read active"
  on public.catalog_items for select
  using (is_active = true);

create policy "catalog_items: admin all"
  on public.catalog_items for all
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 3. SAVED PROJECTS  (user's personalization states)
-- config_state example:
-- {"textInput":"LB Studio","scale":1.2,"depth":5,"color":"#ffffff","preset":null}
-- ----------------------------------------------------------------
create table public.saved_projects (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  item_id     uuid        references public.catalog_items(id) on delete set null,
  name        text        not null default 'Sem título',
  config_state jsonb      not null default '{}',
  thumbnail_url text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_projects enable row level security;

create policy "saved_projects: own all"
  on public.saved_projects for all
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 4. TRANSACTIONS  (append-only ledger)
-- credits_added can be negative (exports) or positive (purchases)
-- ----------------------------------------------------------------
create table public.transactions (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  payment_intent_id text,
  credits_added     int         not null,  -- negative = deduction, positive = purchase
  description       text,
  item_id           uuid        references public.catalog_items(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions: own read"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions: admin all"
  on public.transactions for all
  using (public.is_admin());

-- Inserts handled exclusively by Edge Functions (service role) — no user insert policy

-- ----------------------------------------------------------------
-- TRIGGER: auto-create profile on new user signup
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------
-- SEED: Default catalog items for local dev / demo
-- ----------------------------------------------------------------
insert into public.catalog_items (title, description, type, params_schema, price_in_credits, price_free, price_basic, price_pro) values
(
  'Placa Personalizada',
  'Base paramétrica com texto 3D fundido via CSG. Ideal para placas, troféus e etiquetas.',
  'hybrid_parametric',
  '{
    "sliders": [
      {"key": "baseWidth",  "label": "Largura da Base (mm)", "min": 50,  "max": 300, "default": 120, "unit": "mm"},
      {"key": "baseHeight", "label": "Altura da Base (mm)",  "min": 5,   "max": 30,  "default": 10,  "unit": "mm"},
      {"key": "textDepth",  "label": "Profundidade do Texto","min": 1,   "max": 10,  "default": 3,   "unit": "mm"},
      {"key": "textScale",  "label": "Escala do Texto",      "min": 0.5, "max": 3,   "default": 1,   "unit": "x", "step": 0.1}
    ],
    "text_inputs": [
      {"key": "line1", "label": "Texto Principal", "maxLength": 24, "placeholder": "LB Creative"},
      {"key": "line2", "label": "Subtítulo (opcional)", "maxLength": 32, "placeholder": "Studio"}
    ]
  }',
  2, 2, 1, 1
),
(
  'Cortador de Biscoito',
  'Faça upload de uma imagem e gere automaticamente um cortador FDM-ready com lâmina e flange.',
  'image_to_3d',
  '{
    "sliders": [
      {"key": "bladeHeight",  "label": "Altura da Lâmina (mm)", "min": 10, "max": 40,  "default": 15, "unit": "mm"},
      {"key": "bladeWall",    "label": "Espessura da Parede",    "min": 0.8,"max": 3,   "default": 1.2,"unit": "mm", "step": 0.1},
      {"key": "flangeOffset", "label": "Offset da Flange (mm)", "min": 2,  "max": 8,   "default": 4,  "unit": "mm"},
      {"key": "flangeHeight", "label": "Altura da Flange (mm)", "min": 2,  "max": 6,   "default": 3,  "unit": "mm"}
    ],
    "text_inputs": []
  }',
  3, 4, 2, 1
),
(
  'Chaveiro',
  'Converta sua imagem em um chaveiro com argola integrada, pronto para imprimir.',
  'image_to_3d',
  '{
    "sliders": [
      {"key": "bodyDepth",  "label": "Espessura do Corpo (mm)", "min": 2,  "max": 8,   "default": 3, "unit": "mm"},
      {"key": "bodyScale",  "label": "Tamanho (mm)",            "min": 20, "max": 80,  "default": 40,"unit": "mm"},
      {"key": "ringRadius", "label": "Raio da Argola (mm)",     "min": 3,  "max": 8,   "default": 5, "unit": "mm"}
    ],
    "text_inputs": []
  }',
  2, 2, 1, 1
);

-- ----------------------------------------------------------------
-- 5. STORAGE BUCKETS (Avatars)
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up storage policies
create policy "Avatar images are publicly accessible." 
on storage.objects for select 
using (bucket_id = 'avatars');

create policy "Users can upload their own avatars." 
on storage.objects for insert 
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatars." 
on storage.objects for update 
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------
-- 6. USER PRICING SETTINGS (Globais)
-- ----------------------------------------------------------------
create table public.user_pricing_settings (
  user_id                uuid        primary key references public.profiles(id) on delete cascade,
  filament_cost_per_kg   numeric     not null default 150.00,
  energy_cost_per_kwh    numeric     not null default 0.90,
  printer_power_w        numeric     not null default 300,
  profit_margin_percent  numeric     not null default 100,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.user_pricing_settings enable row level security;

create policy "user_pricing_settings: own all"
  on public.user_pricing_settings for all
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. PORTFOLIO ITEMS (Modelos para venda/precificação)
-- ----------------------------------------------------------------
create table public.portfolio_items (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  title            text        not null,
  description      text,
  thumbnail_url    text,
  source_type      text        not null check (source_type in ('generated_lb', 'makerworld', 'manual')),
  external_url     text,
  weight_g         numeric     default 0,
  print_time_hours numeric     default 0,
  calculated_price numeric     default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.portfolio_items enable row level security;

create policy "portfolio_items: own all"
  on public.portfolio_items for all
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 8. FEATURE COSTS (Preços das Funcionalidades por Plano)
-- ----------------------------------------------------------------
create table public.feature_costs (
  feature_key  text        primary key,
  display_name text        not null,
  cost_free    int         not null default 0 check (cost_free >= 0),
  cost_basic   int         not null default 0 check (cost_basic >= 0),
  cost_pro     int         not null default 0 check (cost_pro >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.feature_costs enable row level security;

create policy "feature_costs: read all"
  on public.feature_costs for select
  to authenticated
  using (true);

create policy "feature_costs: admin all"
  on public.feature_costs for all
  using (public.is_admin());

-- Seed default costs
insert into public.feature_costs (feature_key, display_name, cost_free, cost_basic, cost_pro) values
('import_makerworld', 'Importar do MakerWorld', 2, 1, 0),
('telegram_search', 'Busca e Download no Telegram', 1, 0, 0)
on conflict (feature_key) do nothing;

-- ----------------------------------------------------------------
-- 9. FEATURE FLAGS (Flags de recursos ativos/inativos)
-- ----------------------------------------------------------------
create table public.feature_flags (
  key          text        primary key,
  display_name text        not null,
  is_enabled   boolean     not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

create policy "feature_flags: read all"
  on public.feature_flags for select
  to authenticated
  using (true);

create policy "feature_flags: admin all"
  on public.feature_flags for all
  using (public.is_admin());

-- Seed default flags
insert into public.feature_flags (key, display_name, is_enabled) values
('telegram_stl_search', 'Busca de arquivos STL no Telegram', true),
('pricing_calculator', 'Calculadora de Precificação Completa', true),
('crm_customers', 'Gestão de Clientes (CRM)', true),
('quotations', 'Sistema de Cotações para Clientes', true),
('parametric_generator', 'Gerador Paramétrico de Catálogo', true),
('maker_hub', 'Hub de Aprendizado/Maker', true),
('support_tickets', 'Suporte e Chamados', true)
on conflict (key) do nothing;
