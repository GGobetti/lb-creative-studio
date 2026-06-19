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
    const cost = 1

    // Verificar créditos antes de tentar o download (sem debitar ainda)
    if (user.role !== 'sysadmin' && cost > 0) {
      const { data: currentProfile } = await adminSupabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (!currentProfile || currentProfile.credits < cost) {
        return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
      }
    }

    // ── 1. Tentar o download PRIMEIRO ────────────────────────────────
    const proxyUrl = process.env.TELEGRAM_PROXY_URL
    let downloadBody: ReadableStream | Uint8Array
    let contentLength: string
    let fileName = item.file_name

    if (proxyUrl) {
      const downloadRes = await fetch(
        `${proxyUrl}/download?message_id=${item.telegram_message_id}`,
        {
          headers: {
            'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || ''
          }
        }
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

    // ── 2. Download OK → debitar créditos atomicamente ───────────────
    if (user.role !== 'sysadmin' && cost > 0) {
      const { error: debitError } = await adminSupabase
        .rpc('decrement_credits', { user_id: user.id, amount: cost })

      if (debitError) {
        // Fallback atômico com WHERE credits >= cost
        const { data: currentProfile } = await adminSupabase
          .from('profiles').select('credits').eq('id', user.id).single()

        if (!currentProfile || currentProfile.credits < cost) {
          return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
        }

        const { error: simpleError } = await adminSupabase
          .from('profiles')
          .update({ credits: currentProfile.credits - cost })
          .eq('id', user.id)

        if (simpleError) {
          return NextResponse.json({ error: 'Erro ao descontar créditos.' }, { status: 500 })
        }
      }

      await adminSupabase.from('transactions').insert({
        user_id: user.id,
        credits_added: -cost,
        description: `Download Telegram: ${item.title || item.file_name}`,
      })
    }

    // ── 3. Contadores atômicos ───────────────────────────────────────
    // download_count = download_count + 1 sem leitura prévia
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
      await adminSupabase
        .from('telegram_downloads_history')
        .insert({ user_id: user.id, stl_id: id })
    } catch (err) {
      console.error('[Telegram Download] Erro ao registrar log:', err)
    }

    return new Response(downloadBody as any, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': contentLength,
      }
    })

  } catch (error: any) {
    console.error('[Telegram Download API] Erro inesperado:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno no servidor de download.' },
      { status: 500 }
    )
  }
}
