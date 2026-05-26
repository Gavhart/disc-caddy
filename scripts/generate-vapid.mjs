#!/usr/bin/env node
/**
 * Generate a VAPID key pair for web push notifications.
 *
 * Usage: node scripts/generate-vapid.mjs
 *
 * Add the public key to Vercel as VITE_VAPID_PUBLIC_KEY
 * Add both keys to Supabase Edge Function secrets for dispatch-notification:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:you@domain.com
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('Add to Vercel (.env.local / project env):')
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log('')
console.log('Add to Supabase Edge Function secrets (dispatch-notification):')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:you@yourdomain.com')
console.log('')
console.log('After migration 026, also set app_config in Supabase SQL Editor:')
console.log('  dispatch_notification_url -> https://YOUR_PROJECT.supabase.co/functions/v1/dispatch-notification')
console.log('  notification_webhook_secret -> (random string, same as NOTIFICATION_WEBHOOK_SECRET on edge fn)')
