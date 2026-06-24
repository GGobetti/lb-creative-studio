import { getSupabaseUserClient, getSupabaseServer } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null

    // Extract user_id from token if available
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const supabase = getSupabaseUserClient(token)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (!authError && user) {
        userId = user.id
      }
    }

    const { product_id } = await req.json()

    if (!product_id) {
      return NextResponse.json(
        { error: 'Missing product_id' },
        { status: 400 }
      )
    }

    const referer_path = req.headers.get('referer') || '/affiliate'

    // Use server client for RLS bypass (anonymous tracking allowed)
    const supabase = getSupabaseServer()
    const { error } = await supabase.from('affiliate_clicks').insert([
      {
        product_id,
        user_id: userId,
        referer_path,
      },
    ])

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/affiliate/track-click]', err)
    // Fail silently (don't break the redirect)
    return NextResponse.json({ success: true }, { status: 200 })
  }
}
