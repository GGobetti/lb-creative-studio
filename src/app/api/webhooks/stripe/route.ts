import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

/** Adiciona créditos atomicamente via RPC. Lança se falhar — idempotência garantida pela tabela transactions. */
async function addCredits(
  supabaseAdmin: ReturnType<typeof getAdmin>,
  userId: string,
  amount: number
) {
  if (amount <= 0) return
  const { error } = await supabaseAdmin.rpc('increment_credits_for_user', {
    uid: userId,
    p_amount: amount,
  })
  if (error) throw error
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const stripeSecret = process.env.STRIPE_SECRET_KEY!

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: 'Missing stripe secret or webhook secret' }, { status: 400 })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2026-05-27.dahlia' as any })
  const supabaseAdmin = getAdmin()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      // ── Compra concluída (pacote avulso OU 1ª cobrança de assinatura) ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Contrato de metadata definido em /api/checkout/route.ts
        const { userId, credits, kind, planTier } = session.metadata || {}
        if (!userId) {
          console.warn('[Webhook] checkout.session.completed sem userId no metadata')
          break
        }

        const creditsToAdd = parseInt(credits || '0', 10)
        // Ref única p/ idempotência: subscription (assinatura) ou payment_intent (avulso)
        const paymentRef = (session.subscription || session.payment_intent) as string

        // Idempotência via UNIQUE em transactions.payment_intent_id
        const { error: txError } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            payment_intent_id: paymentRef,
            credits_added: creditsToAdd,
            description: kind === 'subscription'
              ? `Ativação de assinatura (${creditsToAdd} créditos)`
              : `Compra de ${creditsToAdd} créditos via Stripe`,
          })

        if (txError?.code === '23505') {
          console.log('[Webhook] Evento já processado:', paymentRef)
          break
        }
        if (txError) throw txError

        await addCredits(supabaseAdmin, userId, creditsToAdd)

        // Assinatura: atualiza plano e guarda customer p/ renovações (invoice.paid)
        if (kind === 'subscription' && planTier) {
          await supabaseAdmin
            .from('profiles')
            .update({ plan: planTier, stripe_customer_id: session.customer as string })
            .eq('id', userId)
        }
        break
      }

      // ── Renovação mensal automática de assinatura ──
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        if (!customerId) break

        // Apenas renovações — a 1ª cobrança já foi tratada em checkout.session.completed
        const billingReason = (invoice as any).billing_reason
        if (billingReason !== 'subscription_cycle') break

        // Localizar usuário pelo stripe_customer_id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, plan')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!profile) {
          console.warn('[Webhook] invoice.paid: customer sem perfil:', customerId)
          break
        }

        // Créditos mensais do plano (valor real vindo de pricing_plans)
        const { data: planRow } = await supabaseAdmin
          .from('pricing_plans')
          .select('credits')
          .eq('is_recurring', true)
          .eq('active', true)
          .ilike('name', `%${profile.plan}%`)
          .maybeSingle()

        const monthlyCredits = planRow?.credits || 0
        if (monthlyCredits === 0) break

        // Idempotência via invoice.id
        const { error: txError } = await supabaseAdmin.from('transactions').insert({
          user_id: profile.id,
          payment_intent_id: invoice.id,
          credits_added: monthlyCredits,
          description: `Renovação Plano ${profile.plan} (${monthlyCredits} créditos)`,
        })

        if (txError?.code === '23505') {
          console.log('[Webhook] Invoice já processada:', invoice.id)
          break
        }
        if (txError) throw txError

        await addCredits(supabaseAdmin, profile.id, monthlyCredits)
        console.log(`[Webhook] Renovação: +${monthlyCredits} crd → user ${profile.id}`)
        break
      }

      default:
        console.log(`[Webhook] Evento não tratado: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
