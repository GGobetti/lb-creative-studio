import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe Secret Key não configurada no servidor.' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia' as any, // fallback if version is too new for types
    })

    const { planId } = await req.json()
    
    // Validate auth
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

    // Fetch pricing plan from Supabase
    if (!planId) {
      return NextResponse.json({ error: 'planId não fornecido' }, { status: 400 })
    }

    const numPlanId = Number(planId)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado' }, { status: 400 })
    }

    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      // Update user profile with customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) {
        console.error('Failed to update stripe_customer_id:', updateError)
      }
    }

    const { data: plan, error: planError } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('id', numPlanId)
      .eq('active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 400 })
    }

    let lineItems = []
    let mode: 'payment' | 'subscription' = plan.is_recurring ? 'subscription' : 'payment'

    // Tier do plano para assinaturas (consistente com a derivação em subscription-change)
    const planTier = plan.is_recurring
      ? (plan.name.toLowerCase().includes('max') ? 'max'
        : plan.name.toLowerCase().includes('pro') ? 'pro' : 'free')
      : ''

    // Contrato consumido pelo webhook (/api/webhooks/stripe). Stripe exige strings no metadata.
    let metadata: any = {
      userId: user.id,
      planId: String(plan.id),
      credits: String(plan.credits),
      kind: plan.is_recurring ? 'subscription' : 'credits',
      planTier,
    }

    lineItems.push({ price: plan.stripe_price_id, quantity: 1 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000'

    // ==========================================
    // MOCK STRIPE CHECKOUT (Simulação temporária)
    // ==========================================
    const isMockMode = process.env.NODE_ENV === 'development' && process.env.STRIPE_MOCK === 'true'

    if (isMockMode) {
      // Usar Service Role para garantir que possamos editar credits (ignora RLS)
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Simular compra de crédito
      const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single()
      if (profile) {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits + plan.credits }).eq('id', user.id)
      }

      // Log transaction (optional in mock mode, ignore errors)
      void supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        payment_intent_id: `mock_${Date.now()}`,
        credits_added: plan.credits,
        description: `Compra: ${plan.name}`,
      })

      return NextResponse.json({ url: `${appUrl}/dashboard/billing?success=true&session_id=mock_session_123` })
    }
    // ==========================================

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      payment_method_options: {},
      line_items: lineItems,
      mode,
      customer: customerId,
      success_url: `${appUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
      metadata,
    })

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
