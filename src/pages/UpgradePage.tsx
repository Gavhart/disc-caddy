import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isStripeConfigured, startCheckout } from '../lib/subscription'

const FEATURES_FREE = [
  '1 bag',
  'Unlimited discs',
  'Disc photos',
  'Full recommendation engine with detailed explanations',
  'Course stepper + manual hole input',
]

const FEATURES_PRO = [
  'Unlimited bags',
  'Live wind auto-fill at the course',
  'Live round mode — log throws hole-by-hole',
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
          power-user features.
        </p>

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
            {isStripeConfigured ? (
              <button
                className="btn-primary"
                onClick={handleUpgrade}
                disabled={busy}
              >
                {busy ? 'Redirecting…' : 'Upgrade — $4.99 / mo'}
              </button>
            ) : (
              <button className="btn-primary" disabled title="Stripe not configured">
                Coming soon
              </button>
            )}
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>

        {!isStripeConfigured && (
          <p className="muted small">
            Stripe isn't wired up yet — see the README to set up payments when
            you're ready to charge.
          </p>
        )}
      </div>
    </div>
  )
}
