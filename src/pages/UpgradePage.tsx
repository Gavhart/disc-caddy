import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isStripeConfigured, PRO_BILLING_COMING_SOON, startCheckout } from '../lib/subscription'
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

export function UpgradePage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPro = me?.isPro ?? false

  async function handleUpgrade() {
    setBusy(true)
    setError(null)
    try {
      await startCheckout()
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
            Pro subscriptions aren't sold inside the mobile app. If you
            subscribed on the web, your Pro features sync here automatically
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
            <div className="plan-price">
              $4.99 <span className="muted small">/ month</span>
            </div>
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
                {busy ? 'Redirecting…' : 'Upgrade — $4.99 / mo'}
              </button>
            ) : isNativeApp() ? (
              <p className="muted small plan-cta">
                Available on the Disc Caddy website
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
            Stripe isn't wired up yet — see the README to set up payments when
            you're ready to charge.
          </p>
        )}
      </div>
    </div>
  )
}
