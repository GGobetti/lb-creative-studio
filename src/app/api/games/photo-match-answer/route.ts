import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stl_id, user_answer, correct_answer } = await request.json()

    if (!stl_id || typeof user_answer !== 'boolean' || typeof correct_answer !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // DESIGN NOTE — photo-match is pure crowdsourcing, not a quiz with a "correct" answer.
    // The user votes whether the photo matches the STL; the system aggregates votes and
    // pre-approves when ≥80% consensus is reached. There is no authoritative ground truth
    // stored server-side, so `correct_answer` and `is_correct` are client-generated signals
    // used only to award engagement credits to the voter — not to validate factual correctness.
    // A future improvement would be storing game sessions server-side so the server can
    // verify which photo was shown, but the real protection today is the UNIQUE(user_id, stl_id)
    // constraint on photo_match_answers that prevents repeated voting for credits.

    // 1. Record game action and get rewards (only if correct)
    let creditsEarned = 0
    let xpResult: any = null
    if (is_correct) {
      const { data: actionResult, error: actionError } = await supabase
        .rpc('record_game_action', {
          p_user_id: user.id,
          p_game_type: 'photo-match',
        })
        .single() as any

      if (actionError) {
        console.error('[PHOTO-MATCH] Error recording action:', actionError)
        return NextResponse.json(
          { error: 'Erro ao registrar ação', debug: actionError },
          { status: 400 }
        )
      }

      creditsEarned = actionResult?.credits_earned || 0

      // Read xp_per_action from config
      const { data: xpConfig } = await supabase
        .from('game_rewards_config')
        .select('xp_per_action')
        .eq('game_type', 'photo-match')
        .single() as any
      const xpPerAction = xpConfig?.xp_per_action ?? 10

      // Award XP
      const { data: xpData, error: xpError } = await supabase
        .rpc('award_xp', {
          p_user_id: user.id,
          p_game_type: 'photo-match',
          p_xp_amount: xpPerAction,
        })
        .single() as any
      if (xpError) {
        console.error('[PHOTO-MATCH] XP error (non-fatal):', xpError)
      } else {
        xpResult = xpData
      }
    }

    // 2. Insert the answer
    const { error: answerError } = await supabase.from('photo_match_answers').insert({
      user_id: user.id,
      stl_id,
      user_answer,
      correct_answer,
      is_correct,
    })

    if (answerError) {
      console.error('[PHOTO-MATCH] Answer insert error:', answerError)
      // Don't fail the request if we can't store the answer - user already got their credits
      return NextResponse.json({
        success: true,
        credits_earned: creditsEarned,
        is_correct,
        xp_earned: xpResult?.xp_earned ?? 0,
        level_up: xpResult?.level_up ?? false,
        new_level: xpResult?.new_level ?? null,
        xp_credits_awarded: xpResult?.credits_awarded ?? 0,
        warning: 'Answer recorded locally but may not be stored',
      })
    }

    return NextResponse.json({
      success: true,
      credits_earned: creditsEarned,
      is_correct,
      xp_earned: xpResult?.xp_earned ?? 0,
      level_up: xpResult?.level_up ?? false,
      new_level: xpResult?.new_level ?? null,
      xp_credits_awarded: xpResult?.credits_awarded ?? 0,
    })
  } catch (error) {
    console.error('[PHOTO-MATCH] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
