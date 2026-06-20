import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-05-27.dahlia' as any
})

/**
 * TEST ENDPOINT - Creates a real Stripe subscription for testing
 * Webhook will sync automatically
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

    // Always create a new customer for test (Stripe CLI deletes them automatically)
    console.log('Creating new test customer')
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id, testCustomer: 'true' },
    })
    const customerId = customer.id
    console.log('Test customer created:', customerId)

    // Update profile with new customer ID
    console.log('Updating profile with new customer ID:', customerId)
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
    console.log('Profile updated')

    // Get Pro plan price ID (planId=4)
    const { data: plan } = await supabase
      .from('pricing_plans')
      .select('stripe_price_id')
      .eq('id', 4) // Pro
      .single()

    if (!plan?.stripe_price_id) {
      return NextResponse.json({ error: 'Plano Pro não encontrado' }, { status: 400 })
    }

    // Create subscription in Stripe (without trial to allow upgrades/downgrades)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripe_price_id }],
      metadata: { userId: user.id, testSubscription: 'true' },
    })

    return NextResponse.json({
      success: true,
      message: 'Assinatura de teste criada no Stripe! Webhook sincronizará em breve.',
      subscriptionId: subscription.id,
      customerId: customerId,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('test create-real-subscription error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
