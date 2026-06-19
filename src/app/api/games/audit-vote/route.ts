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

    const { stl_id, approved, rejection_reason, game_type = 'quality-audit' } = await request.json()

    if (!stl_id || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const VALID_GAME_TYPES = ['quality-audit', 'photo-match', 'tag-detective', 'category-sort']
    if (!VALID_GAME_TYPES.includes(game_type)) {
      return NextResponse.json({ error: 'Invalid game type' }, { status: 400 })
    }

    // 1. Record game action and get rewards
    const { data: actionResult, error: actionError } = await supabase
      .rpc('record_game_action', {
        p_user_id: user.id,
        p_game_type: game_type,
      })
      .single() as any

    if (actionError) {
      console.error('[AUDIT-VOTE] Error recording action:', actionError)
      return NextResponse.json(
        { error: 'Erro ao registrar ação', debug: actionError },
        { status: 400 }
      )
    }

    const creditsEarned = actionResult?.credits_earned || 0
    const canContinue = actionResult?.can_continue !== false

    console.log('[AUDIT-VOTE] Action recorded:', {
      userId: user.id,
      gameType: game_type,
      canContinue,
      creditsEarned,
      actionsRemaining: actionResult?.actions_remaining,
      creditsRemaining: actionResult?.credits_remaining,
    })

    // Check daily limits BEFORE voting
    if (!canContinue) {
      console.warn('[AUDIT-VOTE] Daily action limit reached for user:', user.id)
      return NextResponse.json(
        { error: 'Você atingiu o limite diário de ações', debug: { canContinue, actionsRemaining: actionResult?.actions_remaining } },
        { status: 429 }
      )
    }

    // 2. Insert vote (will auto-trigger recompute_audit_result)
    console.log('[AUDIT-VOTE] Inserting vote:', {
      auditorId: user.id,
      stlId: stl_id,
      approved,
      hasRejectionReason: !!rejection_reason
    })

    const { error: voteError, data: voteData } = await supabase.from('quality_audit_votes').insert({
      auditor_id: user.id,
      stl_id,
      approved,
      rejection_reason: rejection_reason || null,
    })

    if (voteError) {
      console.error('[AUDIT-VOTE] Vote insert error:', {
        code: voteError.code,
        message: voteError.message,
        details: voteError.details,
        hint: voteError.hint,
      })
    } else {
      console.log('[AUDIT-VOTE] Vote inserted successfully, data:', voteData)
    }

    if (voteError) {
      // If unique constraint violation, user already voted on this STL
      if (voteError.code === '23505') {
        console.warn('[AUDIT-VOTE] User already voted on this STL:', {
          auditorId: user.id,
          stlId: stl_id
        })
        return NextResponse.json(
          { error: 'Você já votou neste STL' },
          { status: 409 }
        )
      }
      throw voteError
    }

    // 3. Get updated result
    console.log('[AUDIT-VOTE] Fetching audit results for stl_id:', stl_id)
    const { data: result, error: resultError } = await supabase
      .from('stl_audit_results')
      .select('*')
      .eq('stl_id', stl_id)
      .single()

    if (resultError) {
      console.warn('[AUDIT-VOTE] Result fetch error (trigger may not have fired yet):', {
        code: resultError.code,
        message: resultError.message
      })
    } else {
      console.log('[AUDIT-VOTE] Result fetched successfully:', result)
    }

    return NextResponse.json({
      success: true,
      result,
      credits_earned: creditsEarned,
      can_continue: canContinue,
      actions_remaining: actionResult?.actions_remaining || 0,
      credits_remaining: actionResult?.credits_remaining || 0,
    })
  } catch (error) {
    console.error('Audit vote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
