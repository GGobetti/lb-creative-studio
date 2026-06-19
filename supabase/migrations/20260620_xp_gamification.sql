-- ============================================================
-- XP Gamification System
-- ============================================================

-- ─── xp_config (singleton) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_config (
  id                  int PRIMARY KEY DEFAULT 1,
  xp_to_credits_rate  numeric(6,2) NOT NULL DEFAULT 2.0,
  min_redeem_xp       int          NOT NULL DEFAULT 100,
  max_redeem_per_day  int          NOT NULL DEFAULT 5000,
  updated_at          timestamptz  NOT NULL DEFAULT now()
);
INSERT INTO public.xp_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.xp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_config: authenticated read"
  ON public.xp_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "xp_config: admin write"
  ON public.xp_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── xp_levels ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_levels (
  level          int  PRIMARY KEY,
  name           text NOT NULL,
  xp_required    int  NOT NULL,
  badge_icon     text NOT NULL DEFAULT '🥉',
  badge_color    text NOT NULL DEFAULT 'zinc-400',
  credits_reward int  NOT NULL DEFAULT 0
);

ALTER TABLE public.xp_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_levels: all read"
  ON public.xp_levels FOR SELECT USING (true);
CREATE POLICY "xp_levels: admin write"
  ON public.xp_levels FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.xp_levels (level, name, xp_required, badge_icon, badge_color, credits_reward) VALUES
  (1, 'Rookie',          0,     '🥉', 'zinc-400',   0),
  (2, 'Prototipador',    500,   '🥈', 'blue-400',   100),
  (3, 'Maker',           1500,  '🥇', 'violet-500', 250),
  (4, 'Artesão Digital', 4000,  '🏆', 'amber-500',  500),
  (5, 'Mestre 3D',       10000, '💎', 'cyan-400',   1000),
  (6, 'Lenda Criativa',  25000, '👑', 'yellow-400', 2500)
ON CONFLICT (level) DO NOTHING;

-- ─── xp_transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type  text        NOT NULL,
  xp_amount  int         NOT NULL,
  source     text        NOT NULL CHECK (source IN ('earned', 'redeemed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_tx_user_idx  ON public.xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS xp_tx_date_idx  ON public.xp_transactions(user_id, created_at);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_transactions: own read"
  ON public.xp_transactions FOR SELECT USING (auth.uid() = user_id);
-- Writes only via SECURITY DEFINER RPCs

-- ─── user_badges ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level           int         NOT NULL REFERENCES public.xp_levels(level),
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  credits_awarded int         NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_level_idx ON public.user_badges(user_id, level);
CREATE INDEX        IF NOT EXISTS user_badges_user_idx       ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges: own read"
  ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

-- ─── game_rewards_config: add xp_per_action ──────────────────
ALTER TABLE public.game_rewards_config
  ADD COLUMN IF NOT EXISTS xp_per_action int NOT NULL DEFAULT 10;

UPDATE public.game_rewards_config SET xp_per_action = 10 WHERE game_type = 'photo-match';
UPDATE public.game_rewards_config SET xp_per_action = 8  WHERE game_type = 'tag-detective';
UPDATE public.game_rewards_config SET xp_per_action = 8  WHERE game_type = 'category-sort';
UPDATE public.game_rewards_config SET xp_per_action = 15 WHERE game_type = 'quality-audit';

-- ─── RPC: award_xp ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id   uuid,
  p_game_type text,
  p_xp_amount int
)
RETURNS TABLE (
  xp_earned      int,
  xp_total       bigint,
  level_up       boolean,
  new_level      int,
  credits_awarded int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_earned_total bigint;
  v_new_level       int := NULL;
  v_credits         int := 0;
  v_level           record;
BEGIN
  INSERT INTO public.xp_transactions (user_id, game_type, xp_amount, source)
  VALUES (p_user_id, p_game_type, p_xp_amount, 'earned');

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_earned_total
  FROM public.xp_transactions
  WHERE user_id = p_user_id AND source = 'earned';

  -- Detect first unlocked level above threshold (only one level-up per action)
  SELECT l.level, l.credits_reward INTO v_level
  FROM public.xp_levels l
  WHERE l.xp_required > 0
    AND l.xp_required <= v_xp_earned_total
    AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = p_user_id AND ub.level = l.level
    )
  ORDER BY l.level ASC
  LIMIT 1;

  IF v_level IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, level, credits_awarded)
    VALUES (p_user_id, v_level.level, v_level.credits_reward)
    ON CONFLICT (user_id, level) DO NOTHING;

    IF v_level.credits_reward > 0 THEN
      UPDATE public.profiles
        SET credits = credits + v_level.credits_reward, updated_at = now()
        WHERE id = p_user_id;
      INSERT INTO public.transactions (user_id, credits_added, description)
        VALUES (p_user_id, v_level.credits_reward, 'Level up: nível ' || v_level.level);
    END IF;

    v_new_level := v_level.level;
    v_credits   := v_level.credits_reward;
  END IF;

  RETURN QUERY
  SELECT
    p_xp_amount,
    COALESCE(SUM(t.xp_amount), 0),
    v_new_level IS NOT NULL,
    v_new_level,
    v_credits
  FROM public.xp_transactions t
  WHERE t.user_id = p_user_id;
END;
$$;

-- ─── RPC: redeem_xp ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_xp(
  p_user_id      uuid,
  p_xp_to_redeem int
)
RETURNS TABLE (
  credits_earned int,
  xp_redeemed    int,
  xp_remaining   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_available    bigint;
  v_redeemed_today  bigint;
  v_config          record;
  v_credits_earned  int;
BEGIN
  SELECT * INTO v_config FROM public.xp_config WHERE id = 1;

  IF p_xp_to_redeem < v_config.min_redeem_xp THEN
    RAISE EXCEPTION 'Mínimo para resgate é % XP', v_config.min_redeem_xp;
  END IF;

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_available
  FROM public.xp_transactions WHERE user_id = p_user_id;

  IF v_xp_available < p_xp_to_redeem THEN
    RAISE EXCEPTION 'Saldo de XP insuficiente';
  END IF;

  SELECT COALESCE(ABS(SUM(xp_amount)), 0) INTO v_redeemed_today
  FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND source = 'redeemed'
    AND created_at >= date_trunc('day', now());

  IF v_redeemed_today + p_xp_to_redeem > v_config.max_redeem_per_day THEN
    RAISE EXCEPTION 'Limite diário de resgate atingido';
  END IF;

  v_credits_earned := floor(p_xp_to_redeem::numeric / v_config.xp_to_credits_rate)::int;

  INSERT INTO public.xp_transactions (user_id, game_type, xp_amount, source)
  VALUES (p_user_id, 'redemption', -p_xp_to_redeem, 'redeemed');

  UPDATE public.profiles
    SET credits = credits + v_credits_earned, updated_at = now()
    WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, credits_added, description)
  VALUES (p_user_id, v_credits_earned, 'Resgate de XP: ' || p_xp_to_redeem || ' XP → ' || v_credits_earned || ' créditos');

  RETURN QUERY
  SELECT
    v_credits_earned,
    p_xp_to_redeem,
    COALESCE(SUM(t.xp_amount), 0)
  FROM public.xp_transactions t
  WHERE t.user_id = p_user_id;
END;
$$;

-- ─── RPC: get_xp_summary ────────────────────────────────────
-- Usa auth.uid() internamente — seguro para chamar do browser
CREATE OR REPLACE FUNCTION public.get_xp_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_xp_total        bigint := 0;
  v_xp_earned_total bigint := 0;
  v_current_level   record;
  v_next_level      record;
  v_badges          json;
  v_current_streak  int := 0;
  v_best_streak     int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_total
  FROM public.xp_transactions WHERE user_id = v_uid;

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_earned_total
  FROM public.xp_transactions WHERE user_id = v_uid AND source = 'earned';

  SELECT * INTO v_current_level
  FROM public.xp_levels
  WHERE xp_required <= v_xp_earned_total
  ORDER BY level DESC LIMIT 1;

  IF v_current_level IS NULL THEN
    SELECT * INTO v_current_level FROM public.xp_levels WHERE level = 1;
  END IF;

  SELECT * INTO v_next_level
  FROM public.xp_levels WHERE level = v_current_level.level + 1;

  SELECT json_agg(
    json_build_object(
      'level', ub.level, 'unlocked_at', ub.unlocked_at,
      'credits_awarded', ub.credits_awarded,
      'name', xl.name, 'badge_icon', xl.badge_icon, 'badge_color', xl.badge_color
    ) ORDER BY ub.level
  ) INTO v_badges
  FROM public.user_badges ub
  JOIN public.xp_levels xl ON xl.level = ub.level
  WHERE ub.user_id = v_uid;

  -- Current streak: consecutive ISO weeks counting backwards from now
  WITH weekly AS (
    SELECT DISTINCT date_trunc('week', created_at)::date AS ws
    FROM public.xp_transactions
    WHERE user_id = v_uid AND source = 'earned'
  ),
  numbered AS (
    SELECT ws, row_number() OVER (ORDER BY ws DESC) AS rn FROM weekly
  )
  SELECT COUNT(*)::int INTO v_current_streak
  FROM numbered
  WHERE ws = (date_trunc('week', now())::date
              - ((rn - 1) * INTERVAL '7 days')::interval)::date;

  -- Best streak: longest consecutive run
  WITH weekly AS (
    SELECT DISTINCT date_trunc('week', created_at)::date AS ws
    FROM public.xp_transactions
    WHERE user_id = v_uid AND source = 'earned'
    ORDER BY ws
  ),
  with_prev AS (
    SELECT ws, lag(ws) OVER (ORDER BY ws) AS prev_ws FROM weekly
  ),
  groups AS (
    SELECT ws,
           SUM(CASE WHEN prev_ws IS NULL OR ws - prev_ws > 7 THEN 1 ELSE 0 END)
             OVER (ORDER BY ws) AS grp
    FROM with_prev
  )
  SELECT COALESCE(MAX(cnt), 0)::int INTO v_best_streak
  FROM (SELECT grp, COUNT(*) AS cnt FROM groups GROUP BY grp) sub;

  RETURN json_build_object(
    'xp_total',             v_xp_total,
    'xp_earned_total',      v_xp_earned_total,
    'current_level',        row_to_json(v_current_level),
    'next_level',           row_to_json(v_next_level),
    'current_streak_weeks', COALESCE(v_current_streak, 0),
    'best_streak_weeks',    COALESCE(v_best_streak, 0),
    'badges',               COALESCE(v_badges, '[]'::json)
  );
END;
$$;
