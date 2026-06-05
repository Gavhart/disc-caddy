import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppFeatureShowcase } from '../components/AppFeatureShowcase'
import { CaddyDemoPreview } from '../components/CaddyDemoPreview'
import { GreatForList } from '../components/GreatForList'
import { APP_VERSION, PRODUCT_HIGHLIGHTS, RELEASES } from '../data/updates'
import {
  LEAGUE_CORE_FEATURES,
  LEAGUE_ROADMAP_FEATURES,
  leagueFeatureStatusLabel,
} from '../data/leagueFeatures'
import { ROADMAP_ITEMS, RoadmapStatus } from '../data/roadmap'
import { UDISC_PARITY_ROADMAP } from '../data/udiscParityRoadmap'
import { isNativeApp } from '../lib/platform'
import { hasUnreadUpdates, isReleaseUnread, markUpdatesSeen } from '../lib/updates'

/** Strip Venmo entries on iOS to avoid App Review 3.1.1 misreads of
 *  real-world peer payments as in-app paid digital content. */
function filterForNative<T extends { id?: string; title?: string }>(items: T[]): T[] {
  if (!isNativeApp()) return items
  return items.filter(item => {
    const id = (item.id ?? '').toLowerCase()
    const title = (item.title ?? '').toLowerCase()
    return !id.includes('venmo') && !title.includes('venmo')
  })
}

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
      <h3>
        {STATUS_LABELS[status]}
        <span className="updates-roadmap-count">{filtered.length}</span>
      </h3>
      <ul className="updates-roadmap-cards">
        {filtered.map(item => (
          <li key={item.id} className="updates-roadmap-card">
            <strong>{item.title}</strong>
            <p className="muted small">{item.description}</p>
            {item.greatFor && item.greatFor.length > 0 && <GreatForList items={item.greatFor} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LeagueFeatureGrid({
  title,
  features,
}: {
  title: string
  features: typeof LEAGUE_CORE_FEATURES
}) {
  return (
    <div className="updates-league-section">
      <h3>{title}</h3>
      <ul className="updates-league-grid">
        {features.map(f => (
          <li key={f.id} className={`updates-league-card updates-league-${f.status}`}>
            <div className="updates-league-card-head">
              <strong>{f.title}</strong>
              <span className={`updates-league-status updates-league-status-${f.status}`}>
                {leagueFeatureStatusLabel(f.status)}
              </span>
            </div>
            <p className="muted small">{f.summary}</p>
            {f.greatFor && f.greatFor.length > 0 && <GreatForList items={f.greatFor} />}
            {f.href && (
              <Link to={f.href} className="updates-league-link small">
                Open in app →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const PARITY_STATUS_LABELS: Record<RoadmapStatus, string> = {
  shipped: 'Live',
  in_progress: 'Building',
  planned: 'Next',
}

function UdiscParityRoadmap() {
  return (
    <div className="card updates-parity-roadmap">
      <h2>On-course polish</h2>
      <p className="muted small">
        UDisc-inspired upgrades in priority order — visual hole progress, bag stats, faster
        scoring, and league organizer tools — without losing Disc Caddy&apos;s &ldquo;what to
        throw&rdquo; edge.
      </p>
      <ol className="updates-parity-list">
        {UDISC_PARITY_ROADMAP.map((item, index) => (
          <li key={item.id} className={`updates-parity-item updates-parity-${item.status}`}>
            <div className="updates-parity-item-head">
              <span className="updates-parity-rank">{index + 1}</span>
              <strong>{item.title}</strong>
              <span className={`updates-parity-status updates-parity-status-${item.status}`}>
                {PARITY_STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="muted small">{item.description}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function UpdatesPage() {
  const navigate = useNavigate()
  const unread = hasUnreadUpdates()

  const releases = useMemo(() => {
    if (!isNativeApp()) return RELEASES
    // Hide Venmo-titled release entries on iOS, and scrub Venmo bullet points
    // from any other release notes.
    return RELEASES.filter(r => !r.title.toLowerCase().includes('venmo')).map(
      r => ({
        ...r,
        items: r.items.filter(item => !item.toLowerCase().includes('venmo')),
      }),
    )
  }, [])
  const visibleRoadmap = useMemo(() => filterForNative(ROADMAP_ITEMS), [])
  const visibleHighlights = useMemo(() => filterForNative(PRODUCT_HIGHLIGHTS), [])
  const visibleLeagueCore = useMemo(() => filterForNative(LEAGUE_CORE_FEATURES), [])
  const visibleLeagueRoadmap = useMemo(() => filterForNative(LEAGUE_ROADMAP_FEATURES), [])

  const shippedCount = visibleRoadmap.filter(i => i.status === 'shipped').length
  const inProgressCount = visibleRoadmap.filter(i => i.status === 'in_progress').length
  const plannedCount = visibleRoadmap.filter(i => i.status === 'planned').length

  function handleContinue() {
    markUpdatesSeen()
    navigate('/', { replace: true })
  }

  return (
    <div className="container updates-page updates-page-expanded">
      <div className="card updates-hero">
        <div className="updates-hero-badge">
          {unread ? 'New in Disc Caddy' : "What's new"}
        </div>
        <h1>Updates &amp; roadmap</h1>
        <p className="muted">
          Version <strong>{APP_VERSION}</strong>
          {unread
            ? ' — hole map with throw pins, phase picks, and Caddy vs your bag stats just shipped.'
            : " — everything in Disc Caddy today, what's next, and full release history."}
        </p>
        <div className="updates-hero-stats">
          <span>
            <strong>{shippedCount}</strong> shipped
          </span>
          <span>
            <strong>{inProgressCount}</strong> in progress
          </span>
          <span>
            <strong>{plannedCount}</strong> planned
          </span>
        </div>
      </div>

      <div className="card updates-highlights">
        <h2>What&apos;s in Disc Caddy</h2>
        <p className="muted small">
          Seven pillars — from hole-by-hole disc picks and multi-shot progress to full league seasons
          and field practice.
        </p>
        <ul className="updates-highlight-grid">
          {visibleHighlights.map(h => (
            <li key={h.id} className="updates-highlight-card">
              <span className="updates-highlight-icon" aria-hidden>
                {h.icon}
              </span>
              <div>
                <strong>{h.title}</strong>
                <p className="muted small">{h.summary}</p>
                {h.href && (
                  <Link to={h.href} className="updates-highlight-link small">
                    Try it →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <CaddyDemoPreview />
      <AppFeatureShowcase showRoadmapLink={false} />

      <div className="card updates-invite-cta">
        <h2>Share Disc Caddy</h2>
        <p className="muted small">
          The invite page includes this live demo — send it to league mates before league night.
        </p>
        <Link to="/invite" className="btn-secondary">
          Open invite page
        </Link>
      </div>

      <div className="card updates-league-panel">
        <h2>League platform</h2>
        <p className="muted small">
          Everything built for weekly leagues, doubles nights, and club seasons.
        </p>
        <LeagueFeatureGrid title="Core league features" features={visibleLeagueCore} />
        <LeagueFeatureGrid title="League extras" features={visibleLeagueRoadmap} />
      </div>

      <UdiscParityRoadmap />

      <div className="card updates-roadmap">
        <h2>Product roadmap</h2>
        <p className="muted small">
          Shipped features, what we&apos;re building now, and what&apos;s on deck. Updated as plans
          change.
        </p>
        <div className="updates-roadmap-grid">
          <RoadmapColumn status="shipped" items={visibleRoadmap} />
          <RoadmapColumn status="in_progress" items={visibleRoadmap} />
          <RoadmapColumn status="planned" items={visibleRoadmap} />
        </div>
      </div>

      <div className="card">
        <h2>Release notes</h2>
        <p className="muted small">Full version history, newest first.</p>
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
        <Link to="/invite" className="link-button updates-settings-link">
          Invite friends
        </Link>
        <Link to="/settings" className="link-button updates-settings-link">
          Settings
        </Link>
      </div>
    </div>
  )
}
