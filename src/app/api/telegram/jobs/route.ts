import { NextResponse } from 'next/server'
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)

    // 1. Validar a sessão do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
    }

    // 2. Validar se o usuário é administrador (sysadmin)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile || profile.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas sysadmin.' }, { status: 403 })
    }

    // 3. Extrair parâmetros
    const { action, jobId } = await request.json()
    if (!action || !jobId) {
      return NextResponse.json({ error: 'action e jobId são obrigatórios.' }, { status: 400 })
    }

    const proxyUrl = process.env.TELEGRAM_PROXY_URL
    const adminSupabase = getSupabaseAdmin()

    if (action === 'reject') {
      // Rejeição pode ser feita direto no banco, definindo status como 'failed' ou 'rejected'
      console.log(`[API Jobs] Rejeitando job ${jobId} diretamente no banco...`)
      const { error } = await adminSupabase
        .from('telegram_scraper_jobs')
        .update({
          status: 'failed',
          error_message: 'Rejeitado pelo administrador.',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (error) {
        throw new Error(`Erro ao rejeitar job no banco: ${error.message}`)
      }

      return NextResponse.json({ success: true, message: 'Job rejeitado com sucesso.' })
    }

    if (action === 'retry') {
      if (!proxyUrl) {
        return NextResponse.json({ error: 'Scraper Proxy não está configurado localmente.' }, { status: 500 })
      }
      console.log(`[API Jobs] Enviando retry do job ${jobId} para o Proxy...`)
      const res = await fetch(`${proxyUrl}/retry?job_id=${jobId}`, {
        headers: {
          'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || ''
        }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Proxy retornou status ${res.status}`)
      }

      const data = await res.json()
      return NextResponse.json({ success: true, message: data.message })
    }

    // Ações que requerem conexão com o Scraper Proxy (approve, cancel)
    if (!proxyUrl) {
      return NextResponse.json({ error: 'Scraper Proxy não está configurado localmente.' }, { status: 500 })
    }

    if (action === 'approve') {
      console.log(`[API Jobs] Enviando aprovação do job ${jobId} para o Proxy...`)
      const res = await fetch(`${proxyUrl}/approve?job_id=${jobId}`, {
        headers: {
          'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || ''
        }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Proxy retornou status ${res.status}`)
      }

      const data = await res.json()
      return NextResponse.json({ success: true, message: data.message })
    }

    if (action === 'cancel') {
      console.log(`[API Jobs] Enviando cancelamento do job ${jobId} para o Proxy...`)
      const res = await fetch(`${proxyUrl}/cancel?job_id=${jobId}`, {
        headers: {
          'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || ''
        }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Proxy retornou status ${res.status}`)
      }

      const data = await res.json()
      return NextResponse.json({ success: true, message: data.message })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })

  } catch (error: any) {
    console.error('[API Jobs] Erro inesperado:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar ação no job.' },
      { status: 500 }
    )
  }
}
