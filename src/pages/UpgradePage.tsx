import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  type BillingInterval,
  isAnnualBillingAvailable,
  isMonthlyBillingAvailable,
  isStripeConfigured,
  PRO_BILLING_COMING_SOON,
  PRO_PRICING,
  startCheckout,
} from '../lib/subscription'
import { isNativeApp, isWebCheckoutAvailable } from '../lib/platform'

const FEATURES_FREE = [
  '1 bag',
  'Unlimited discs',
  'Disc photos',
  'Full recommendation engine with detailed explanations',
  'Course stepper + manual hole input',
  'Live wind from your location (override anytime)',
  'Browse Community — find nearby players',
]

const FEATURES_PRO = [
  'Everything in Free',
  'Unlimited bags',
  'Message players on Community',
  'Live round mode — log throws hole-by-hole',
  'Hole memory — “Last time you played this hole, you threw a Buzzz and parred. Recommended again.”',
  'Sync across devices',
  'Support the indie dev (you)',
]

function defaultBillingInterval(): BillingInterval {
  if (isAnnualBillingAvailable) return 'annual'
  return 'monthly'
}

export function UpgradePage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    defaultBillingInterval,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPro = me?.isPro ?? false
  const showBillingToggle =
    isMonthlyBillingAvailable && isAnnualBillingAvailable
  const selectedPricing = PRO_PRICING[billingInterval]

  async function handleUpgrade() {
    setBusy(true)
    setError(null)
    try {
      await startCheckout(billingInterval)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout')
      setBusy(false)
    }
  }

  if (isPro) {
    return (
      <div className="container">
        <div className="card">
          <h2>You're already Pro ✨</h2>
          <p className="muted">Manage your subscription on the Settings page.</p>
          <button
            className="btn-secondary"
            onClick={() => navigate('/settings')}
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Upgrade to Pro</h2>
        <p className="muted">
          The core recommendation engine stays free forever. Pro unlocks the
          power-user features below.
        </p>

        {PRO_BILLING_COMING_SOON && (
          <div className="upgrade-status-notice">
            <strong>Pro checkout coming shortly</strong>
            <p className="muted small">
              I&apos;m working on getting the Pro plan and billing fully wired
              up. The plan details below are accurate, but upgrading isn&apos;t
              available yet — this page will be updated shortly.
            </p>
          </div>
        )}

        {isNativeApp() && (
          <p className="muted small native-billing-note">
            Pro subscriptions aren't sold inside the mobile app. If you have an
            active Pro subscription, your Pro features sync here automatically
            when you're signed in.
          </p>
        )}

        <div className="plans">
          <div className="plan">
            <h3>Free</h3>
            <div className="plan-price">
              $0 <span className="muted small">/ month</span>
            </div>
            <ul className="plan-features">
              {FEATURES_FREE.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="plan-cta muted small">Your current plan</div>
          </div>

          <div className="plan plan-pro">
            <h3>Pro</h3>

            {showBillingToggle && (
              <div
                className="billing-toggle"
                role="group"
                aria-label="Billing interval"
              >
                <button
                  type="button"
                  className={
                    'billing-toggle-btn' +
                    (billingInterval === 'monthly' ? ' billing-toggle-active' : '')
                  }
                  onClick={() => setBillingInterval('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={
                    'billing-toggle-btn' +
                    (billingInterval === 'annual' ? ' billing-toggle-active' : '')
                  }
                  onClick={() => setBillingInterval('annual')}
                >
                  Yearly
                  <span className="billing-toggle-save">
                    Save {PRO_PRICING.annual.savingsPercent}%
                  </span>
                </button>
              </div>
            )}

            <div className="plan-price">
              ${selectedPricing.amount.toFixed(2)}{' '}
              <span className="muted small">/ {selectedPricing.periodLabel}</span>
            </div>

            {billingInterval === 'annual' && (
              <p className="plan-price-note muted small">
                About ${PRO_PRICING.annual.equivalentMonthly.toFixed(2)}/mo billed
                once a year — save vs paying monthly.
              </p>
            )}

            <ul className="plan-features">
              {FEATURES_PRO.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            {PRO_BILLING_COMING_SOON ? (
              <p className="muted small plan-cta">
                Pro checkout isn&apos;t live yet — check back soon.
              </p>
            ) : isStripeConfigured && isWebCheckoutAvailable() ? (
              <button
                className="btn-primary"
                onClick={handleUpgrade}
                disabled={busy}
              >
                {busy
                  ? 'Redirecting…'
                  : `Upgrade — ${selectedPricing.checkoutLabel}`}
              </button>
            ) : isNativeApp() ? (
              <p className="muted small plan-cta">
                Not available in the mobile app.
              </p>
            ) : (
              <button className="btn-primary" disabled title="Stripe not configured">
                Coming soon
              </button>
            )}
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>

        {!PRO_BILLING_COMING_SOON && !isStripeConfigured && (
          <p className="muted small">
            Stripe isn&apos;t wired up yet — see the README to set up payments when
            you&apos;re ready to charge.
          </p>
        )}
      </div>
    </div>
  )
}
