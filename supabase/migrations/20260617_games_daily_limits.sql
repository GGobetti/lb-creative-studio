-- ============================================================
-- Games: Daily Limits & Reward System
-- Created: 2026-06-17
-- ============================================================

-- ----------------------------------------------------------------
-- 1. GAME REWARDS CONFIG (administrador configura)
-- ----------------------------------------------------------------
create table public.game_rewards_config (
  id                uuid        primary key default gen_random_uuid(),
  game_type         text        not null unique check (game_type in ('photo-match', 'tag-detective', 'category-sort', 'quality-audit')),
  actions_per_reward int        not null default 10,  -- a cada X ações, ganha credits_per_reward
  credits_per_reward int        not null default 50,  -- créditos ganhos
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.game_rewards_config enable row level security;

create policy "rewards_config: read all"
  on public.game_rewards_config for select
  to authenticated
  using (true);

create policy "rewards_config: admin all"
  on public.game_rewards_config for all
  using (public.is_admin());

-- Seed default rewards
insert into public.game_rewards_config (game_type, actions_per_reward, credits_per_reward) values
('photo-match',    5,  10),
('tag-detective',  8,  5),
('category-sort',  3,  25),
('quality-audit',  10, 50)
on conflict (game_type) do nothing;

-- ----------------------------------------------------------------
-- 2. GLOBAL DAILY LIMITS (administrador configura)
-- ----------------------------------------------------------------
create table public.game_daily_limits (
  id                      uuid        primary key default gen_random_uuid(),
  max_actions_per_day     int         not null default 100,  -- máximo de ações por usuário por dia
  max_credits_per_day     int         not null default 500,  -- máximo de créditos por usuário por dia
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.game_daily_limits enable row level security;

create policy "daily_limits: read all"
  on public.game_daily_limits for select
  to authenticated
  using (true);

create policy "daily_limits: admin all"
  on public.game_daily_limits for all
  using (public.is_admin());

-- Seed default limits (apenas uma linha com id fixo)
insert into public.game_daily_limits (id, max_actions_per_day, max_credits_per_day)
values ('00000000-0000-0000-0000-000000000000', 100, 500)
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- 3. USER DAILY ACTIVITY TRACKER
-- ----------------------------------------------------------------
create table public.game_daily_activity (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  activity_date     date        not null,  -- YYYY-MM-DD
  total_actions     int         not null default 0,
  total_credits_earned int      not null default 0,
  updated_at        timestamptz not null default now(),
  unique(user_id, activity_date)
);

alter table public.game_daily_activity enable row level security;

create policy "daily_activity: own read"
  on public.game_daily_activity for select
  using (auth.uid() = user_id);

create policy "daily_activity: admin read"
  on public.game_daily_activity for select
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 4. FUNCTION: Check if user can perform action today
-- ----------------------------------------------------------------
create or replace function public.can_perform_game_action(p_user_id uuid)
returns table (can_act boolean, actions_today int, credits_today int, max_actions int, max_credits int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity record;
  v_limits record;
begin
  -- Get today's activity
  select coalesce(total_actions, 0) as total_actions, coalesce(total_credits_earned, 0) as total_credits
  into v_activity
  from public.game_daily_activity
  where user_id = p_user_id and activity_date = current_date;

  if v_activity is null then
    v_activity := (0, 0);
  end if;

  -- Get global limits
  select max_actions_per_day, max_credits_per_day
  into v_limits
  from public.game_daily_limits
  limit 1;

  if v_limits is null then
    v_limits := (100, 500);
  end if;

  return query select
    (v_activity.total_actions < v_limits.max_actions_per_day) as can_act,
    v_activity.total_actions as actions_today,
    v_activity.total_credits as credits_today,
    v_limits.max_actions_per_day as max_actions,
    v_limits.max_credits_per_day as max_credits;
end;
$$;

-- ----------------------------------------------------------------
-- 5. FUNCTION: Record game action and calculate rewards
-- ----------------------------------------------------------------
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
    v_limits := (100, 500);
  end if;

  -- Get today's activity
  select coalesce(total_actions, 0) as total_actions, coalesce(total_credits_earned, 0) as total_credits
  into v_activity
  from public.game_daily_activity
  where user_id = p_user_id and activity_date = current_date;

  if v_activity is null then
    v_activity := (0, 0);
  end if;

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
    v_config := (10, 50); -- default fallback
  end if;

  -- Calculate new totals
  v_new_actions := v_activity.total_actions + 1;

  -- Check if we hit the reward threshold
  if v_new_actions % v_config.actions_per_reward = 0 then
    v_credits_earned := v_config.credits_per_reward;
    v_new_credits := v_activity.total_credits + v_credits_earned;
  else
    v_new_credits := v_activity.total_credits;
  end if;

  -- Check if adding this credit would exceed daily limit
  if v_new_credits > v_limits.max_credits_per_day then
    -- Cap at max
    v_credits_earned := v_limits.max_credits_per_day - v_activity.total_credits;
    v_new_credits := v_limits.max_credits_per_day;
  end if;

  -- Upsert daily activity
  insert into public.game_daily_activity (user_id, activity_date, total_actions, total_credits_earned)
  values (p_user_id, current_date, v_new_actions, v_new_credits)
  on conflict (user_id, activity_date) do update set
    total_actions = v_new_actions,
    total_credits_earned = v_new_credits,
    updated_at = now();

  -- If earned credits, add to profile
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
