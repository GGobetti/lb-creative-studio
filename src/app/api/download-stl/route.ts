// src/app/api/download-stl/route.ts
// POST /api/download-stl
//
// Endpoint de download com lógica de aquisição STL bundling (Task 2).
// Fluxo:
//   1. Autentica o usuário via Bearer token
//   2. Valida que o STL existe
//   3. Checa se o usuário já possui o STL (RLS em user_acquired_stls)
//   4. Se JÁ TEM: skip débito, apenas gera presigned URL
//   5. Se NÃO TEM: valida créditos, chama RPC acquire_stl_bundle(), gera URL
//   6. Incrementa download_count em telegram_indexed_stls
//   7. Registra log em telegram_downloads_history
//   Resposta: { url: string, charged: boolean }

import { NextResponse } from 'next/server'
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { isR2Configured, getR2DownloadUrl } from '@/lib/r2'
import type { AcquireStlBundleResult } from '@/lib/supabase'

const DEFAULT_COST = 3

// ─── Types ───────────────────────────────────────────────────────────────────

interface DownloadStlRequest {
  id: string
}

interface DownloadStlResponse {
  url: string
  charged: boolean
}

interface StlRow {
  id: string
  title: string | null
  file_name: string | null
  r2_object_key: string | null
  download_count: number | null
}

// ─── Helper: check RLS-filtered ownership ────────────────────────────────────

/**
 * Returns true if the authenticated user already owns the STL.
 * Uses the user-scoped client so RLS filters to auth.uid() automatically.
 * A row being returned means the user has access; no row = not owned.
 */
async function userHasStlAccess(
  userClient: ReturnType<typeof getSupabaseUserClient>,
  stlId: string
): Promise<boolean> {
  const { data, error } = await userClient
    .from('user_acquired_stls')
    .select('id')
    .eq('stl_id', stlId)
    .maybeSingle()

  if (error) {
    // Log non-critical errors but don't block — treat as "not owned"
    console.error('[download-stl] userHasStlAccess error:', error.message)
    return false
  }

  return data !== null
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const userClient = getSupabaseUserClient(token)

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
    }

    // ── 2. Parse body ──────────────────────────────────────────────────────────
    let body: DownloadStlRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })
    }

    const { id } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID do STL ausente ou inválido.' }, { status: 400 })
    }

    // ── 3. Validar que o STL existe ────────────────────────────────────────────
    // Admin client bypasses RLS for reading STL metadata (public catalog)
    const adminClient = getSupabaseAdmin()

    const { data: item, error: itemError } = await adminClient
      .from('telegram_indexed_stls')
      .select('id, title, file_name, r2_object_key, download_count')
      .eq('id', id)
      .eq('is_deleted', false)
      .single<StlRow>()

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Arquivo STL não encontrado no índice.' },
        { status: 404 }
      )
    }

    if (!item.r2_object_key || !isR2Configured()) {
      return NextResponse.json(
        { error: 'Este arquivo ainda não está disponível para download. Tente novamente em breve.' },
        { status: 503 }
      )
    }

    // ── 4. Buscar perfil do usuário (créditos + plano) ─────────────────────────
    const { data: profile } = await adminClient
      .from('profiles')
      .select('credits, plan, role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'sysadmin'

    // ── 5. Verificar se usuário JÁ possui este STL (RLS check) ────────────────
    const alreadyOwns = await userHasStlAccess(userClient, id)

    let charged = false

    if (!alreadyOwns) {
      // ── 5a. Ainda não possui — calcular custo e verificar créditos ────────────
      let cost = DEFAULT_COST

      if (!isAdmin) {
        const { data: fc } = await adminClient
          .from('feature_costs')
          .select('cost_free, cost_pro, cost_max')
          .eq('feature_key', 'download_stl')
          .maybeSingle()

        if (!fc) {
          console.error('[download-stl] feature_costs entry "download_stl" not found')
          return NextResponse.json(
            { error: 'Configuração de custo não encontrada.' },
            { status: 500 }
          )
        }

        const plan = profile?.plan ?? 'free'
        cost =
          plan === 'max' ? fc.cost_max : plan === 'pro' ? fc.cost_pro : fc.cost_free

        if ((profile?.credits ?? 0) < cost) {
          return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
        }
      } else {
        // Admins não pagam
        cost = 0
      }

      // ── 5b. Chamar RPC acquire_stl_bundle() — atômico: debita + insere bundle ─
      // O RPC executa com SECURITY DEFINER e usa auth.uid() internamente,
      // portanto deve ser chamado pelo client do usuário (token JWT no header).
      const { data: rpcData, error: rpcError } = await userClient
        .rpc('acquire_stl_bundle', {
          p_stl_id: id,
          p_source: 'direct',
          p_credit_cost: isAdmin ? 0 : cost,
        })

      if (rpcError) {
        console.error('[download-stl] acquire_stl_bundle error:', rpcError.message)

        if (
          rpcError.message.includes('Insufficient credits') ||
          rpcError.code === '42501'
        ) {
          return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
        }

        return NextResponse.json(
          { error: 'Erro ao processar aquisição do arquivo.' },
          { status: 500 }
        )
      }

      const result = rpcData as AcquireStlBundleResult
      charged = result.credits_used > 0
    }
    // Se já possui: charged permanece false (skip débito)

    // ── 6. Gerar presigned URL via R2 ─────────────────────────────────────────
    const url = await getR2DownloadUrl(item.r2_object_key, item.file_name ?? undefined)

    // ── 7. Incrementar download_count em telegram_indexed_stls ────────────────
    // Fire-and-forget: falhas aqui não bloqueiam a entrega da URL
    void (async () => {
      try {
        const { error: rpcErr } = await adminClient.rpc('increment_download_count', {
          stl_id: id,
        })
        if (rpcErr) {
          // Fallback manual caso RPC falhe
          await adminClient
            .from('telegram_indexed_stls')
            .update({ download_count: (item.download_count ?? 0) + 1 })
            .eq('id', id)
        }
      } catch (err) {
        console.error('[download-stl] Erro ao incrementar download_count:', err)
      }
    })()

    // ── 8. Log em telegram_downloads_history ──────────────────────────────────
    void (async () => {
      try {
        await adminClient
          .from('telegram_downloads_history')
          .insert({ user_id: user.id, stl_id: id })
      } catch (err) {
        console.error('[download-stl] Erro ao registrar histórico de download:', err)
      }
    })()

    // ── 9. Resposta ────────────────────────────────────────────────────────────
    const response: DownloadStlResponse = { url, charged }
    return NextResponse.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno no servidor.'
    console.error('[download-stl] Erro inesperado:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
