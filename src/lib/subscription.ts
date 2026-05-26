import { supabase } from './supabase'
import { isWebCheckoutAvailable } from './platform'

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID

export const isStripeConfigured = Boolean(STRIPE_PRICE_ID)

/** Flip to false when Stripe checkout is live. */
export const PRO_BILLING_COMING_SOON = false

/**
 * Free tier limits. Enforced in UI; server-side enforcement happens via
 * a `before insert` trigger on the bags table (add this later if needed).
 */
export const FREE_TIER = {
  maxBags: 1,
  photoUploadEnabled: true,
} as const

/**
 * Starts a Stripe Checkout session. The Edge Function lives at
 * supabase/functions/create-checkout-session and returns { url }.
 */
export async function startCheckout(): Promise<void> {
  if (PRO_BILLING_COMING_SOON) {
    throw new Error('Pro checkout is not available yet — check back shortly.')
  }
  if (!isWebCheckoutAvailable()) {
    throw new Error('Pro subscriptions are managed on the Disc Caddy website.')
  }
  if (!isStripeConfigured) {
    throw new Error('Stripe is not configured yet. See README setup.')
  }

  const { data, error } = await supabase.functions.invoke(
    'create-checkout-session',
    {
      body: {
        price_id: STRIPE_PRICE_ID,
        success_url: `${window.location.origin}/settings?upgraded=1`,
        cancel_url: `${window.location.origin}/upgrade`,
      },
    },
  )

  if (error) throw error
  if (!data?.url) throw new Error('No checkout URL returned')
  window.location.href = data.url
}

/**
 * Opens the Stripe Billing Portal so the user can cancel / update payment method.
 * The Edge Function lives at supabase/functions/create-portal-session.
 */
export async function openBillingPortal(): Promise<void> {
  if (!isWebCheckoutAvailable()) {
    throw new Error('Billing is managed on the Disc Caddy website.')
  }
  const { data, error } = await supabase.functions.invoke(
    'create-portal-session',
    {
      body: {
        return_url: `${window.location.origin}/settings`,
      },
    },
  )
  if (error) throw error
  if (!data?.url) throw new Error('No portal URL returned')
  window.location.href = data.url
}

/** Pull subscription state from Stripe into the profile (webhook recovery). */
export async function syncSubscription(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('sync-subscription')
  if (error) throw error
  if (data?.error) throw new Error(String(data.error))
}
