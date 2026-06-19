import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stl_id, irrelevant_tags, all_tags } = await request.json()

    if (!stl_id || !Array.isArray(irrelevant_tags) || !Array.isArray(all_tags)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Record game action and earn credits
    const { data: actionResult, error: actionError } = await supabase
      .rpc('record_game_action', {
        p_user_id: user.id,
        p_game_type: 'tag-detective',
      })
      .single() as any

    if (actionError) {
      return NextResponse.json({ error: 'Erro ao registrar ação', debug: actionError }, { status: 400 })
    }

    const creditsEarned = actionResult?.credits_earned || 0
    if (!actionResult?.can_continue) {
      return NextResponse.json({ error: 'Limite diário atingido' }, { status: 429 })
    }

    // Read xp_per_action from config
    const { data: xpConfig } = await supabase
      .from('game_rewards_config')
      .select('xp_per_action')
      .eq('game_type', 'tag-detective')
      .single() as any
    const xpPerAction = xpConfig?.xp_per_action ?? 8

    // Award XP
    const { data: xpData, error: xpError } = await supabase
      .rpc('award_xp', {
        p_user_id: user.id,
        p_game_type: 'tag-detective',
        p_xp_amount: xpPerAction,
      })
      .single() as any
    if (xpError) console.error('[TAG-DETECTIVE] XP error (non-fatal):', xpError)

    // Insert one vote row per tag
    const rows = all_tags.map((tag: string) => ({
      user_id: user.id,
      stl_id,
      tag,
      is_irrelevant: irrelevant_tags.includes(tag),
    }))

    const { error: insertError } = await supabase.from('tag_detective_votes').insert(rows)
    if (insertError) {
      console.error('[TAG-DETECTIVE] Insert error:', insertError)
    }

    return NextResponse.json({
      success: true,
      credits_earned: creditsEarned,
      xp_earned: xpData?.xp_earned ?? 0,
      level_up: xpData?.level_up ?? false,
      new_level: xpData?.new_level ?? null,
    })
  } catch (error) {
    console.error('[TAG-DETECTIVE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
