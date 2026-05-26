import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signUp } from '../lib/auth'
import { captureInviteRefFromSearch } from '../lib/invite'
import { Logo } from '../components/Logo'
import {
  DEFAULT_PROFILE_FIELDS,
  ProfileFieldsValue,
  SignupProfileFields,
} from '../components/SignupProfileFields'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<ProfileFieldsValue>(DEFAULT_PROFILE_FIELDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    captureInviteRefFromSearch(searchParams.toString())
  }, [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
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
      const { session } = await signUp(email, password, {
        displayName: profile.displayName,
        maxDistance: profile.maxDistance,
        dominantHand: profile.dominantHand,
        primaryThrow: profile.primaryThrow,
      })
      if (session) {
        navigate('/', { replace: true })
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <Logo height={80} />
          </div>
          <h2>Check your email</h2>
          <p>
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            finish setting up your account.
          </p>
          <Link to="/login" className="btn-primary">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <Logo height={80} />
        </div>
        <h2>Create your account</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <SignupProfileFields value={profile} onChange={setProfile} />

          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-links">
          <span className="muted">Already have one?</span>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
