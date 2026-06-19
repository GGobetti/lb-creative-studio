import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'sysadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const stlId = request.nextUrl.searchParams.get('stl_id')
    if (!stlId) return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })

    // Use admin client to bypass RLS for cross-user vote aggregation
    const admin = getSupabaseAdmin()

    // Fetch all signals in parallel
    const [stlRes, photoRes, tagRes, categoryRes, suggestionsRes] = await Promise.all([
      // STL base info (admin to bypass RLS)
      admin
        .from('telegram_indexed_stls')
        .select('id, title, description, photos, tags, categories, file_name, marked_for_removal, removal_reason')
        .eq('id', stlId)
        .single(),

      // PhotoMatch: vote breakdown across ALL users
      admin
        .from('photo_match_answers')
        .select('user_answer, correct_answer, is_correct, created_at')
        .eq('stl_id', stlId)
        .order('created_at', { ascending: false })
        .limit(50),

      // TagDetective: per-tag vote counts across ALL users
      admin
        .from('tag_detective_votes')
        .select('tag, is_irrelevant')
        .eq('stl_id', stlId),

      // CategorySort: votes across ALL users
      admin
        .from('category_votes')
        .select('categories, suggested_categories, created_at')
        .eq('stl_id', stlId)
        .order('created_at', { ascending: false })
        .limit(50),

      // Suggestions: sorted by upvotes
      admin
        .from('stl_audit_suggestions')
        .select('id, auditor_id, suggested_title, suggested_description, suggested_tags, suggested_categories, flagged_issues, upvote_count, status, created_at')
        .eq('stl_id', stlId)
        .eq('status', 'pending')
        .order('upvote_count', { ascending: false }),
    ])

    // Aggregate tag votes
    const tagVotes: Record<string, { total: number; irrelevant: number }> = {}
    for (const row of (tagRes.data || [])) {
      if (!tagVotes[row.tag]) tagVotes[row.tag] = { total: 0, irrelevant: 0 }
      tagVotes[row.tag].total++
      if (row.is_irrelevant) tagVotes[row.tag].irrelevant++
    }
    const tagSignals = Object.entries(tagVotes).map(([tag, counts]) => ({
      tag,
      total: counts.total,
      irrelevant: counts.irrelevant,
      irrelevant_pct: counts.total > 0 ? counts.irrelevant / counts.total : 0,
    })).sort((a, b) => b.irrelevant_pct - a.irrelevant_pct)

    // Aggregate category votes
    const catCounts: Record<string, number> = {}
    const suggestedCatCounts: Record<string, number> = {}
    for (const row of (categoryRes.data || [])) {
      for (const cat of (row.categories || [])) {
        catCounts[cat] = (catCounts[cat] || 0) + 1
      }
      for (const cat of (row.suggested_categories || [])) {
        suggestedCatCounts[cat] = (suggestedCatCounts[cat] || 0) + 1
      }
    }
    const categorySignals = {
      total_voters: (categoryRes.data || []).length,
      votes: Object.entries(catCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      suggestions: Object.entries(suggestedCatCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
    }

    // PhotoMatch summary
    const photoAnswers = photoRes.data || []
    const photoSignals = {
      total: photoAnswers.length,
      correct: photoAnswers.filter((a) => a.is_correct).length,
      mismatch_pct: photoAnswers.length > 0
        ? photoAnswers.filter((a) => !a.is_correct).length / photoAnswers.length
        : 0,
    }

    return NextResponse.json({
      stl: stlRes.data,
      photo: photoSignals,
      tags: tagSignals,
      categories: categorySignals,
      suggestions: (suggestionsRes.data || []).map((s: any) => ({
        ...s,
        suggested_tags: s.suggested_tags || [],
        suggested_categories: s.suggested_categories || [],
      })),
    })
  } catch (error) {
    console.error('[ADMIN-STL-SIGNALS]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
