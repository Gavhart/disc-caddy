// Stripe checkout removed — Disc Caddy is fully free.
// Delete this folder once supabase functions delete create-checkout-session has run:
//   supabase functions delete create-checkout-session
//   rm -rf supabase/functions/create-checkout-session
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(() => new Response('Subscriptions are not available.', { status: 410 }))
