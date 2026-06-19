-- ============================================================
-- Games: Audit Voting System & Moderation
-- Created: 2026-06-17
-- ============================================================

-- ----------------------------------------------------------------
-- 1. QUALITY AUDIT VOTES (Consenso 70%)
-- Each auditor can vote once per STL
-- ----------------------------------------------------------------
create table public.quality_audit_votes (
  id              uuid        primary key default gen_random_uuid(),
  auditor_id      uuid        not null references public.profiles(id) on delete cascade,
  stl_id          text        not null,  -- identifier do STL (filename ou Telegram ID)
  approved        boolean     not null,
  rejection_reason text,       -- motivo se rejected
  created_at      timestamptz not null default now(),
  unique (auditor_id, stl_id)  -- um voto por auditor por STL
);

alter table public.quality_audit_votes enable row level security;

-- Auditors can vote
create policy "audit_votes: auditors insert own"
  on public.quality_audit_votes for insert
  with check (auth.uid() = auditor_id);

-- Users can see all votes (for transparency)
create policy "audit_votes: authenticated read all"
  on public.quality_audit_votes for select
  to authenticated
  using (true);

-- Admins can see and delete
create policy "audit_votes: admin all"
  on public.quality_audit_votes for all
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 2. STL AUDIT RESULTS (Armazena resultado final)
-- Consenso: 70% de aprovação = APPROVED
-- ----------------------------------------------------------------
create table public.stl_audit_results (
  id              uuid        primary key default gen_random_uuid(),
  stl_id          text        not null unique,  -- filename ou Telegram ID
  stl_title       text,
  stl_image_url   text,
  total_votes     int         not null default 0,
  approved_votes  int         not null default 0,
  approval_rate   numeric,    -- computed: approved_votes / total_votes * 100
  final_status    text        check (final_status in ('pending', 'approved', 'rejected', 'contested')),
  moderated_by    uuid        references public.profiles(id) on delete set null,  -- admin override
  moderated_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.stl_audit_results enable row level security;

-- Users can read results
create policy "audit_results: authenticated read"
  on public.stl_audit_results for select
  to authenticated
  using (true);

-- Admins can do everything
create policy "audit_results: admin all"
  on public.stl_audit_results for all
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 3. GAME USER STATS (Badges, Points, Streaks)
-- ----------------------------------------------------------------
create table public.game_user_stats (
  user_id         uuid        primary key references public.profiles(id) on delete cascade,
  total_points    int         not null default 0,
  badge_tier      text        not null default 'bronze' check (badge_tier in ('bronze', 'silver', 'gold', 'diamond')),
  current_streak  int         not null default 0,
  last_activity   timestamptz default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.game_user_stats enable row level security;

-- Users can read their own
create policy "game_stats: own read"
  on public.game_user_stats for select
  using (auth.uid() = user_id);

-- Admins can read all
create policy "game_stats: admin read"
  on public.game_user_stats for select
  using (public.is_admin());

-- Only system (service role) inserts/updates
-- create policy "game_stats: system update"
--   on public.game_user_stats for update
--   using (true);

-- ----------------------------------------------------------------
-- 4. GAME SESSION LOG (Track all game plays)
-- ----------------------------------------------------------------
create table public.game_sessions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  game_type       text        not null check (game_type in ('photo-match', 'tag-detective', 'category-sort', 'quality-audit')),
  session_score   int         not null,  -- correct answers
  session_size    int         not null,  -- total questions
  credits_earned  int         not null default 0,
  skipped_count   int         not null default 0,
  completed_at    timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

-- Users can read their own
create policy "sessions: own read"
  on public.game_sessions for select
  using (auth.uid() = user_id);

-- Only system inserts
-- (when game ends, Edge Function saves the session)

-- Admins can read all
create policy "sessions: admin read"
  on public.game_sessions for select
  using (public.is_admin());

-- ----------------------------------------------------------------
-- 5. FUNCTION: Compute audit result on each vote
-- Called after INSERT/UPDATE on quality_audit_votes
-- ----------------------------------------------------------------
create or replace function public.recompute_audit_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_approved int;
  v_rate numeric;
  v_status text;
begin
  -- Count votes for this STL
  select count(*), coalesce(sum(case when approved then 1 else 0 end), 0)
  into v_total, v_approved
  from public.quality_audit_votes
  where stl_id = new.stl_id;

  -- Only compute if we have at least 3 votes (to avoid early consensus)
  if v_total >= 3 then
    v_rate := (v_approved::numeric / v_total) * 100;

    -- 70% threshold
    if v_rate >= 70 then
      v_status := 'approved';
    elsif v_rate <= 30 then
      v_status := 'rejected';
    else
      v_status := 'contested';
    end if;
  else
    v_rate := null;
    v_status := 'pending';
  end if;

  -- Upsert result
  insert into public.stl_audit_results (stl_id, total_votes, approved_votes, approval_rate, final_status)
  values (new.stl_id, v_total, v_approved, v_rate, v_status)
  on conflict (stl_id) do update set
    total_votes = v_total,
    approved_votes = v_approved,
    approval_rate = v_rate,
    final_status = v_status,
    updated_at = now();

  return new;
end;
$$;

-- Trigger on insert/update
create trigger on_audit_vote_change
  after insert or update on public.quality_audit_votes
  for each row execute function public.recompute_audit_result();

-- ----------------------------------------------------------------
-- 6. FUNCTION: Auto-create game_user_stats on first game
-- ----------------------------------------------------------------
create or replace function public.ensure_game_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.game_user_stats (user_id, last_activity)
  values (new.user_id, now())
  on conflict (user_id) do update set
    last_activity = now();
  return new;
end;
$$;

-- Trigger on new game session
create trigger on_game_session_created
  after insert on public.game_sessions
  for each row execute function public.ensure_game_stats();
