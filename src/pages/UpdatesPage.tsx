import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_VERSION, RELEASES } from '../data/updates'
import { ROADMAP_ITEMS, RoadmapStatus } from '../data/roadmap'
import { hasUnreadUpdates, isReleaseUnread, markUpdatesSeen } from '../lib/updates'

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  shipped: 'Shipped',
  in_progress: 'In progress',
  planned: 'Coming soon',
}

function RoadmapColumn({ status, items }: { status: RoadmapStatus; items: typeof ROADMAP_ITEMS }) {
  const filtered = items.filter(i => i.status === status)
  if (filtered.length === 0) return null

  return (
    <div className={`updates-roadmap-column updates-roadmap-${status}`}>
      <h3>{STATUS_LABELS[status]}</h3>
      <ul className="updates-roadmap-cards">
        {filtered.map(item => (
          <li key={item.id} className="updates-roadmap-card">
            <strong>{item.title}</strong>
            <p className="muted small">{item.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
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
            ? ' — here\'s what we shipped recently and what\'s coming next.'
            : " — you're on the latest release. See what's new below and what's planned."}
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
        <h2>Product roadmap</h2>
        <p className="muted small">
          Shipped features, what we&apos;re building now, and what&apos;s on deck. Updated as plans
          change.
        </p>
        <div className="updates-roadmap-grid">
          <RoadmapColumn status="shipped" items={ROADMAP_ITEMS} />
          <RoadmapColumn status="in_progress" items={ROADMAP_ITEMS} />
          <RoadmapColumn status="planned" items={ROADMAP_ITEMS} />
        </div>
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
