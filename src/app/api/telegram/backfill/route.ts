import { NextResponse } from 'next/server'
import { getSupabaseUserClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile || profile.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas sysadmin.' }, { status: 403 })
    }

    const body = await request.json()
    const { hours_back = 24, group_ids } = body

    // Exclude local imports (is_local_import = true) from backfill processing
    const { data: localImportIds, error: localErr } = await supabase
      .from('telegram_indexed_stls')
      .select('id')
      .eq('is_local_import', true)

    if (localErr) {
      console.warn('[API Backfill] Erro ao buscar imports locais:', localErr)
    }

    const excludeIds = localImportIds?.map((r: any) => r.id) || []

    const proxyUrl = process.env.TELEGRAM_PROXY_URL
    if (!proxyUrl) {
      return NextResponse.json({ error: 'Scraper Proxy não está configurado.' }, { status: 500 })
    }

    const res = await fetch(`${proxyUrl}/backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || '',
      },
      body: JSON.stringify({ hours_back, group_ids, exclude_ids: excludeIds }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Proxy retornou status ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API Backfill] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao disparar varredura.' },
      { status: 500 }
    )
  }
}
