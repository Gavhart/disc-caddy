// Supabase Edge Function — Stripe webhook handler.
// Receives subscription lifecycle events and updates profiles accordingly.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// (Webhook calls don't carry a JWT, so disable JWT verification on this function.)
//
// Secrets required:
//   STRIPE_SECRET_KEY=sk_test_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
//   SUPABASE_SERVICE_ROLE_KEY=...   (auto-provided by Supabase to Edge Functions as SUPABASE_SERVICE_ROLE_KEY)
//
// Configure in Stripe: webhook endpoint pointing to
//   https://<your-project>.supabase.co/functions/v1/stripe-webhook
// Listening for events:
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

// Service-role client bypasses RLS so we can update any user's profile.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status // 'active' | 'canceled' | 'past_due' | 'trialing' | ...
        const customerId = sub.customer as string
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

        const tier =
          status === 'active' || status === 'trialing' ? 'pro' : 'free'

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: status,
            subscription_tier: tier,
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('[webhook] update failed:', error)
        break
      }
      default:
        // Other events ignored for v1.
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
