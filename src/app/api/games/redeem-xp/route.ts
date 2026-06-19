import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { xp_to_redeem } = await request.json()
    if (!xp_to_redeem || typeof xp_to_redeem !== 'number' || xp_to_redeem <= 0) {
      return NextResponse.json({ error: 'xp_to_redeem deve ser um número positivo' }, { status: 400 })
    }

    const { data, error } = await supabase
      .rpc('redeem_xp', { p_user_id: user.id, p_xp_to_redeem: xp_to_redeem })
      .single() as any

    if (error) {
      // O RPC lança RAISE EXCEPTION com mensagens amigáveis
      const message = error.message?.includes('insuficiente')
        ? 'Saldo de XP insuficiente'
        : error.message?.includes('Mínimo')
        ? error.message
        : error.message?.includes('diário')
        ? 'Limite diário de resgate atingido'
        : 'Erro ao processar resgate'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('[REDEEM-XP] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
