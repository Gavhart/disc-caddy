// Stripe webhook removed — Disc Caddy is fully free.
// Delete this folder once supabase functions delete stripe-webhook has run:
//   supabase functions delete stripe-webhook
//   rm -rf supabase/functions/stripe-webhook
// Also remove the webhook endpoint in the Stripe dashboard.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// 200 so any in-flight Stripe retries quietly succeed before you delete the endpoint.
serve(() => new Response('OK', { status: 200 }))
