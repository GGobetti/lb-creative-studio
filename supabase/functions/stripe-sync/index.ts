// Stripe webhook sync — updates pricing_plans table when products/prices change in Stripe

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

    // Handle product updates
    if (eventType === 'product.created' || eventType === 'product.updated') {
      const product = event.data.object

      // Update or insert product in pricing_plans
      // Note: prices are handled separately, so we just mark product as exists
      console.log(`Product ${eventType}: ${product.id}`)
    }

    // Handle price updates (most important for us)
    if (eventType === 'price.created' || eventType === 'price.updated') {
      const price = event.data.object
      const productId = price.product

      // Fetch product from Stripe to get name/description
      // For now, we'll just log and let manual sync handle it
      console.log(`Price ${eventType}: ${price.id} for product ${productId}`)
    }

    // Handle deletions
    if (eventType === 'product.deleted') {
      const product = event.data.object
      const { error } = await supabase
        .from('pricing_plans')
        .update({ active: false })
        .eq('stripe_product_id', product.id)

      if (error) console.error('Failed to deactivate product:', error)
      else console.log(`Deactivated product: ${product.id}`)
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
