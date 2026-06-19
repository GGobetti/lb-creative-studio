import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// O Scraper Proxy chamará este GET para obter as imagens banidas e atualizar sua blacklist local
export async function GET() {
  try {
    const adminSupabase = getSupabaseAdmin()
    const { data, error } = await adminSupabase
      .from('telegram_banned_images')
      .select('image_hash')

    if (error) throw error

    // Retorna apenas a lista de hashes para facilitar o uso no Proxy
    const hashes = data.map((row: any) => row.image_hash)
    return NextResponse.json({ success: true, banned_hashes: hashes })

  } catch (error: any) {
    console.error('[API Banned Images] Erro GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Rota POST caso queiramos adicionar via API (embora o client frontend possa adicionar diretamente)
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { image_hash, image_url } = await request.json()
    if (!image_hash) {
      return NextResponse.json({ error: 'image_hash é obrigatório.' }, { status: 400 })
    }

    const adminSupabase = getSupabaseAdmin()
    const { error } = await adminSupabase
      .from('telegram_banned_images')
      .upsert({ image_hash, image_url }) // upsert evita erro de duplicidade se o hash já existir

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Imagem adicionada à blacklist.' })

  } catch (error: any) {
    console.error('[API Banned Images] Erro POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
