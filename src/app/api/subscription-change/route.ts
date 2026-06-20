import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-05-27.dahlia' as any
})

interface SubscriptionChangeRequest {
  fromPlanId: number
  toPlanId: number
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
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

    const { fromPlanId, toPlanId } = await req.json() as SubscriptionChangeRequest

    if (!fromPlanId || !toPlanId) {
      return NextResponse.json({ error: 'fromPlanId e toPlanId são obrigatórios' }, { status: 400 })
    }

    // Get plans from database
    const { data: fromPlan, error: fromError } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('id', fromPlanId)
      .single()

    const { data: toPlan, error: toError } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('id', toPlanId)
      .single()

    if (fromError || !fromPlan || toError || !toPlan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 400 })
    }

    // Get user profile to access stripe_customer_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'Usuário não vinculado ao Stripe' }, { status: 400 })
    }

    // Get user's current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 400 })
    }

    if (subscription.current_plan_id !== fromPlanId) {
      return NextResponse.json({ error: 'Plano atual não corresponde' }, { status: 400 })
    }

    const isUpgrade = toPlan.price_cents > fromPlan.price_cents
    const tierMap = { free: 0, pro: 1, max: 2 }
    const fromTier = tierMap[(fromPlan.name.toLowerCase().includes('pro') && !fromPlan.name.includes('max')) ? 'pro' : fromPlan.name.toLowerCase().includes('max') ? 'max' : 'free']
    const toTier = tierMap[(toPlan.name.toLowerCase().includes('pro') && !toPlan.name.includes('max')) ? 'pro' : toPlan.name.toLowerCase().includes('max') ? 'max' : 'free']

    // Allow downgrade for testing (in production, would require cancellation first)
    // if (!isUpgrade && toTier < fromTier && fromTier > 0) {
    //   return NextResponse.json({ error: 'Não pode fazer downgrade sem cancelar o plano atual primeiro' }, { status: 400 })
    // }

    // Update subscription in Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)

    const updateParams: Stripe.SubscriptionUpdateParams = {
      items: {
        0: {
          id: stripeSubscription.items.data[0].id,
          price: toPlan.stripe_price_id,
        },
      },
    }

    if (isUpgrade) {
      updateParams.proration_behavior = 'always_invoice'
    } else {
      updateParams.billing_cycle_anchor = 'now'
    }

    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      updateParams
    )

    // Update database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        current_plan_id: toPlanId,
        period_start: new Date(updatedSubscription.current_period_start * 1000),
        period_end: new Date(updatedSubscription.current_period_end * 1000),
        updated_at: new Date(),
      })
      .eq('id', subscription.id)

    if (updateError) throw updateError

    // Log the change
    await supabase
      .from('subscription_changes')
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        from_plan_id: fromPlanId,
        to_plan_id: toPlanId,
        change_type: isUpgrade ? 'upgrade' : 'downgrade',
        effective_date: isUpgrade ? new Date() : new Date(updatedSubscription.current_period_end * 1000),
        proration_credit: updatedSubscription.latest_invoice ? parseFloat(String((updatedSubscription.latest_invoice as any).amount_due || 0)) / 100 : 0,
      })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        planId: toPlanId,
        status: updatedSubscription.status,
        periodEnd: new Date(updatedSubscription.current_period_end * 1000),
      },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('subscription-change error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
