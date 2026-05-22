import { FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { completeOnboarding } from '../lib/profile'
import { Logo } from '../components/Logo'
import {
  DEFAULT_PROFILE_FIELDS,
  ProfileFieldsValue,
  SignupProfileFields,
} from '../components/SignupProfileFields'

export function WelcomePage() {
  const { user, me, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileFieldsValue>(DEFAULT_PROFILE_FIELDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!me) return
    setProfile({
      displayName: me.displayName ?? '',
      maxDistance: me.maxDistance,
      dominantHand: me.dominantHand,
      primaryThrow: me.primaryThrow,
    })
  }, [me])

  if (me?.onboardingComplete) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (profile.displayName.trim().length < 2) {
      setError('Please enter a display name (at least 2 characters).')
      return
    }
    if (profile.maxDistance < 100 || profile.maxDistance > 700) {
      setError('Max distance must be between 100 and 700 ft.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await completeOnboarding(user.id, {
        displayName: profile.displayName,
        maxDistance: profile.maxDistance,
        dominantHand: profile.dominantHand,
        primaryThrow: profile.primaryThrow,
      })
      await refreshMe()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <Logo height={80} />
        </div>
        <h2>Welcome to Disc Caddy</h2>
        <p className="muted small auth-intro">
          Tell us a bit about your game so recommendations are tuned for you
          from the first throw.
        </p>
        <form onSubmit={handleSubmit}>
          <SignupProfileFields
            idPrefix="welcome"
            value={profile}
            onChange={setProfile}
          />
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Start recommending'}
          </button>
        </form>
      </div>
    </div>
  )
}
