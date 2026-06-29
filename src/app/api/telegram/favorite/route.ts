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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID do STL ausente.' }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('telegram_user_favorites')
      .insert({
        user_id: user.id,
        stl_id: id
      })

    if (insertError) {
      if (insertError.code !== '23505') {
        console.error('[Telegram Favorite POST] Erro ao salvar:', insertError)
        return NextResponse.json({ error: 'Falha ao favoritar item.' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, favorited: true })

  } catch (error: any) {
    console.error('[Telegram Favorite POST] Erro inesperado:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID do STL ausente.' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('telegram_user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('stl_id', id)

    if (deleteError) {
      console.error('[Telegram Favorite DELETE] Erro ao remover:', deleteError)
      return NextResponse.json({ error: 'Falha ao desfavoritar item.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, favorited: false })

  } catch (error: any) {
    console.error('[Telegram Favorite DELETE] Erro inesperado:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
