// Subscription sync removed — Disc Caddy is fully free.
// Delete this folder once supabase functions delete sync-subscription has run:
//   supabase functions delete sync-subscription
//   rm -rf supabase/functions/sync-subscription
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(() => new Response('OK', { status: 200 }))
