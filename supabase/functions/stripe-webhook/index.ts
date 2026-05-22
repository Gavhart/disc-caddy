// Supabase Edge Function — Stripe webhook handler.
// Receives subscription lifecycle events and updates profiles accordingly.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//
// Stripe webhook events to enable:
//   - checkout.session.completed
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function resolveUserId(customerId: string): Promise<string | null> {
  const { data: byCustomer } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (byCustomer?.id) return byCustomer.id

  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return customer.metadata?.supabase_user_id ?? null
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  const status = sub.status
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
  const tier = status === 'active' || status === 'trialing' ? 'pro' : 'free'

  const patch = {
    stripe_customer_id: customerId,
    subscription_status: status,
    subscription_tier: tier,
    subscription_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  }

  const userId = await resolveUserId(customerId)
  if (!userId) {
    console.error('[webhook] no profile for customer', customerId)
    return
  }

  const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', userId)
  if (error) {
    console.error('[webhook] profile update failed:', error)
    throw error
  }
  console.log('[webhook] synced subscription for user', userId, '→', tier, status)
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('missing signature', { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const customerId = session.customer as string | null
        if (!customerId) break

        const userId = await resolveUserId(customerId)
        if (userId) {
          await supabaseAdmin
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
        }

        const subscriptionId = session.subscription as string | null
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          await syncSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(sub)
        break
      }
      default:
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[webhook] handler error:', err)
    return new Response(`Handler error: ${err.message}`, { status: 500 })
  }
})
