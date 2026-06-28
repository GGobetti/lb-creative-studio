import { NextResponse } from 'next/server'
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { isR2Configured, getR2DownloadUrl } from '@/lib/r2'

const DEFAULT_COST = 3

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

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID do item ausente.' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase
      .from('telegram_indexed_stls')
      .select('*')
      .eq('id', id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Arquivo STL não encontrado no índice.' }, { status: 404 })
    }

    const adminSupabase = getSupabaseAdmin()

    // ── Custo dinâmico por plano (feature_costs: download_stl) — Fase 1C ──
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('credits, plan, role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'sysadmin'
    let cost = DEFAULT_COST
    if (!isAdmin) {
      const { data: fc } = await adminSupabase
        .from('feature_costs')
        .select('cost_free, cost_pro, cost_max')
        .eq('feature_key', 'download_stl')
        .maybeSingle()
      if (!fc) {
        console.error('[Telegram Download] feature_costs entry "download_stl" not found')
        return NextResponse.json({ error: 'Configuração de custo não encontrada.' }, { status: 500 })
      }
      const plan = profile?.plan || 'free'
      cost = plan === 'max' ? fc.cost_max : plan === 'pro' ? fc.cost_pro : fc.cost_free
      // Verificar saldo ANTES de entregar (sem debitar ainda)
      if ((profile?.credits ?? 0) < cost) {
        return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
      }
    }

    // Débito atômico + registro na ledger (chamado só após garantir a entrega)
    const debit = async () => {
      if (isAdmin || cost <= 0) return
      const { error: debitError } = await adminSupabase
        .rpc('decrement_credits', { user_id: user.id, amount: cost })
      if (debitError) {
        const { data: cur } = await adminSupabase
          .from('profiles').select('credits').eq('id', user.id).single()
        if (!cur || cur.credits < cost) throw new Error('INSUFFICIENT_CREDITS')
        await adminSupabase.from('profiles')
          .update({ credits: cur.credits - cost }).eq('id', user.id)
      }
      await adminSupabase.from('transactions').insert({
        user_id: user.id,
        credits_added: -cost,
        description: `Download Telegram: ${item.title || item.file_name}`,
      })
    }

    // Contadores (download_count + histórico)
    const bumpCounters = async () => {
      try {
        const { error: rpcErr } = await adminSupabase.rpc('increment_download_count', { stl_id: id })
        if (rpcErr) {
          await adminSupabase
            .from('telegram_indexed_stls')
            .update({ download_count: (item.download_count || 0) + 1 })
            .eq('id', id)
        }
      } catch {}
      try {
        await adminSupabase.from('telegram_downloads_history').insert({ user_id: user.id, stl_id: id })
      } catch (err) {
        console.error('[Telegram Download] Erro ao registrar log:', err)
      }
    }

    // ── CAMINHO ALVO: arquivo no Cloudflare R2 → presigned URL ──
    // O usuário baixa direto do R2 (egress grátis, sem passar pela máquina do dono).
    if (item.r2_object_key && isR2Configured()) {
      try {
        await debit()
      } catch {
        return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
      }
      const url = await getR2DownloadUrl(item.r2_object_key, item.file_name)
      await bumpCounters()
      // Cliente detecta resposta JSON e baixa a partir desta URL
      return NextResponse.json({ url, fileName: item.file_name })
    }

    // ── CAMINHO LEGADO/FALLBACK: proxy do Telegram (ou placeholder em dev) ──
    // Mantido para não regredir enquanto a migração para R2 não estiver completa.
    const proxyUrl = process.env.TELEGRAM_PROXY_URL
    let downloadBody: ReadableStream | Uint8Array
    let contentLength: string
    const fileName = item.file_name

    if (proxyUrl) {
      const downloadRes = await fetch(
        `${proxyUrl}/download?message_id=${item.telegram_message_id}`,
        { headers: { 'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || '' } }
      )
      if (!downloadRes.ok) {
        console.error('[Telegram Download] Proxy retornou:', downloadRes.status)
        return NextResponse.json(
          { error: 'Falha ao conectar com o serviço do Telegram. Tente novamente mais tarde.' },
          { status: 502 }
        )
      }
      downloadBody = downloadRes.body!
      contentLength = downloadRes.headers.get('Content-Length') || item.file_size_bytes.toString()
    } else {
      // Fallback de desenvolvimento — STL placeholder
      const mockStlContent = `solid LB_Creative_Studio_Placeholder
  facet normal 0 0 0
    outer loop
      vertex 0 0 0
      vertex 0 10 0
      vertex 10 0 0
    endloop
  endfacet
endsolid LB_Creative_Studio_Placeholder`
      const bytes = new TextEncoder().encode(mockStlContent)
      downloadBody = bytes
      contentLength = bytes.length.toString()
    }

    // Entrega garantida → debitar
    try {
      await debit()
    } catch {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    await bumpCounters()

    return new Response(downloadBody as any, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': contentLength,
      },
    })
  } catch (error: any) {
    console.error('[Telegram Download API] Erro inesperado:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor de download.' },
      { status: 500 }
    )
  }
}
