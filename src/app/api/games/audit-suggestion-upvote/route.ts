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

    const { suggestion_id, action } = await request.json()
    if (!suggestion_id || !['upvote', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (action === 'upvote') {
      const { error } = await supabase
        .from('stl_audit_suggestion_upvotes')
        .insert({ suggestion_id, user_id: user.id })

      if (error?.code === '23505') {
        // Already upvoted — treat as idempotent success
        return NextResponse.json({ success: true, action: 'already_upvoted' })
      }
      if (error) throw error
    } else {
      await supabase
        .from('stl_audit_suggestion_upvotes')
        .delete()
        .eq('suggestion_id', suggestion_id)
        .eq('user_id', user.id)
    }

    // Return updated count
    const { data: suggestion } = await supabase
      .from('stl_audit_suggestions')
      .select('upvote_count')
      .eq('id', suggestion_id)
      .single()

    return NextResponse.json({
      success: true,
      action,
      upvote_count: suggestion?.upvote_count ?? 0,
    })
  } catch (error) {
    console.error('[AUDIT-SUGGESTION-UPVOTE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
