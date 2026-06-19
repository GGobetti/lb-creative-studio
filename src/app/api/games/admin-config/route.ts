import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const userClient = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify sysadmin role
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (!profile || profile.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { dailyLimit, rewards } = await request.json()
    const admin = getSupabaseAdmin()

    if (dailyLimit) {
      const { error } = await admin
        .from('game_daily_limits')
        .update({
          max_actions_per_day: dailyLimit.max_actions_per_day,
          max_credits_per_day: dailyLimit.max_credits_per_day,
        })
        .eq('id', '00000000-0000-0000-0000-000000000000')

      if (error) throw error
    }

    if (rewards) {
      for (const reward of rewards as { game_type: string; actions_per_reward: number; credits_per_reward: number }[]) {
        const { error } = await admin
          .from('game_rewards_config')
          .update({
            actions_per_reward: reward.actions_per_reward,
            credits_per_reward: reward.credits_per_reward,
          })
          .eq('game_type', reward.game_type)

        if (error) throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('admin-config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
