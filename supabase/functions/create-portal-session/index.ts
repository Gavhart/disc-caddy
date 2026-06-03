// Stripe billing portal removed — Disc Caddy is fully free.
// Delete this folder once supabase functions delete create-portal-session has run:
//   supabase functions delete create-portal-session
//   rm -rf supabase/functions/create-portal-session
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(() => new Response('Billing is not available.', { status: 410 }))
