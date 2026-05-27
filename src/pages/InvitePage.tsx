import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from '../components/Logo'
import {
  captureInviteRefFromSearch,
  getAppBaseUrl,
  invitePageUrl,
  signupInviteUrl,
} from '../lib/invite'

export function InvitePage() {
  const { me, session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refFromUrl = searchParams.get('ref')
  const ref = refFromUrl ?? (me?.id ? me.id.slice(0, 8) : null)

  const inviteLink = useMemo(() => invitePageUrl(ref), [ref])
  const signupLink = useMemo(() => signupInviteUrl(ref), [ref])
  const isPersonalShare = session && !refFromUrl

  useEffect(() => {
    captureInviteRefFromSearch(searchParams.toString())
  }, [searchParams])

  useEffect(() => {
    QRCode.toDataURL(inviteLink, {
      width: 320,
      margin: 2,
      color: { dark: '#0f1f14', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [inviteLink])

  function goBack() {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
      return
    }
    navigate(session ? '/profile' : '/login')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the readonly input
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'disc-caddy-invite-qr.png'
    a.click()
  }

  const inviterLabel = me?.displayName?.trim() || null

  return (
    <div className="container invite-page">
      <nav className="invite-nav" aria-label="Invite page">
        <button type="button" className="page-back link-button" onClick={goBack}>
          ← {session ? 'Back' : 'Sign in'}
        </button>
      </nav>
      <header className="invite-header">
        <Logo height={48} />
        <h1>Join Disc Caddy</h1>
        <p className="muted invite-tagline">
          Disc recommendations, live scorecards, and players near you — free to start.
        </p>
      </header>

      <div className="card invite-card">
        {isPersonalShare && inviterLabel && (
          <p className="invite-from muted small">
            Your personal invite link — friends who sign up from this link are tracked to you.
          </p>
        )}
        {!session && refFromUrl && (
          <p className="invite-from">
            You&apos;ve been invited to try <strong>Disc Caddy</strong>
          </p>
        )}

        {qrDataUrl && (
          <div className="invite-qr-wrap">
            <img
              src={qrDataUrl}
              alt="QR code to open Disc Caddy invite link"
              className="invite-qr"
              width={320}
              height={320}
            />
          </div>
        )}

        <p className="muted small invite-scan-hint">Scan to open this invite link</p>

        <label className="invite-link-field">
          <span className="muted small">Invite link</span>
          <input type="text" readOnly value={inviteLink} className="invite-link-input" />
        </label>

        <div className="invite-actions">
          <button type="button" className="btn-primary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
          {qrDataUrl && (
            <button type="button" className="btn-secondary" onClick={downloadQr}>
              Download QR image
            </button>
          )}
        </div>

        {!session && (
          <Link to={signupLink} className="btn-primary invite-signup-btn">
            Create free account
          </Link>
        )}

        {session && (
          <p className="muted small invite-signed-in">
            You&apos;re signed in. Share the link or QR above with friends at the course.
          </p>
        )}
      </div>

      <ul className="invite-features muted small">
        <li>Smart disc picks for every hole</li>
        <li>Live group scorecards with friends</li>
        <li>Find players in your area on Community</li>
      </ul>

      <p className="muted small invite-footer">
        {getAppBaseUrl().replace(/^https?:\/\//, '')}
        {' · '}
        <Link to="/privacy">Privacy</Link>
        {' · '}
        <Link to="/terms">Terms</Link>
      </p>
    </div>
  )
}
