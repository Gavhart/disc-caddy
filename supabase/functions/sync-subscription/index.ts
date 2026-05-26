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
      .select('stripe_customer_id, email, subscription_tier, subscription_status')
      .eq('id', user.id)
      .single()

    const hasActivePro =
      profile?.subscription_tier === 'pro' &&
      (profile?.subscription_status === 'active' ||
        profile?.subscription_status === 'trialing')

    const proResponse = () =>
      new Response(
        JSON.stringify({
          tier: 'pro',
          status: profile?.subscription_status ?? 'active',
          isPro: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )

    let customerId = profile?.stripe_customer_id as string | null
    if (!customerId) {
      try {
        const found = await stripe.customers.search({
          query: `metadata['supabase_user_id']:'${user.id}'`,
          limit: 1,
        })
        customerId = found.data[0]?.id ?? null
      } catch {
        if (hasActivePro) return proResponse()
        throw new Error('stripe_customer_lookup_failed')
      }
    }

    if (!customerId) {
      if (hasActivePro) return proResponse()
      return new Response(JSON.stringify({ error: 'no_stripe_customer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subs: Stripe.ApiList<Stripe.Subscription>
    try {
      subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      })
    } catch {
      // Stale test-mode customer IDs fail against live Stripe — keep Pro access.
      if (hasActivePro) return proResponse()
      return new Response(JSON.stringify({ error: 'no_stripe_customer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const active = subs.data.find(s =>
      s.status === 'active' || s.status === 'trialing'
    )
    const latest = active ?? subs.data[0]

    if (!latest) {
      if (hasActivePro) return proResponse()

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
