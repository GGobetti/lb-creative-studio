import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseUserClient } from '@/lib/supabase'

async function requireSysadminOrProxy(request: Request): Promise<{ ok: true } | Response> {
  // Proxy calls with X-API-Key
  const apiKey = request.headers.get('X-API-Key')
  if (apiKey && apiKey === process.env.TELEGRAM_PROXY_API_KEY) {
    return { ok: true }
  }

  // Admin users with Bearer JWT
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = getSupabaseUserClient(token)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  }

  const adminSupabase = getSupabaseAdmin()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'sysadmin') {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  return { ok: true }
}

export async function GET(request: Request) {
  const check = await requireSysadminOrProxy(request)
  if (check instanceof Response) return check

  try {
    const adminSupabase = getSupabaseAdmin()
    const { data, error } = await adminSupabase
      .from('telegram_banned_images')
      .select('image_hash')

    if (error) throw error

    const hashes = data.map((row: any) => row.image_hash)
    return NextResponse.json({ success: true, banned_hashes: hashes })

  } catch (error: any) {
    console.error('[API Banned Images] Erro GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const check = await requireSysadminOrProxy(request)
  if (check instanceof Response) return check

  try {
    const { image_hash, image_url } = await request.json()
    if (!image_hash) {
      return NextResponse.json({ error: 'image_hash é obrigatório.' }, { status: 400 })
    }

    const adminSupabase = getSupabaseAdmin()
    const { error } = await adminSupabase
      .from('telegram_banned_images')
      .upsert({ image_hash, image_url })

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Imagem adicionada à blacklist.' })

  } catch (error: any) {
    console.error('[API Banned Images] Erro POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
