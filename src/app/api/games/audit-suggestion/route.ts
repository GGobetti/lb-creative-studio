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

    const { stl_id, suggested_title, suggested_description, flagged_issues } = await request.json()

    if (!stl_id) {
      return NextResponse.json({ error: 'Missing stl_id' }, { status: 400 })
    }

    // Insert suggestion
    const { error: insertError, data } = await supabase
      .from('stl_audit_suggestions')
      .insert({
        stl_id,
        auditor_id: user.id,
        suggested_title: suggested_title || null,
        suggested_description: suggested_description || null,
        flagged_issues: flagged_issues || null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[AUDIT-SUGGESTION] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Erro ao salvar sugestão' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      suggestion: data,
    })
  } catch (error) {
    console.error('Audit suggestion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
