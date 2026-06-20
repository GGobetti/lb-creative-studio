-- Dynamic pricing plans table — synced from Stripe via webhook

create table public.pricing_plans (
  id bigint primary key generated always as identity,
  name text not null,
  description text,
  credits int not null,
  price_cents int not null,
  stripe_product_id text not null unique,
  stripe_price_id text not null unique,
  active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Initial seed with current Stripe products
insert into public.pricing_plans (name, description, credits, price_cents, stripe_product_id, stripe_price_id, active)
values
  ('Pacote 50 Créditos', '50 créditos avulsos para download de STLs', 50, 1000, 'prod_UjqswCgpPDQAHo', 'price_1TkNAoCPLNDCqX27ashmRWuu', true),
  ('Pacote 200 Créditos', '200 créditos avulsos para download de STLs', 200, 3500, 'prod_UjqsBD8VIthUck', 'price_1TkNApCPLNDCqX27OJefMRXW', true),
  ('Pacote 500 Créditos', '500 créditos avulsos para download de STLs', 500, 8000, 'prod_UjqsRMkdOYy9Fu', 'price_1TkNAqCPLNDCqX27e4gppc3W', true),
  ('Plano Pro', 'Assinatura mensal Pro — 300 créditos/mês', 300, 2990, 'prod_UjqsQk9TXqxkZN', 'price_1TkNArCPLNDCqX27HwghjYPU', true),
  ('Plano Max', 'Assinatura mensal Max — créditos ilimitados', 999, 7990, 'prod_UjqsOrSNhzIIrY', 'price_1TkNArCPLNDCqX27OmpvUGMK', true);

-- Enable RLS
alter table public.pricing_plans enable row level security;

-- Public read access (anyone can see active plans)
create policy "pricing_plans_public_read" on public.pricing_plans
  for select using (true);

-- Admin-only write access
create policy "pricing_plans_admin_write" on public.pricing_plans
  for all using (
    auth.uid() in (
      select id from public.profiles where role = 'sysadmin'
    )
  );
