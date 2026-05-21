import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '../lib/auth'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { session } = await signUp(email, password)
      if (session) {
        // Auto-signed-in (no email confirmation required in this Supabase project).
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
          <h1 className="brand">Disc Caddy</h1>
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
      <div className="auth-card">
        <h1 className="brand">Disc Caddy</h1>
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
