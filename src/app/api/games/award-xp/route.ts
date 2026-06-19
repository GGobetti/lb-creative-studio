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

    const { game_type } = await request.json()
    if (!game_type) return NextResponse.json({ error: 'game_type obrigatório' }, { status: 400 })

    const VALID_GAME_TYPES = ['photo-match', 'tag-detective', 'category-sort', 'quality-audit']
    if (!VALID_GAME_TYPES.includes(game_type)) {
      return NextResponse.json({ error: 'game_type inválido' }, { status: 400 })
    }

    // Ler xp_per_action da config
    const { data: config } = await supabase
      .from('game_rewards_config')
      .select('xp_per_action')
      .eq('game_type', game_type)
      .single() as any

    const xp_amount = config?.xp_per_action ?? 10

    const { data, error } = await supabase
      .rpc('award_xp', { p_user_id: user.id, p_game_type: game_type, p_xp_amount: xp_amount })
      .single() as any

    if (error) {
      console.error('[AWARD-XP] RPC error:', error)
      return NextResponse.json({ error: 'Erro ao registrar XP', debug: error }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('[AWARD-XP] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
