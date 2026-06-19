import { NextResponse } from 'next/server'
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    }

    const adminSupabase = getSupabaseAdmin()
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json({ error: 'job_id é obrigatório.' }, { status: 400 })
    }

    const proxyUrl = process.env.TELEGRAM_PROXY_URL
    if (!proxyUrl) {
      return NextResponse.json({ error: 'Scraper Proxy não está configurado localmente.' }, { status: 500 })
    }

    const res = await fetch(`${proxyUrl}/progress?job_id=${jobId}`, {
      headers: {
        'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || ''
      }
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Proxy retornou status ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[API Progress] Erro inesperado:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao consultar progresso.' },
      { status: 500 }
    )
  }
}
