import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'
import { isStripeConfigured, openBillingPortal } from '../lib/subscription'
import { updatePlayer } from '../lib/profile'
import { Hand } from '../types'

export function SettingsPage() {
  const { user, me, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [hand, setHand] = useState<Hand>('right')
  const [throwsFH, setThrowsFH] = useState(false)
  const [fhDistance, setFhDistance] = useState<string>('')

  useEffect(() => {
    if (!me) return
    setHand(me.dominantHand)
    setThrowsFH(me.throwsForehand)
    // Only seed the input when the user has actually set a forehand distance
    // distinct from max distance; otherwise leave blank so the placeholder
    // signals "falls back to max distance".
    setFhDistance(
      me.throwsForehand && me.forehandMaxDistance !== me.maxDistance
        ? String(me.forehandMaxDistance)
        : '',
    )
  }, [me])

  async function savePlayer() {
    if (!user) return
    setSavingPlayer(true)
    setPlayerError(null)
    try {
      const fhNum = fhDistance.trim() === '' ? null : Number(fhDistance)
      if (fhNum !== null && (!Number.isFinite(fhNum) || fhNum < 50 || fhNum > 800)) {
        throw new Error('Forehand distance must be 50–800 ft (or blank to mirror max).')
      }
      await updatePlayer(user.id, {
        dominantHand: hand,
        throwsForehand: throwsFH,
        forehandMaxDistance: throwsFH ? fhNum : null,
      })
      await refreshMe()
    } catch (err) {
      setPlayerError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingPlayer(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleBilling() {
    setBusy(true)
    try {
      await openBillingPortal()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open billing portal')
    } finally {
      setBusy(false)
    }
  }

  if (!me) {
    return (
      <div className="container">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Account</h2>
        <div className="setting-row">
          <span className="setting-label">Email</span>
          <span>{me.email}</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Max distance</span>
          <span>
            {me.maxDistance} ft <span className="muted small">(edit on Recommend page)</span>
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Player</h2>
        <p className="muted small">
          The recommender uses these to choose between backhand and forehand,
          and to mirror disc behavior for left-handed players.
        </p>
        <div className="setting-row">
          <span className="setting-label">Dominant hand</span>
          <div className="segmented">
            <button
              type="button"
              className={hand === 'right' ? 'segmented-on' : ''}
              onClick={() => setHand('right')}
            >
              Right
            </button>
            <button
              type="button"
              className={hand === 'left' ? 'segmented-on' : ''}
              onClick={() => setHand('left')}
            >
              Left
            </button>
          </div>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="fh-toggle">
            I throw forehand
          </label>
          <input
            id="fh-toggle"
            type="checkbox"
            checked={throwsFH}
            onChange={e => setThrowsFH(e.target.checked)}
          />
        </div>
        {throwsFH && (
          <div className="setting-row">
            <label className="setting-label" htmlFor="fh-distance">
              Forehand max distance
            </label>
            <div className="input-group" style={{ width: 'auto' }}>
              <input
                id="fh-distance"
                type="number"
                min={50}
                max={800}
                step={10}
                value={fhDistance}
                placeholder={`${me.maxDistance} (same as BH)`}
                onChange={e => setFhDistance(e.target.value)}
                style={{ width: 140 }}
              />
              <span className="suffix">ft</span>
            </div>
          </div>
        )}
        {playerError && <div className="form-error">{playerError}</div>}
        <button
          type="button"
          className="btn-secondary"
          onClick={savePlayer}
          disabled={savingPlayer}
        >
          {savingPlayer ? 'Saving…' : 'Save player settings'}
        </button>
      </div>

      <div className="card">
        <h2>Subscription</h2>
        <div className="setting-row">
          <span className="setting-label">Plan</span>
          <span>
            {me.isPro ? (
              <span className="pill pill-pro">Pro</span>
            ) : (
              <span className="pill">Free</span>
            )}
          </span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Status</span>
          <span>{me.subscriptionStatus}</span>
        </div>
        {me.subscriptionPeriodEnd && (
          <div className="setting-row">
            <span className="setting-label">
              {me.subscriptionStatus === 'canceled' ? 'Ends' : 'Renews'}
            </span>
            <span>
              {new Date(me.subscriptionPeriodEnd).toLocaleDateString()}
            </span>
          </div>
        )}
        {me.isPro ? (
          isStripeConfigured && (
            <button
              className="btn-secondary"
              onClick={handleBilling}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Manage billing'}
            </button>
          )
        ) : (
          <Link to="/upgrade" className="btn-primary">
            Upgrade to Pro
          </Link>
        )}
      </div>

      <div className="card">
        <h2>Session</h2>
        <button className="btn-secondary" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
