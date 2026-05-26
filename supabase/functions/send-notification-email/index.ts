// Optional email delivery for in-app notifications.
// Deploy: supabase functions deploy send-notification-email
// Secrets: RESEND_API_KEY, EMAIL_FROM (e.g. "Disc Caddy <noreply@yourdomain.com>")
//
// Invoke from client after creating notifications, or wire a Database Webhook
// on user_notifications INSERT.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') ?? 'Disc Caddy <onboarding@resend.dev>'
  if (!resendKey) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no RESEND_API_KEY' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { user_id, title, body, link_path } = await req.json()
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, notify_email')
      .eq('id', user_id)
      .maybeSingle()

    if (!profile?.email || profile.notify_email === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'opt-out or no email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://thedisccaddy.com'
    const link = link_path ? `${appUrl}${link_path}` : appUrl

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [profile.email],
        subject: title,
        text: `${body}\n\nOpen Disc Caddy: ${link}`,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(errText)
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-notification-email]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
