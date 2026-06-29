// src/app/api/portfolio/[stlId]/download/route.ts
// GET /api/portfolio/[stlId]/download
//
// Endpoint para re-download de STLs já adquiridos (Task 7).
// Permite que usuários baixem novamente arquivos que já possuem sem cobrar novamente.
// Fluxo:
//   1. Autentica o usuário via Bearer token
//   2. Valida que o STL existe
//   3. Verifica que o usuário já possui o STL (RLS em user_acquired_stls)
//   4. Gera presigned URL via R2
//   5. Registra log em telegram_downloads_history
//   Resposta: { url: string }

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { isR2Configured, getR2DownloadUrl } from '@/lib/r2'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DownloadUrlResponse {
  url: string
}

interface StlRow {
  id: string
  file_name: string | null
  r2_object_key: string | null
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
    console.error('[portfolio-download] userHasStlAccess error:', error.message)
    return false
  }

  return data !== null
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stlId: string }> }
): Promise<NextResponse> {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const userClient = getSupabaseUserClient(token)

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      )
    }

    // ── 2. Get STL ID from route params ────────────────────────────────────────
    const { stlId } = await params

    if (!stlId || typeof stlId !== 'string') {
      return NextResponse.json(
        { error: 'ID do STL ausente ou inválido.' },
        { status: 400 }
      )
    }

    // ── 3. Verificar que o STL existe ──────────────────────────────────────────
    // Admin client bypasses RLS for reading STL metadata
    const adminClient = getSupabaseAdmin()

    const { data: item, error: itemError } = await adminClient
      .from('telegram_indexed_stls')
      .select('id, file_name, r2_object_key')
      .eq('id', stlId)
      .eq('is_deleted', false)
      .single<StlRow>()

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Arquivo STL não encontrado.' },
        { status: 404 }
      )
    }

    if (!item.r2_object_key) {
      return NextResponse.json(
        { error: 'Este arquivo ainda não está disponível para download. Tente novamente em breve.' },
        { status: 404 }
      )
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'Serviço de armazenamento não configurado.' },
        { status: 503 }
      )
    }

    // ── 4. RLS check: usuário deve já ter acesso ao STL ────────────────────────
    const alreadyOwns = await userHasStlAccess(userClient, stlId)

    if (!alreadyOwns) {
      return NextResponse.json(
        { error: 'Você não tem acesso a este arquivo.' },
        { status: 403 }
      )
    }

    // ── 5. Gerar presigned URL via R2 ──────────────────────────────────────────
    const url = await getR2DownloadUrl(item.r2_object_key, item.file_name ?? undefined)

    // ── 6. Log em telegram_downloads_history ───────────────────────────────────
    // Fire-and-forget: falhas aqui não bloqueiam a entrega da URL
    void (async () => {
      try {
        await adminClient
          .from('telegram_downloads_history')
          .insert({ user_id: user.id, stl_id: stlId })
      } catch (err) {
        console.error('[portfolio-download] Erro ao registrar histórico de download:', err)
      }
    })()

    // ── 7. Resposta ────────────────────────────────────────────────────────────
    const response: DownloadUrlResponse = { url }
    return NextResponse.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno no servidor.'
    console.error('[portfolio-download] Erro inesperado:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
