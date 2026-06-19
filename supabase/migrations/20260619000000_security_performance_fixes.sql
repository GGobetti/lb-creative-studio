-- ================================================================
-- LB Creative Studio — Security & Performance Fixes (jun/2026)
-- C2, C4, C6, D2, D3, D4, D5, D6, D8
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- C2: Idempotência no webhook — UNIQUE em transactions.payment_intent_id
-- ────────────────────────────────────────────────────────────────
alter table public.transactions
  add column if not exists payment_intent_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_payment_intent_unique'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_payment_intent_unique
      unique (payment_intent_id);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────
-- C4: Reativar RLS em telegram_scraper_jobs (desabilitado por fix rápido)
-- As políticas is_admin() já existiam — só reativar o controle
-- ────────────────────────────────────────────────────────────────
alter table public.telegram_scraper_jobs enable row level security;

-- ────────────────────────────────────────────────────────────────
-- D5: Índice composto em transactions para queries de histórico
-- ────────────────────────────────────────────────────────────────
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────
-- D8: stripe_customer_id em profiles — necessário para invoice.paid
-- ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- ────────────────────────────────────────────────────────────────
-- D8: RPC increment_credits_for_user — atomic, sem read-modify-write
-- ────────────────────────────────────────────────────────────────
create or replace function public.increment_credits_for_user(uid uuid, p_amount int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set credits = credits + p_amount
  where id = uid;
$$;

-- ────────────────────────────────────────────────────────────────
-- D4: RPC increment_download_count — atomic
-- ────────────────────────────────────────────────────────────────
create or replace function public.increment_download_count(stl_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.telegram_indexed_stls
  set download_count = download_count + 1
  where id = stl_id;
$$;

-- ────────────────────────────────────────────────────────────────
-- D3: Fix race condition em record_game_action
-- Usar FOR UPDATE para serializar atualizações concorrentes por usuário
-- ────────────────────────────────────────────────────────────────
create or replace function public.record_game_action(
  p_user_id uuid,
  p_game_type text
)
returns table (credits_earned int, can_continue boolean, actions_remaining int, credits_remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity record;
  v_limits record;
  v_config record;
  v_new_actions int;
  v_new_credits int;
  v_credits_earned int := 0;
begin
  -- Get global limits
  select max_actions_per_day, max_credits_per_day
  into v_limits
  from public.game_daily_limits
  limit 1;

  if v_limits is null then
    v_limits := row(100, 500);
  end if;

  -- Ensure row exists before trying to lock it
  insert into public.game_daily_activity (user_id, activity_date, total_actions, total_credits_earned)
  values (p_user_id, current_date, 0, 0)
  on conflict (user_id, activity_date) do nothing;

  -- Lock the row to serialize concurrent calls for the same user+date
  select coalesce(total_actions, 0) as total_actions, coalesce(total_credits_earned, 0) as total_credits
  into v_activity
  from public.game_daily_activity
  where user_id = p_user_id and activity_date = current_date
  for update;

  -- Check limits before increment
  if v_activity.total_actions >= v_limits.max_actions_per_day then
    return query select 0, false, 0, 0;
    return;
  end if;

  -- Get reward config for this game
  select actions_per_reward, credits_per_reward
  into v_config
  from public.game_rewards_config
  where game_type = p_game_type;

  if v_config is null then
    v_config := row(10, 50);
  end if;

  -- Calculate new totals
  v_new_actions := v_activity.total_actions + 1;

  if v_new_actions % v_config.actions_per_reward = 0 then
    v_credits_earned := v_config.credits_per_reward;
    v_new_credits := v_activity.total_credits + v_credits_earned;
  else
    v_new_credits := v_activity.total_credits;
  end if;

  -- Cap at daily credit limit
  if v_new_credits > v_limits.max_credits_per_day then
    v_credits_earned := v_limits.max_credits_per_day - v_activity.total_credits;
    v_new_credits := v_limits.max_credits_per_day;
  end if;

  -- Atomic update (row already locked by FOR UPDATE above)
  update public.game_daily_activity
  set
    total_actions = v_new_actions,
    total_credits_earned = v_new_credits,
    updated_at = now()
  where user_id = p_user_id and activity_date = current_date;

  -- Atomic credit increment in profiles
  if v_credits_earned > 0 then
    update public.profiles
    set credits = credits + v_credits_earned
    where id = p_user_id;
  end if;

  return query select
    v_credits_earned,
    v_new_actions < v_limits.max_actions_per_day,
    v_limits.max_actions_per_day - v_new_actions,
    v_limits.max_credits_per_day - v_new_credits;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- D2: Full-Text Search — coluna tsv + índice GIN em telegram_indexed_stls
-- ────────────────────────────────────────────────────────────────
alter table public.telegram_indexed_stls
  add column if not exists tsv tsvector
  generated always as (
    to_tsvector('portuguese',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) stored;

create index if not exists telegram_indexed_stls_tsv_idx
  on public.telegram_indexed_stls using gin(tsv);

-- Índice adicional para filtro parent_id (D1: paginação)
create index if not exists telegram_indexed_stls_parent_id_idx
  on public.telegram_indexed_stls (parent_id);
