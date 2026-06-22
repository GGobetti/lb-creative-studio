import { NextResponse } from 'next/server'
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'

// Ações de moderação da fila do scraper — operam direto no banco (sem proxy).
// O scraper local consome os status via processApprovedJobs():
//   approve  → 'approved'   (scraper baixa + sobe + indexa)
//   retry    → 'approved'   (reprocessa um job que falhou)
//   reject   → 'failed'     (descartado pelo admin)
//   cancel   → 'cancelled'  (interrompe/abandona)
const ACTION_STATUS: Record<string, { status: string; message: string; error?: string }> = {
  approve: { status: 'approved', message: 'Job aprovado — será processado pelo scraper.' },
  retry: { status: 'approved', message: 'Job reenfileirado para reprocessamento.' },
  reject: { status: 'failed', message: 'Job rejeitado.', error: 'Rejeitado pelo administrador.' },
  cancel: { status: 'cancelled', message: 'Job cancelado.', error: 'Cancelado pelo administrador.' },
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)

    // 1. Validar sessão
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
    }

    // 2. Validar sysadmin
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile || profile.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas sysadmin.' }, { status: 403 })
    }

    // 3. Parâmetros
    const { action, jobId } = await request.json()
    if (!action || !jobId) {
      return NextResponse.json({ error: 'action e jobId são obrigatórios.' }, { status: 400 })
    }

    const mapped = ACTION_STATUS[action as string]
    if (!mapped) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    // 4. Atualizar status no banco
    const adminSupabase = getSupabaseAdmin()
    const { error } = await adminSupabase
      .from('telegram_scraper_jobs')
      .update({
        status: mapped.status,
        error_message: mapped.error || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      throw new Error(`Erro ao atualizar job: ${error.message}`)
    }

    return NextResponse.json({ success: true, message: mapped.message })
  } catch (error: any) {
    console.error('[API Jobs] Erro inesperado:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar ação no job.' },
      { status: 500 }
    )
  }
}
