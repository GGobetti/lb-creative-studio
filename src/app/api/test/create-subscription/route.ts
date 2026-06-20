import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * TEST ENDPOINT ONLY - Creates a fake subscription for testing
 * Removes after testing upgrade/downgrade flows
 */
export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { planId = 4 } = await req.json() // Default to Pro (4)

    // Create fake subscription
    const now = new Date()
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        stripe_subscription_id: `test_sub_${Date.now()}`,
        stripe_customer_id: user.user_metadata?.stripe_customer_id || `test_cus_${user.id.slice(0, 8)}`,
        current_plan_id: planId,
        status: 'active',
        period_start: now,
        period_end: nextMonth,
      })

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      message: `Test subscription created with plan ${planId}`,
      periodEnd: nextMonth,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('test create-subscription error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
