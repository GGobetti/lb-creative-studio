-- ============================================================
-- Migração: Sistema de Feature Flags Dinâmico
-- Criado em: 15 de Junho de 2026
-- ============================================================

-- 1. Criar tabela de feature_flags
create table if not exists public.feature_flags (
  key          text        primary key,
  display_name text        not null,
  is_enabled   boolean     not null default true,
  updated_at   timestamptz not null default now()
);

-- Habilitar RLS
alter table public.feature_flags enable row level security;

-- Políticas de RLS
create policy "feature_flags: select authenticated"
  on public.feature_flags for select
  to authenticated
  using (true);

create policy "feature_flags: admin all"
  on public.feature_flags for all
  using (public.is_admin());

-- Seed inicial de flags
insert into public.feature_flags (key, display_name, is_enabled) values
('parametric_generator', 'Gerador Paramétrico (Catálogo e Editor 3D)', true),
('telegram_stl_search', 'Busca de STLs (Telegram)', true),
('pricing_calculator', 'Calculadora de Precificação', true),
('crm_customers', 'CRM de Clientes', true),
('quotations', 'Módulo de Cotações', true),
('maker_hub', 'Hub Maker (Tutoriais/Recursos)', true),
('support_tickets', 'Suporte / Chamados', true)
on conflict (key) do update set
  display_name = excluded.display_name;
