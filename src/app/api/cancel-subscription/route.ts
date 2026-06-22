import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-27' as any })

interface CancelSubscriptionRequest {
  planIdToDowngradeTo?: number // Se fornecido, agenda esse plano pra começar após cancelamento
}

export async function POST(req: NextRequest) {
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

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 400 })
    }

    // Cancel subscription at end of current period
    const canceledSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    )

    // Update database to mark cancellation as scheduled
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        cancel_at: new Date(canceledSubscription.cancel_at! * 1000),
        updated_at: new Date(),
      })
      .eq('id', subscription.id)

    if (updateError) throw updateError

    // Log the cancellation
    await supabase
      .from('subscription_changes')
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        from_plan_id: subscription.current_plan_id,
        to_plan_id: subscription.current_plan_id, // Same plan, but canceling
        change_type: 'downgrade', // Downgrade to no plan
        effective_date: new Date(canceledSubscription.cancel_at! * 1000),
      })

    return NextResponse.json({
      success: true,
      message: `Assinatura será cancelada em ${new Date(canceledSubscription.cancel_at! * 1000).toLocaleDateString('pt-BR')}`,
      cancelAt: new Date(canceledSubscription.cancel_at! * 1000),
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('cancel-subscription error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
