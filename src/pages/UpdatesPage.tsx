import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_VERSION, RELEASES, ROADMAP } from '../data/updates'
import { hasUnreadUpdates, isReleaseUnread, markUpdatesSeen } from '../lib/updates'

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function UpdatesPage() {
  const navigate = useNavigate()
  const unread = hasUnreadUpdates()

  const releases = useMemo(() => RELEASES, [])

  function handleContinue() {
    markUpdatesSeen()
    navigate('/', { replace: true })
  }

  return (
    <div className="container updates-page">
      <div className="card updates-hero">
        <div className="updates-hero-badge">
          {unread ? 'New in Disc Caddy' : "What's new"}
        </div>
        <h1>Updates &amp; roadmap</h1>
        <p className="muted">
          Version <strong>{APP_VERSION}</strong>
          {unread
            ? " — here's what changed since you last signed in."
            : " — you're on the latest release."}
        </p>
      </div>

      <div className="card">
        <h2>Release notes</h2>
        <div className="updates-list">
          {releases.map(release => {
            const isNew = isReleaseUnread(release.version)
            return (
              <article
                key={release.version}
                className={`updates-release ${isNew ? 'updates-release-new' : ''}`}
              >
                <div className="updates-release-header">
                  <div>
                    <div className="updates-release-title">{release.title}</div>
                    <div className="muted small">
                      v{release.version} · {formatDate(release.date)}
                    </div>
                  </div>
                  {isNew && <span className="pill small">New</span>}
                </div>
                <ul className="updates-items">
                  {release.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </div>

      <div className="card updates-roadmap">
        <h2>Coming soon</h2>
        <p className="muted small">
          A peek at what we're building next. This list updates as plans firm up.
        </p>
        <ul className="updates-roadmap-list">
          {ROADMAP.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="updates-actions">
        {unread ? (
          <button type="button" className="btn-primary" onClick={handleContinue}>
            Continue to Disc Caddy
          </button>
        ) : (
          <Link to="/" className="btn-primary updates-back-btn">
            Back to app
          </Link>
        )}
        <Link to="/settings" className="link-button updates-settings-link">
          Settings
        </Link>
      </div>
    </div>
  )
}
