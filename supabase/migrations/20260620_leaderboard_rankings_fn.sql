CREATE OR REPLACE FUNCTION public.get_leaderboard_rankings(
  p_period text,
  p_limit int,
  p_user_id uuid
)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  name text,
  total_xp bigint,
  badge_icon text,
  current_streak int,
  games_played int
) AS $$
DECLARE
  v_start_date timestamptz;
BEGIN
  IF p_period = 'week' THEN
    v_start_date := now() - interval '7 days';
  ELSE
    v_start_date := '1900-01-01'::timestamptz;
  END IF;

  RETURN QUERY
  WITH user_xp AS (
    SELECT
      xt.user_id,
      SUM(xt.xp_amount) as total_xp,
      p.full_name as name,
      gus.current_streak,
      gus.games_played,
      COALESCE(ub.badge_icon, '🥉') as badge_icon
    FROM xp_transactions xt
    JOIN profiles p ON p.id = xt.user_id
    LEFT JOIN game_user_stats gus ON gus.user_id = xt.user_id
    LEFT JOIN (
      SELECT DISTINCT ON (ub2.user_id) ub2.user_id, xl.badge_icon
      FROM user_badges ub2
      JOIN xp_levels xl ON xl.level = ub2.level
      ORDER BY ub2.user_id, ub2.level DESC
    ) ub ON ub.user_id = xt.user_id
    WHERE xt.created_at >= v_start_date
      AND xt.source = 'earned'
    GROUP BY xt.user_id, p.full_name, gus.current_streak, gus.games_played, ub.badge_icon
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY user_xp.total_xp DESC)::bigint as rank,
      user_xp.*
    FROM user_xp
  )
  SELECT
    r.rank,
    r.user_id,
    r.name,
    r.total_xp,
    r.badge_icon,
    r.current_streak,
    r.games_played
  FROM ranked r
  WHERE r.rank <= p_limit OR r.user_id = p_user_id
  ORDER BY r.rank;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
