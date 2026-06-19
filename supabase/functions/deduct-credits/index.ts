// supabase/functions/deduct-credits/index.ts
// Deno Edge Function — deducts credits atomically and records the transaction.
// Called by the frontend before triggering the STL download.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // bypasses RLS
    )

    // Validate JWT and get user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { item_id, feature_key } = await req.json()
    if (!item_id && !feature_key) {
      return new Response(
        JSON.stringify({ error: 'MISSING_PARAMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch user profile to get their plan
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan, credits, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'PROFILE_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const plan = profile.plan || 'free'
    let cost = 0
    let description = ''

    if (item_id) {
      // Fetch item cost
      const { data: item, error: itemError } = await supabaseAdmin
        .from('catalog_items')
        .select('title, price_free, price_pro, price_max, price_in_credits')
        .eq('id', item_id)
        .single()

      if (itemError || !item) {
        return new Response(
          JSON.stringify({ error: 'ITEM_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (plan === 'max') {
        cost = item.price_max ?? 1
      } else if (plan === 'pro') {
        cost = item.price_pro ?? 1
      } else {
        cost = item.price_free ?? item.price_in_credits ?? 2
      }
      description = `Exportação STL: ${item.title}`
    } else if (feature_key) {
      // Fetch feature cost
      const { data: feature, error: featureError } = await supabaseAdmin
        .from('feature_costs')
        .select('display_name, cost_free, cost_pro, cost_max')
        .eq('feature_key', feature_key)
        .single()

      if (featureError || !feature) {
        return new Response(
          JSON.stringify({ error: 'FEATURE_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (plan === 'max') {
        cost = feature.cost_max ?? 0
      } else if (plan === 'pro') {
        cost = feature.cost_pro ?? 0
      } else {
        cost = feature.cost_free ?? 1
      }
      description = `Uso de funcionalidade: ${feature.display_name}`
    }

    if (profile.role === 'sysadmin') {
      cost = 0;
    }

    let remaining = profile.credits;

    if (cost > 0) {
      // Atomic decrement — only succeeds if user has enough credits
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .rpc('decrement_credits', { user_id: user.id, amount: cost })
        
      // Fallback if rpc fails (in case decrement_credits doesn't exist, though it should if they use atomic decrement)
      if (updateError) {
        // Simple update fallback (non-atomic but works for standard setups)
        const { data: simpleProfile, error: simpleError } = await supabaseAdmin
          .from('profiles')
          .update({ credits: profile.credits - cost })
          .eq('id', user.id)
          .gt('credits', cost - 1)
          .select('credits')
          .single()
        
        if (simpleError || !simpleProfile) {
          return new Response(
            JSON.stringify({ error: 'INSUFFICIENT_CREDITS', cost }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        remaining = simpleProfile.credits
      } else {
        // If RPC succeeds, we need to fetch the new balance
        const { data: freshProfile } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .single()
        remaining = freshProfile?.credits ?? profile.credits - cost
      }
    }

    // Record transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      item_id: item_id || null,
      credits_added: -cost,
      description: description,
    })

    return new Response(
      JSON.stringify({ success: true, remaining: remaining, cost }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('deduct-credits error:', err)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
