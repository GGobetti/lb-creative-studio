// src/app/api/portfolio/route.ts
// GET /api/portfolio
//
// Retorna o portfólio completo do usuário autenticado, segregado por fonte de aquisição.
// Fluxo:
//   1. Autentica user via Bearer token JWT
//   2. Queries vw_user_stl_portfolio com RLS (filtra by auth.uid() automaticamente)
//   3. Segregar resultados por `source` ('direct'/'bundle_child' vs 'import'/'gift')
//   4. Resposta JSON: { makerworld: [], stlSearch: [], total: number, timestamp }
//
// Requerimentos de Design:
//   - TypeScript strict
//   - RLS via VIEW (não manual filtering)
//   - Paginação opcional (limit/offset query string)
//   - Error handling: 401/500

import { NextResponse } from 'next/server'
import { getSupabaseUserClient } from '@/lib/supabase'
import type { UserStlPortfolio } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortfolioResponse {
  makerworld: UserStlPortfolio[]
  stlSearch: UserStlPortfolio[]
  total: number
  timestamp: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Segregate portfolio items by acquisition source.
 * - makerworld: items from 'import' (Makerworld/Thingiverse imports)
 * - stlSearch: items from 'direct' or 'bundle_child' (STL Search purchases)
 */
function segregateBySource(items: UserStlPortfolio[]): {
  makerworld: UserStlPortfolio[]
  stlSearch: UserStlPortfolio[]
} {
  const makerworld: UserStlPortfolio[] = []
  const stlSearch: UserStlPortfolio[] = []

  for (const item of items) {
    if (item.source === 'import') {
      makerworld.push(item)
    } else if (item.source === 'direct' || item.source === 'bundle_child' || item.source === 'gift') {
      stlSearch.push(item)
    }
    // If source is unknown, default to stlSearch (defensive)
  }

  return { makerworld, stlSearch }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
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

    // ── 2. Parse query string para paginação ───────────────────────────────────
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')

    // Validar limites (1-500 items)
    let limit = 500
    let offset = 0
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 500) {
        limit = parsedLimit
      }
    }
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10)
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset
      }
    }

    // ── 3. Query vw_user_stl_portfolio com RLS ────────────────────────────────
    // RLS automatically filters to auth.uid() via the view policy
    const { data: portfolioItems, error: queryError } = await userClient
      .from('vw_user_stl_portfolio')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('acquired_at', { ascending: false })

    if (queryError) {
      console.error('[portfolio] Query error:', queryError.message)
      return NextResponse.json(
        { error: 'Erro ao buscar portfólio.' },
        { status: 500 }
      )
    }

    // Cast data to UserStlPortfolio[] (validated by view RLS)
    const items = (portfolioItems || []) as UserStlPortfolio[]

    // ── 4. Segregar por source ─────────────────────────────────────────────────
    const { makerworld, stlSearch } = segregateBySource(items)

    // ── 5. Montar resposta ─────────────────────────────────────────────────────
    const response: PortfolioResponse = {
      makerworld,
      stlSearch,
      total: items.length,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno no servidor.'
    console.error('[portfolio] Unexpected error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
