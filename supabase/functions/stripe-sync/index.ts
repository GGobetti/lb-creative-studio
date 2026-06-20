// Stripe webhook sync — syncs pricing plans, subscriptions, and customer events

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    const event = await req.json()
    const eventType = event.type

    console.log(`Received Stripe webhook: ${eventType}`)

    // ========== PRICING PLAN EVENTS ==========

    // Handle product creation/update
    if (eventType === 'product.created' || eventType === 'product.updated') {
      const product = event.data.object
      let benefits: any[] = []

      try {
        if (product.metadata?.benefits) {
          benefits = JSON.parse(product.metadata.benefits)
        }
      } catch (parseErr) {
        console.warn(`Failed to parse benefits JSON for product ${product.id}:`, parseErr)
      }

      const { error } = await supabase
        .from('pricing_plans')
        .update({ benefits: benefits.length > 0 ? benefits : [] })
        .eq('stripe_product_id', product.id)

      if (error) console.error(`Failed to sync product benefits for ${product.id}:`, error)
      else console.log(`Synced ${benefits.length} benefits for product: ${product.id}`)
    }

    // Handle product deletions
    if (eventType === 'product.deleted') {
      const product = event.data.object
      const { error } = await supabase
        .from('pricing_plans')
        .update({ active: false })
        .eq('stripe_product_id', product.id)

      if (error) console.error('Failed to deactivate product:', error)
      else console.log(`Deactivated product: ${product.id}`)
    }

    // ========== SUBSCRIPTION EVENTS ==========

    // Handle subscription creation
    if (eventType === 'customer.subscription.created') {
      const subscription = event.data.object
      const customerId = subscription.customer
      const stripeSubscriptionId = subscription.id

      // Find user by Stripe customer ID
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (userError || !user) {
        console.warn(`User not found for customer ${customerId}`)
        return new Response(
          JSON.stringify({ received: true, warning: 'User not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get plan from subscription items
      const priceId = subscription.items.data[0]?.price?.id
      if (!priceId) {
        console.warn(`No price ID found in subscription ${stripeSubscriptionId}`)
        return new Response(
          JSON.stringify({ received: true, warning: 'No price ID' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Find plan by stripe_price_id
      const { data: plan, error: planError } = await supabase
        .from('pricing_plans')
        .select('id')
        .eq('stripe_price_id', priceId)
        .single()

      if (planError || !plan) {
        console.warn(`Plan not found for price ${priceId}`)
        return new Response(
          JSON.stringify({ received: true, warning: 'Plan not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Insert subscription record
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: customerId,
          current_plan_id: plan.id,
          status: subscription.status,
          period_start: new Date(subscription.current_period_start * 1000),
          period_end: new Date(subscription.current_period_end * 1000),
        })

      if (insertError) console.error('Failed to insert subscription:', insertError)
      else console.log(`Created subscription: ${stripeSubscriptionId}`)
    }

    // Handle subscription updates
    if (eventType === 'customer.subscription.updated') {
      const subscription = event.data.object
      const stripeSubscriptionId = subscription.id

      // Get price and plan
      const priceId = subscription.items.data[0]?.price?.id
      if (!priceId) {
        console.warn(`No price ID in updated subscription ${stripeSubscriptionId}`)
        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: plan } = await supabase
        .from('pricing_plans')
        .select('id')
        .eq('stripe_price_id', priceId)
        .single()

      // Update subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: subscription.status,
          period_start: new Date(subscription.current_period_start * 1000),
          period_end: new Date(subscription.current_period_end * 1000),
          current_plan_id: plan?.id,
          updated_at: new Date(),
        })
        .eq('stripe_subscription_id', stripeSubscriptionId)

      if (updateError) console.error('Failed to update subscription:', updateError)
      else console.log(`Updated subscription: ${stripeSubscriptionId}`)
    }

    // Handle subscription cancellation
    if (eventType === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const stripeSubscriptionId = subscription.id

      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date(),
          updated_at: new Date(),
        })
        .eq('stripe_subscription_id', stripeSubscriptionId)

      if (cancelError) console.error('Failed to mark subscription as canceled:', cancelError)
      else console.log(`Canceled subscription: ${stripeSubscriptionId}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('stripe-sync error:', errorMsg)
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', details: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
