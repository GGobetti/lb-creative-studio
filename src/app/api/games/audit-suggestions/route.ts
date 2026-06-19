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

    const stlId = request.nextUrl.searchParams.get('stl_id')
    if (!stlId) return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })

    // Fetch pending suggestions for this STL
    const { data: suggestions, error } = await supabase
      .from('stl_audit_suggestions')
      .select('id, auditor_id, suggested_title, suggested_description, suggested_tags, suggested_categories, flagged_issues, upvote_count, created_at')
      .eq('stl_id', stlId)
      .eq('status', 'pending')
      .order('upvote_count', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[AUDIT-SUGGESTIONS] Fetch error:', error)
      return NextResponse.json({ suggestions: [] })
    }

    // Check which ones the current user has already upvoted
    const suggestionIds = (suggestions || []).map((s: any) => s.id)
    let upvotedIds: string[] = []

    if (suggestionIds.length > 0) {
      const { data: upvotes } = await supabase
        .from('stl_audit_suggestion_upvotes')
        .select('suggestion_id')
        .eq('user_id', user.id)
        .in('suggestion_id', suggestionIds)

      upvotedIds = (upvotes || []).map((u: any) => u.suggestion_id)
    }

    const result = (suggestions || []).map((s: any) => ({
      ...s,
      suggested_tags: s.suggested_tags || [],
      suggested_categories: s.suggested_categories || [],
      has_upvoted: upvotedIds.includes(s.id),
    }))

    return NextResponse.json({ suggestions: result })
  } catch (error) {
    console.error('[AUDIT-SUGGESTIONS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
