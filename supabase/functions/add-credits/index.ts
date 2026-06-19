// supabase/functions/add-credits/index.ts
// Mock checkout Edge Function — adds credits without real payment.
// In production, replace with Stripe webhook signature verification.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PACKAGES: Record<string, number> = {
  starter: 10,
  pro: 30,
  studio: 100,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { package_id } = await req.json()
    const creditsToAdd = PACKAGES[package_id]

    if (!creditsToAdd) {
      return new Response(JSON.stringify({ error: 'INVALID_PACKAGE' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Atomic increment
    const { data: profile, error } = await supabaseAdmin.rpc('increment_credits_for_user', {
      uid: user.id,
      amount: creditsToAdd,
    })

    if (error) throw error

    // Log transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      payment_intent_id: `mock_${Date.now()}`,
      credits_added: creditsToAdd,
      description: `Compra pacote: ${package_id}`,
    })

    return new Response(
      JSON.stringify({ success: true, credits_added: creditsToAdd }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('add-credits error:', err)
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
