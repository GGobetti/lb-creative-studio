import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week'
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!['week', 'alltime'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Use "week" or "alltime"' },
        { status: 400 }
      )
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    const { data: rankings, error: rankingsError } = await supabase.rpc(
      'get_leaderboard_rankings',
      {
        p_period: period,
        p_limit: limit,
        p_user_id: user.id,
      }
    )

    if (rankingsError) {
      console.error('[LEADERBOARD] RPC error:', rankingsError)
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      )
    }

    const rows = (rankings ?? []) as Array<{
      rank: bigint | number
      user_id: string
      name: string
      total_xp: bigint | number
      badge_icon: string
      current_streak: number
      games_played: number
    }>

    const mapRow = (r: typeof rows[number]) => ({
      rank: Number(r.rank),
      userId: r.user_id,
      name: r.name,
      xp: Number(r.total_xp),
      badge: r.badge_icon,
      streak: r.current_streak ?? 0,
      gamesPlayed: r.games_played ?? 0,
    })

    const topRankings = rows.filter((r) => Number(r.rank) <= limit).map(mapRow)
    const userRow = rows.find((r) => r.user_id === user.id)
    const userPosition = userRow ? mapRow(userRow) : null

    return NextResponse.json({ period, rankings: topRankings, userPosition })
  } catch (err) {
    console.error('[LEADERBOARD] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
