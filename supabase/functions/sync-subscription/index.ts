// Supabase Edge Function — pull the caller's active Stripe subscription
// into their profile. Useful when checkout succeeded but a webhook was
// missed or failed.
//
// Deploy: supabase functions deploy sync-subscription

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      },
    )
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id as string | null
    if (!customerId) {
      const found = await stripe.customers.search({
        query: `metadata['supabase_user_id']:'${user.id}'`,
        limit: 1,
      })
      customerId = found.data[0]?.id ?? null
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'no_stripe_customer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    })
    const active = subs.data.find(s =>
      s.status === 'active' || s.status === 'trialing'
    )
    const latest = active ?? subs.data[0]

    if (!latest) {
      await supabaseAdmin
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          subscription_tier: 'free',
          subscription_status: 'free',
          subscription_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      return new Response(JSON.stringify({ tier: 'free', status: 'free' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tier =
      latest.status === 'active' || latest.status === 'trialing' ? 'pro' : 'free'

    await supabaseAdmin
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        subscription_tier: tier,
        subscription_status: latest.status,
        subscription_period_end: new Date(latest.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    return new Response(
      JSON.stringify({ tier, status: latest.status, isPro: tier === 'pro' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
