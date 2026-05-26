// Unified push + email delivery for notifications.
// Deploy: supabase functions deploy dispatch-notification --no-verify-jwt
//
// Secrets (Supabase Dashboard → Edge Functions):
//   NOTIFICATION_WEBHOOK_SECRET  — must match app_config.notification_webhook_secret
//   VAPID_PUBLIC_KEY           — same as VITE_VAPID_PUBLIC_KEY in Vercel
//   VAPID_PRIVATE_KEY          — server only, never expose to client
//   VAPID_SUBJECT              — e.g. mailto:you@yourdomain.com
//   RESEND_API_KEY, EMAIL_FROM — optional email (same as send-notification-email)
//   APP_URL                    — e.g. https://your-app.vercel.app
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — auto-injected

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

const webhookSecret = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET') ?? ''
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@disc-caddy.app'
const resendKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'Disc Caddy <onboarding@resend.dev>'
const appUrl = Deno.env.get('APP_URL') ?? 'https://thedisccaddy.com'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
}

async function sendEmail(userId: string, title: string, body: string, linkPath: string | null) {
  if (!resendKey) return { skipped: true, reason: 'no RESEND_API_KEY' }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, notify_email')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.email || profile.notify_email === false) {
    return { skipped: true, reason: 'opt-out or no email' }
  }

  const link = linkPath ? `${appUrl}${linkPath}` : appUrl
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [profile.email],
      subject: title,
      text: `${body}\n\nOpen Disc Caddy: ${link}`,
    }),
  })

  if (!res.ok) throw new Error(await res.text())
  return { sent: true }
}

async function sendPush(userId: string, title: string, body: string, linkPath: string | null) {
  if (!vapidPublic || !vapidPrivate) {
    return { skipped: true, reason: 'no VAPID keys' }
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return { skipped: true, reason: 'no subscriptions' }

  const payload = JSON.stringify({
    title,
    body,
    url: linkPath ? `${appUrl}${linkPath}` : appUrl,
  })

  let sent = 0
  const stale: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      )
      sent++
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        stale.push(sub.endpoint)
      } else {
        console.warn('[dispatch-notification] push failed', err?.message ?? err)
      }
    }
  }

  if (stale.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('endpoint', stale)
  }

  return { sent, stale: stale.length }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secretHeader = req.headers.get('x-webhook-secret') ?? ''
    const authHeader = req.headers.get('authorization') ?? ''

    const fromWebhook = webhookSecret && secretHeader === webhookSecret
    const fromClient =
      authHeader.startsWith('Bearer ') &&
      (await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))).data.user

    if (!fromWebhook && !fromClient) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id, title, body, link_path } = await req.json()
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400 })
    }

    const [emailResult, pushResult] = await Promise.allSettled([
      sendEmail(user_id, title, body ?? '', link_path ?? null),
      sendPush(user_id, title, body ?? '', link_path ?? null),
    ])

    return new Response(
      JSON.stringify({
        email: emailResult.status === 'fulfilled' ? emailResult.value : { error: String(emailResult.reason) },
        push: pushResult.status === 'fulfilled' ? pushResult.value : { error: String(pushResult.reason) },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('[dispatch-notification]', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
