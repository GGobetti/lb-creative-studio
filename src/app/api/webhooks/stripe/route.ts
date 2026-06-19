import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const CREDIT_AMOUNTS: Record<string, number> = {
  "pack_50": 50,
  "pack_200": 200,
  "pack_500": 500
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const stripeSecret = process.env.STRIPE_SECRET_KEY!

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: 'Missing stripe secret or webhook secret' }, { status: 400 })
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2026-05-27.dahlia',
  })

  // Use Service Role to bypass RLS for webhook
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  let event: Stripe.Event

  try {
    if (!sig || !webhookSecret) return NextResponse.json({ error: 'Missing stripe signature or secret' }, { status: 400 })
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { userId, itemId, type } = session.metadata || {}

        if (!userId) break

        if (type === 'credits') {
          const creditsToAdd = CREDIT_AMOUNTS[itemId]
          if (creditsToAdd) {
            // 1. Inserir na tabela transactions (Ledger)
            const { error: txError } = await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: userId,
                payment_intent_id: session.payment_intent as string,
                credits_added: creditsToAdd,
                description: `Compra de ${creditsToAdd} créditos via Stripe`
              })

            if (txError) throw txError

            // 2. Atualizar saldo no profile (chamar edge function ou RPC seria mais seguro para atomicidade, 
            // mas aqui vamos usar um update simples se não houver conflito extremo)
            // Ideal: supabaseAdmin.rpc('increment_credits', { p_user_id: userId, p_amount: creditsToAdd })
            // Como não sabemos se a RPC existe, faremos uma leitura e atualização
            const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single()
            if (profile) {
              await supabaseAdmin.from('profiles').update({ credits: profile.credits + creditsToAdd }).eq('id', userId)
            }
          }
        } else if (type === 'subscription') {
          // Upgrade de plano
          const plan = itemId // 'pro' ou 'max'
          await supabaseAdmin.from('profiles').update({ plan }).eq('id', userId)
          
          // Se o plano Pro der 100 créditos, poderíamos creditar aqui
          if (plan === 'pro') {
             await supabaseAdmin.from('transactions').insert({
                user_id: userId,
                payment_intent_id: session.subscription as string,
                credits_added: 100,
                description: `Cota mensal do Plano Pro (100 crd)`
             })
             const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single()
             if (profile) {
               await supabaseAdmin.from('profiles').update({ credits: profile.credits + 100 }).eq('id', userId)
             }
          }
        }
        break
      }
      
      case 'invoice.paid': {
        // Renovações recorrentes
        const invoice = event.data.object as Stripe.Invoice
        // invoice.subscription traz o ID. Para mapear de volta ao user, o Stripe guarda customer ID
        // Precisaríamos ter salvo o stripe_customer_id na tabela profiles.
        // Fica como TODO para uma implementação completa de assinaturas
        console.log("Invoice paid:", invoice.id)
        break
      }

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
