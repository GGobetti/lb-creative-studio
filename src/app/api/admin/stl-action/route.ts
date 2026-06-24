import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/stl-action
// action: 'apply_suggestion' | 'remove_stl' | 'keep_stl' | 'remove_tag'
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { action, stl_id, suggestion_id, tag, updates } = body

    // Use admin client for all DB writes — bypasses RLS so sysadmin can modify any STL
    const admin = getSupabaseAdmin()

    switch (action) {

      case 'apply_suggestion': {
        if (!stl_id || !suggestion_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

        const { data: suggestion, error: fetchError } = await admin
          .from('stl_audit_suggestions')
          .select('*')
          .eq('id', suggestion_id)
          .single()
        if (fetchError || !suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

        if (suggestion.status === 'pre_approved') {
          return NextResponse.json(
            { error: 'Use /api/admin/apply-title-suggestion for pre-approved suggestions' },
            { status: 400 }
          )
        }

        const stlUpdate: Record<string, any> = {}
        if (suggestion.suggested_title) stlUpdate.title = suggestion.suggested_title
        if (suggestion.suggested_description) stlUpdate.description = suggestion.suggested_description
        if (suggestion.suggested_tags?.length > 0) stlUpdate.tags = suggestion.suggested_tags
        if (suggestion.suggested_categories?.length > 0) stlUpdate.categories = suggestion.suggested_categories

        if (Object.keys(stlUpdate).length > 0) {
          const { error: stlError } = await admin
            .from('telegram_indexed_stls').update(stlUpdate).eq('id', stl_id)
          if (stlError) throw stlError
        }

        const { error: suggestionError } = await admin
          .from('stl_audit_suggestions')
          .update({ status: 'applied', approved_by: user.id, approved_at: new Date().toISOString() })
          .eq('id', suggestion_id)
        if (suggestionError) throw suggestionError

        return NextResponse.json({ success: true, action, applied: stlUpdate })
      }

      case 'apply_partial': {
        if (!stl_id || !updates) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        const allowed = ['title', 'description', 'tags', 'categories']
        const safe: Record<string, any> = {}
        for (const key of allowed) {
          if (updates[key] !== undefined) safe[key] = updates[key]
        }
        if (Object.keys(safe).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

        const { error } = await admin
          .from('telegram_indexed_stls').update(safe).eq('id', stl_id)
        if (error) throw error
        return NextResponse.json({ success: true, action, applied: safe })
      }

      case 'remove_tag': {
        if (!stl_id || !tag) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

        // Remove from STL tags array
        const { data: stl } = await admin
          .from('telegram_indexed_stls').select('tags').eq('id', stl_id).single()
        const newTags = (stl?.tags || []).filter((t: string) => t !== tag)
        const { error } = await admin
          .from('telegram_indexed_stls').update({ tags: newTags }).eq('id', stl_id)
        if (error) throw error

        // Also clear vote records so the tag doesn't reappear in signals on reload
        await admin
          .from('tag_detective_votes')
          .delete()
          .eq('stl_id', stl_id)
          .eq('tag', tag)

        return NextResponse.json({ success: true, action, removed_tag: tag })
      }

      case 'remove_stl': {
        if (!stl_id) return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })
        const { error } = await admin
          .from('telegram_indexed_stls')
          .update({ marked_for_removal: true, removal_reason: 'admin_removed', removal_marked_at: new Date().toISOString() })
          .eq('id', stl_id)
        if (error) throw error
        return NextResponse.json({ success: true, action })
      }

      case 'keep_stl': {
        if (!stl_id) return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })
        const { error } = await admin
          .from('telegram_indexed_stls')
          .update({ marked_for_removal: false, removal_reason: null, removal_marked_at: null })
          .eq('id', stl_id)
        if (error) throw error

        await admin
          .from('stl_audit_suggestions')
          .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason: 'admin_kept_stl' })
          .eq('stl_id', stl_id)
          .eq('status', 'pending')

        return NextResponse.json({ success: true, action })
      }

      case 'reject_suggestion': {
        if (!suggestion_id) return NextResponse.json({ error: 'Missing suggestion_id' }, { status: 400 })
        const { error } = await admin
          .from('stl_audit_suggestions')
          .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
          .eq('id', suggestion_id)
        if (error) throw error
        return NextResponse.json({ success: true, action })
      }

      case 'needs_validation': {
        if (!stl_id) return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })
        const { error } = await admin
          .from('telegram_indexed_stls')
          .update({ needs_validation: true })
          .eq('id', stl_id)
        if (error) throw error
        return NextResponse.json({ success: true, action })
      }

      case 'clear_validation': {
        if (!stl_id) return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })
        const { error } = await admin
          .from('telegram_indexed_stls')
          .update({ needs_validation: false })
          .eq('id', stl_id)
        if (error) throw error
        return NextResponse.json({ success: true, action })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[ADMIN-STL-ACTION]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
