import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

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
    if (profile?.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { suggestion_id, action } = await request.json()

    if (!suggestion_id || !['apply', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Missing suggestion_id or invalid action' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Busca a sugestão
    const { data: suggestion, error: fetchError } = await admin
      .from('stl_audit_suggestions')
      .select('id, stl_id, suggested_title, status')
      .eq('id', suggestion_id)
      .single()

    if (fetchError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (suggestion.status !== 'pre_approved') {
      return NextResponse.json({ error: 'Suggestion is not in pre_approved status' }, { status: 400 })
    }

    if (action === 'apply') {
      if (!suggestion.suggested_title) {
        return NextResponse.json({ error: 'Suggestion has no title to apply' }, { status: 400 })
      }

      // Atualiza o título do STL
      const { error: updateError } = await admin
        .from('telegram_indexed_stls')
        .update({ title: suggestion.suggested_title })
        .eq('id', suggestion.stl_id)

      if (updateError) throw updateError

      // Marca a sugestão como aplicada
      await admin
        .from('stl_audit_suggestions')
        .update({ status: 'applied' })
        .eq('id', suggestion_id)

      return NextResponse.json({
        success: true,
        action: 'applied',
        new_title: suggestion.suggested_title,
      })
    }

    // action === 'reject'
    await admin
      .from('stl_audit_suggestions')
      .update({ status: 'rejected' })
      .eq('id', suggestion_id)

    return NextResponse.json({ success: true, action: 'rejected' })
  } catch (error) {
    console.error('[ADMIN-APPLY-TITLE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
