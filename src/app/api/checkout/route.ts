import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const PACKAGES = {
  "pack_50": { name: "Pacote de 50 Créditos", priceId: process.env.STRIPE_PRICE_PACK_50, amount: 1000 }, // R$ 10,00
  "pack_200": { name: "Pacote de 200 Créditos", priceId: process.env.STRIPE_PRICE_PACK_200, amount: 3500 }, // R$ 35,00
  "pack_500": { name: "Pacote de 500 Créditos", priceId: process.env.STRIPE_PRICE_PACK_500, amount: 8000 }, // R$ 80,00
}

const SUBSCRIPTIONS = {
  "pro": { name: "Plano Pro", priceId: process.env.STRIPE_PRICE_PRO, amount: 2990 }, // R$ 29,90/mês
  "max": { name: "Plano Max", priceId: process.env.STRIPE_PRICE_MAX, amount: 7990 }, // R$ 79,90/mês
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe Secret Key não configurada no servidor.' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia' as any, // fallback if version is too new for types
    })

    const { itemId, type } = await req.json()
    
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

    let lineItems = []
    let mode: 'payment' | 'subscription' = 'payment'
    let metadata: any = {
      userId: user.id,
      itemId,
      type
    }

    if (type === 'credits') {
      const pack = PACKAGES[itemId as keyof typeof PACKAGES]
      if (!pack) return NextResponse.json({ error: 'Pacote inválido' }, { status: 400 })
      
      mode = 'payment'
      if (pack.priceId) {
        lineItems.push({ price: pack.priceId, quantity: 1 })
      } else {
        lineItems.push({
          price_data: {
            currency: 'brl',
            product_data: { name: pack.name },
            unit_amount: pack.amount,
          },
          quantity: 1,
        })
      }
    } else if (type === 'subscription') {
      const sub = SUBSCRIPTIONS[itemId as keyof typeof SUBSCRIPTIONS]
      if (!sub) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
      
      mode = 'subscription'
      if (sub.priceId) {
        lineItems.push({ price: sub.priceId, quantity: 1 })
      } else {
         // Se não houver priceId (ambiente de teste sem os produtos criados), falha graciosamente
        // Stripe requires existing Price IDs for subscriptions usually, but we can't create them on the fly easily
        return NextResponse.json({ error: 'Configuração de assinatura pendente no Stripe Dashboard' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000'

    // Use test data if no prices are set (for easy prototyping without dashboard setup)
    if (lineItems.length > 0 && !lineItems[0].price && mode === 'subscription') {
      return NextResponse.json({ error: 'Configure os Stripe Price IDs no .env.local para assinaturas' }, { status: 400 })
    }

    // ==========================================
    // MOCK STRIPE CHECKOUT (Simulação temporária)
    // ==========================================
    const isMockMode = process.env.NODE_ENV === 'development' && process.env.STRIPE_MOCK === 'true'
    
    if (isMockMode) {
      // Usar Service Role para garantir que possamos editar plan/credits (ignora RLS)
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      if (type === 'credits') {
        const pack = PACKAGES[itemId as keyof typeof PACKAGES]
        const creditsToAdd = pack.amount / 100 * 5 // Mock: 50 pra R$10, 200 pra R$35... aproximado (ou usar um mapa real)
        const exactCredits = itemId === 'pack_50' ? 50 : itemId === 'pack_200' ? 200 : 500
        
        // Simular compra de crédito
        const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single()
        if (profile) {
          await supabaseAdmin.from('profiles').update({ credits: profile.credits + exactCredits }).eq('id', user.id)
        }
      } else if (type === 'subscription') {
        const plan = itemId // 'pro' ou 'max'
        await supabaseAdmin.from('profiles').update({ plan }).eq('id', user.id)
        
        if (plan === 'pro') {
           const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single()
           if (profile) {
             await supabaseAdmin.from('profiles').update({ credits: profile.credits + 100 }).eq('id', user.id)
           }
        }
      }

      return NextResponse.json({ url: `${appUrl}/dashboard/billing?success=true&session_id=mock_session_123` })
    }
    // ==========================================

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      payment_method_options: {},
      line_items: lineItems,
      mode,
      customer_email: user.email,
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
