import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOut } from '../lib/auth'
import { deleteAccount } from '../lib/account'
import { isStripeConfigured, openBillingPortal, PRO_BILLING_COMING_SOON, syncSubscription } from '../lib/subscription'
import { isNativeApp, isWebCheckoutAvailable } from '../lib/platform'
import { ProfileNameEditor } from '../components/ProfileNameEditor'
import { ProfilePhotoUploader } from '../components/ProfilePhotoUploader'
import { setNotifyEmail } from '../lib/notifications'
import { isPushSupported, registerForPushNotifications } from '../lib/pushNotifications'
import { updatePlayer } from '../lib/profile'
import { Hand, ThrowStyle } from '../types'

export function SettingsPage() {
  const { user, me, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [hand, setHand] = useState<Hand>('right')
  const [primary, setPrimary] = useState<ThrowStyle>('backhand')
  const [throwsFH, setThrowsFH] = useState(false)
  const [fhDistance, setFhDistance] = useState<string>('')
  const [putterDistance, setPutterDistance] = useState<string>('')
  const [midDistance, setMidDistance] = useState<string>('')
  const [fairwayDistance, setFairwayDistance] = useState<string>('')
  const [notifyEmail, setNotifyEmailState] = useState(true)
  const [savingNotify, setSavingNotify] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  // After Stripe Checkout redirects here, pull fresh subscription state.
  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return
    setSyncing(true)
    syncSubscription()
      .then(() => refreshMe())
      .catch(err => console.error('[settings] subscription sync failed', err))
      .finally(() => {
        setSyncing(false)
        navigate('/settings', { replace: true })
      })
  }, [searchParams, refreshMe, navigate])

  useEffect(() => {
    if (!me) return
    setHand(me.dominantHand)
    setPrimary(me.primaryThrow)
    // Picking FH as primary implies you throw FH; reflect that in the UI
    // even if the DB has a stale `throws_forehand = false` row from before
    // primary_throw existed.
    setThrowsFH(me.throwsForehand || me.primaryThrow === 'forehand')
    // Only seed inputs when the user has actually customized a value off the
    // default ratio; otherwise leave blank so the placeholder signals
    // "deriving from driver distance".
    const defaults = {
      putter: Math.round(me.maxDistance * 0.5),
      mid: Math.round(me.maxDistance * 0.7),
      fairway: Math.round(me.maxDistance * 0.85),
    }
    setPutterDistance(
      me.putterMaxDistance !== defaults.putter ? String(me.putterMaxDistance) : '',
    )
    setMidDistance(
      me.midrangeMaxDistance !== defaults.mid ? String(me.midrangeMaxDistance) : '',
    )
    setFairwayDistance(
      me.fairwayMaxDistance !== defaults.fairway ? String(me.fairwayMaxDistance) : '',
    )
    setFhDistance(
      me.throwsForehand && me.forehandMaxDistance !== me.maxDistance
        ? String(me.forehandMaxDistance)
        : '',
    )
    setNotifyEmailState(me.notifyEmail)
  }, [me])

  /** Parse one of the optional distance fields; throw with a labeled error. */
  function parseOptionalDistance(raw: string, label: string): number | null {
    if (raw.trim() === '') return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 50 || n > 800) {
      throw new Error(`${label} must be 50–800 ft (or blank to derive from driver).`)
    }
    return n
  }

  async function savePlayer() {
    if (!user) return
    setSavingPlayer(true)
    setPlayerError(null)
    try {
      const putterNum = parseOptionalDistance(putterDistance, 'Putter distance')
      const midNum = parseOptionalDistance(midDistance, 'Midrange distance')
      const fairwayNum = parseOptionalDistance(fairwayDistance, 'Fairway distance')
      const fhNum = parseOptionalDistance(fhDistance, 'Forehand distance')
      // Force throwsForehand on when primary is FH so the stored profile
      // is internally consistent regardless of what the toggle below said.
      const effectiveThrowsFH = primary === 'forehand' ? true : throwsFH
      await updatePlayer(user.id, {
        dominantHand: hand,
        primaryThrow: primary,
        throwsForehand: effectiveThrowsFH,
        forehandMaxDistance: effectiveThrowsFH ? fhNum : null,
        putterMaxDistance: putterNum,
        midrangeMaxDistance: midNum,
        fairwayMaxDistance: fairwayNum,
      })
      await refreshMe()
    } catch (err) {
      setPlayerError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingPlayer(false)
    }
  }

  async function handleEnablePush() {
    setPushBusy(true)
    try {
      const ok = await registerForPushNotifications()
      if (!ok) {
        alert('Could not enable push — check browser permission and VITE_VAPID_PUBLIC_KEY.')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Push setup failed')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleNotifyEmailToggle(enabled: boolean) {
    setSavingNotify(true)
    try {
      await setNotifyEmail(enabled)
      setNotifyEmailState(enabled)
      await refreshMe()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save notification setting')
    } finally {
      setSavingNotify(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Delete your Disc Caddy account permanently? This removes your bags, rounds, and profile. This cannot be undone.',
    )
    if (!confirmed) return
    setDeletingAccount(true)
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete account')
    } finally {
      setDeletingAccount(false)
    }
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

  async function handleSyncSubscription() {
    setSyncing(true)
    try {
      await syncSubscription()
      await refreshMe()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not sync subscription')
    } finally {
      setSyncing(false)
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
    <div className="container settings-page">
      <p className="settings-back">
        <Link to="/profile">← Back to profile</Link>
      </p>
      <div className="card settings-section" id="account">
        <h2>Account</h2>
        <div className="settings-account-photo">
          <ProfilePhotoUploader
            avatarPath={me.avatarPath}
            displayName={me.displayName}
            onChange={async () => {
              await refreshMe()
            }}
          />
        </div>
        <ProfileNameEditor />
        <div className="setting-row">
          <span className="setting-label">Email</span>
          <span className="setting-value">{me.email}</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Max distance</span>
          <span className="setting-value">
            {me.maxDistance} ft <span className="muted small">(edit on Recommend page)</span>
          </span>
        </div>
      </div>

      <div className="card settings-section" id="player">
        <h2>Player</h2>
        <p className="muted small">
          The recommender uses these to choose between backhand and forehand,
          to mirror disc behavior for left-handed players, and to scale
          expected distance by disc type.
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
          <span className="setting-label">Primary throw</span>
          <div className="segmented">
            <button
              type="button"
              className={primary === 'backhand' ? 'segmented-on' : ''}
              onClick={() => setPrimary('backhand')}
            >
              Backhand
            </button>
            <button
              type="button"
              className={primary === 'forehand' ? 'segmented-on' : ''}
              onClick={() => {
                setPrimary('forehand')
                setThrowsFH(true)
              }}
            >
              Forehand
            </button>
          </div>
        </div>
        <p className="muted small">
          Your preferred release. When two picks score close, the recommender
          breaks ties in this style's favor.
        </p>

        <h3 className="settings-subheading">Backhand distances</h3>
        <p className="muted small">
          Your max with each disc class. Driver lives on the Recommend page;
          others fall back to a fraction of driver until you set them.
        </p>
        <div className="setting-row">
          <label className="setting-label" htmlFor="bh-driver">
            Driver
          </label>
          <span>
            {me.maxDistance} ft <span className="muted small">(edit on Recommend page)</span>
          </span>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="bh-fairway">
            Fairway driver
          </label>
          <div className="input-group" style={{ width: 'auto' }}>
            <input
              id="bh-fairway"
              type="number"
              min={50}
              max={800}
              step={5}
              value={fairwayDistance}
              placeholder={`${Math.round(me.maxDistance * 0.85)} (derived)`}
              onChange={e => setFairwayDistance(e.target.value)}
              style={{ width: 160 }}
            />
            <span className="suffix">ft</span>
          </div>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="bh-mid">
            Midrange
          </label>
          <div className="input-group" style={{ width: 'auto' }}>
            <input
              id="bh-mid"
              type="number"
              min={50}
              max={800}
              step={5}
              value={midDistance}
              placeholder={`${Math.round(me.maxDistance * 0.7)} (derived)`}
              onChange={e => setMidDistance(e.target.value)}
              style={{ width: 160 }}
            />
            <span className="suffix">ft</span>
          </div>
        </div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="bh-putter">
            Putter
          </label>
          <div className="input-group" style={{ width: 'auto' }}>
            <input
              id="bh-putter"
              type="number"
              min={50}
              max={800}
              step={5}
              value={putterDistance}
              placeholder={`${Math.round(me.maxDistance * 0.5)} (derived)`}
              onChange={e => setPutterDistance(e.target.value)}
              style={{ width: 160 }}
            />
            <span className="suffix">ft</span>
          </div>
        </div>

        <h3 className="settings-subheading">Forehand</h3>
        {primary === 'forehand' ? (
          <p className="muted small">
            Forehand is enabled because it's set as your primary throw.
          </p>
        ) : (
          <div className="setting-row">
            <label className="setting-label" htmlFor="fh-toggle">
              I also throw forehand
            </label>
            <input
              id="fh-toggle"
              type="checkbox"
              checked={throwsFH}
              onChange={e => setThrowsFH(e.target.checked)}
            />
          </div>
        )}
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
                style={{ width: 160 }}
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

      <div className="card settings-section" id="notifications">
        <h2>Notifications</h2>
        <p className="muted small">
          In-app alerts always show on Recommend when someone invites you to a
          scorecard or sends a Community message. Optional email for the same
          events.
        </p>
        <div className="setting-row">
          <label className="setting-label" htmlFor="notify-email">
            Email me for scorecard invites and messages
          </label>
          <input
            id="notify-email"
            type="checkbox"
            checked={notifyEmail}
            disabled={savingNotify}
            onChange={e => handleNotifyEmailToggle(e.target.checked)}
          />
        </div>
        {isPushSupported() && (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={pushBusy}
              onClick={handleEnablePush}
              style={{ marginTop: 10 }}
            >
              {pushBusy ? 'Enabling…' : 'Enable browser push notifications'}
            </button>
            {!import.meta.env.VITE_VAPID_PUBLIC_KEY && (
              <p className="muted small" style={{ marginTop: 8 }}>
                Push requires <code>VITE_VAPID_PUBLIC_KEY</code> in Vercel and VAPID
                keys on the <code>dispatch-notification</code> edge function. Run{' '}
                <code>node scripts/generate-vapid.mjs</code> to generate a key pair.
              </p>
            )}
          </>
        )}
      </div>

      <div className="card settings-section" id="subscription">
        <h2>Subscription</h2>
        {isNativeApp() && (
          <p className="muted small native-billing-note">
            Subscriptions are managed on the Disc Caddy website. Pro status
            syncs to this app when you're signed in.
          </p>
        )}
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
          isStripeConfigured &&
          isWebCheckoutAvailable() && (
            <button
              className="btn-secondary"
              onClick={handleBilling}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Manage billing'}
            </button>
          )
        ) : (
          <>
            {PRO_BILLING_COMING_SOON && (
              <p className="muted small">
                Pro checkout is being set up — see the{' '}
                <Link to="/upgrade">Upgrade page</Link> for plan details. Billing
                will be available shortly.
              </p>
            )}
            {isWebCheckoutAvailable() && !PRO_BILLING_COMING_SOON && (
              <Link to="/upgrade" className="btn-primary">
                Upgrade to Pro
              </Link>
            )}
            {isStripeConfigured && isWebCheckoutAvailable() && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSyncSubscription}
                disabled={syncing}
                style={{ marginTop: 10 }}
              >
                {syncing ? 'Syncing…' : 'Already subscribed? Sync status'}
              </button>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Legal</h2>
        <div className="legal-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
        </div>
      </div>

      <div className="card">
        <h2>About</h2>
        <p className="muted small">
          Release notes and a peek at what's coming next.
        </p>
        <Link to="/updates" className="btn-secondary">
          What's new &amp; roadmap
        </Link>
      </div>

      <div className="card">
        <h2>Session</h2>
        <button className="btn-secondary" onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      <div className="card card-danger">
        <h2>Delete account</h2>
        <p className="muted small">
          Permanently delete your account and all data. Required for App Store
          compliance — this action cannot be undone.
        </p>
        <button
          type="button"
          className="btn-danger"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  )
}
