import { supabase } from './supabase'
import { isWebCheckoutAvailable } from './platform'

/** Display pricing — actual charge comes from Stripe price IDs in env. */
export const PRO_PRICING = {
  monthly: {
    amount: 2.99,
    periodLabel: 'month',
    checkoutLabel: '$2.99 / mo',
  },
  annual: {
    amount: 24.99,
    periodLabel: 'year',
    checkoutLabel: '$24.99 / yr',
    /** vs paying monthly for 12 months ($35.88). */
    savingsPercent: 30,
    equivalentMonthly: 2.08,
  },
} as const

export type BillingInterval = keyof typeof PRO_PRICING

const MONTHLY_PRICE_ID =
  import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY ??
  import.meta.env.VITE_STRIPE_PRICE_ID

const ANNUAL_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_ANNUAL

export function getStripePriceId(interval: BillingInterval): string | undefined {
  return interval === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID
}

export const isMonthlyBillingAvailable = Boolean(MONTHLY_PRICE_ID)
export const isAnnualBillingAvailable = Boolean(ANNUAL_PRICE_ID)
export const isStripeConfigured =
  isMonthlyBillingAvailable || isAnnualBillingAvailable

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
export async function startCheckout(
  interval: BillingInterval = 'annual',
): Promise<void> {
  if (PRO_BILLING_COMING_SOON) {
    throw new Error('Pro checkout is not available yet — check back shortly.')
  }
  if (!isWebCheckoutAvailable()) {
    throw new Error('Pro subscriptions are not available in this app.')
  }

  const priceId = getStripePriceId(interval)
  if (!priceId) {
    throw new Error(
      interval === 'annual'
        ? 'Annual billing is not configured yet.'
        : 'Monthly billing is not configured yet.',
    )
  }

  const { data, error } = await supabase.functions.invoke(
    'create-checkout-session',
    {
      body: {
        price_id: priceId,
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
    throw new Error('Billing is not managed in this app.')
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
