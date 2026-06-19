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

    // 2. Extrair parâmetros da requisição
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID do item ausente.' }, { status: 400 })
    }

    // 3. Buscar metadados do arquivo no banco de dados
    const { data: item, error: itemError } = await supabase
      .from('telegram_indexed_stls')
      .select('*')
      .eq('id', id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Arquivo STL não encontrado no índice.' }, { status: 404 })
    }

    // 4. Descontar créditos diretamente chamando a RPC no banco
    const adminSupabase = getSupabaseAdmin()
    
    // O custo é fixo em 1 crédito para download do telegram por enquanto
    const cost = 1
    
    if (user.role !== 'sysadmin' && cost > 0) {
      // Usar a RPC atômica para decrementar
      const { data: updatedProfile, error: updateError } = await adminSupabase
        .rpc('decrement_credits', { user_id: user.id, amount: cost })
        
      if (updateError) {
        // Fallback update caso RPC falhe:
        // Pega os créditos atuais primeiro
        const { data: currentProfile } = await adminSupabase
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .single()
          
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
      
      // Registrar transação com o nome do arquivo
      await adminSupabase.from('transactions').insert({
        user_id: user.id,
        credits_added: -cost,
        description: `Download Telegram: ${item.title || item.file_name}`,
      })
    }

    // 4.5. Incrementar o contador de downloads no banco
    await adminSupabase
      .from('telegram_indexed_stls')
      .update({ download_count: (item.download_count || 0) + 1 })
      .eq('id', id)

    // 4.6. Registrar o log de download no histórico de utilização
    try {
      await adminSupabase
        .from('telegram_downloads_history')
        .insert({
          user_id: user.id,
          stl_id: id,
        })
    } catch (dbErr) {
      // Falha não-bloqueante: Não impede o download caso o log falhe
      console.error('[Telegram Download API] Erro ao registrar log no histórico:', dbErr)
    }

    // 5. Baixar o arquivo e fazer o stream para o usuário
    const proxyUrl = process.env.TELEGRAM_PROXY_URL
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    // Caso o proxy do Userbot esteja configurado
    if (proxyUrl) {
      try {
        const downloadRes = await fetch(
          `${proxyUrl}/download?message_id=${item.telegram_message_id}`,
          {
            headers: {
              'X-API-Key': process.env.TELEGRAM_PROXY_API_KEY || ''
            }
          }
        )

        if (!downloadRes.ok) {
          throw new Error(`Proxy download returned status ${downloadRes.status}`)
        }

        return new Response(downloadRes.body, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(item.file_name)}"`,
            'Content-Length': downloadRes.headers.get('Content-Length') || item.file_size_bytes.toString()
          }
        })
      } catch (err: any) {
        console.error('[Telegram Download] Erro ao baixar via proxy:', err.message)
        // Mesmo se o download falhar, os créditos foram debitados. Em produção, poderíamos estornar ou 
        // permitir nova tentativa grátis. Para o fluxo atual, vamos emitir erro.
        return NextResponse.json(
          { error: 'Falha ao conectar com o serviço do Telegram. Tente novamente mais tarde.' },
          { status: 502 }
        )
      }
    }

    // Fallback de desenvolvimento: Stream de um arquivo STL de teste (placeholder)
    // Isso garante que o usuário consiga testar o fluxo de créditos e downloads sem precisar rodar o userbot localmente.
    const mockStlContent = `solid LB_Creative_Studio_Placeholder
  facet normal 0 0 0
    outer loop
      vertex 0 0 0
      vertex 0 10 0
      vertex 10 0 0
    endloop
  endfacet
endsolid LB_Creative_Studio_Placeholder`

    const mockStlBytes = new TextEncoder().encode(mockStlContent)

    return new Response(mockStlBytes, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${item.file_name}"`,
        'Content-Length': mockStlBytes.length.toString()
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
