// supabase/functions/add-credits/index.ts
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
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Create Supabase client with user token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    // Get current user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { package_id } = await req.json()

    // Map package_id to credits
    const creditsMap: Record<string, number> = {
      'starter': 10,
      'pro': 30,
      'studio': 100,
    }

    const creditsToAdd = creditsMap[package_id]
    if (!creditsToAdd) {
      return new Response(JSON.stringify({ error: 'INVALID_PACKAGE' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get current credits
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (fetchError) throw fetchError

    const newCredits = (currentProfile?.credits || 0) + creditsToAdd

    // Update with new total
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', user.id)
      .select('credits')
      .single()

    if (updateError) throw updateError

    // Log transaction
    const { error: logError } = await supabase.from('transactions').insert({
      user_id: user.id,
      payment_intent_id: `sandbox_${Date.now()}`,
      credits_added: creditsToAdd,
      description: `Créditos avulsos: ${package_id}`,
    })

    if (logError) console.error('Log error:', logError)

    return new Response(
      JSON.stringify({ success: true, credits_added: creditsToAdd, new_balance: profile?.credits }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('add-credits error:', errorMsg)
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', details: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
