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

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'sysadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await getSupabaseAdmin().rpc('get_admin_audit_queue')
    if (error) throw error

    return NextResponse.json({ items: data || [] })
  } catch (error) {
    console.error('[ADMIN-AUDIT-QUEUE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
