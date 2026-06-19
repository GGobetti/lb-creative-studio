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

    const { data, error } = await supabase.rpc('get_xp_summary')
    if (error) {
      console.error('[XP-SUMMARY] RPC error:', error)
      return NextResponse.json({ error: 'Erro ao buscar resumo de XP' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[XP-SUMMARY] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
