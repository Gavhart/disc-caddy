import { FormEvent, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signIn, sendPasswordReset } from '../lib/auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!email) {
      setError('Enter your email above first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendPasswordReset(email)
      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="brand">Disc Caddy</h1>
        <h2>Welcome back</h2>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <div className="form-error">{error}</div>}
          {resetSent && (
            <div className="form-success">
              Password reset email sent. Check your inbox.
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-links">
          <button
            type="button"
            className="link-button"
            onClick={handleReset}
            disabled={busy}
          >
            Forgot password?
          </button>
          <span className="muted">·</span>
          <Link to="/signup">Create account</Link>
        </div>
      </div>
    </div>
  )
}
