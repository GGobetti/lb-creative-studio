-- Security fix: validate p_user_id matches calling user in write RPCs

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
  -- Security: caller can only award XP to themselves
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.xp_transactions (user_id, game_type, xp_amount, source)
  VALUES (p_user_id, p_game_type, p_xp_amount, 'earned');

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_earned_total
  FROM public.xp_transactions
  WHERE user_id = p_user_id AND source = 'earned';

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
  -- Security: caller can only redeem their own XP
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
