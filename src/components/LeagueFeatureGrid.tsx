import { Link } from 'react-router-dom'
import {
  LEAGUE_CORE_FEATURES,
  LEAGUE_ROADMAP_FEATURES,
  leagueFeatureStatusLabel,
  type LeagueFeature,
} from '../data/leagueFeatures'

function FeatureRow({ feature }: { feature: LeagueFeature }) {
  const body = (
    <>
      <div className="league-feature-row-top">
        <strong>{feature.title}</strong>
        <span className={'league-feature-status league-feature-status-' + feature.status}>
          {leagueFeatureStatusLabel(feature.status)}
        </span>
      </div>
      <p className="muted small league-feature-summary">{feature.summary}</p>
    </>
  )

  if (feature.href && feature.status !== 'planned') {
    return (
      <Link to={feature.href} className="league-feature-row league-feature-row-link">
        {body}
        <span className="league-feature-open muted small">Open →</span>
      </Link>
    )
  }

  return <div className="league-feature-row">{body}</div>
}

export function LeagueFeatureGrid() {
  return (
    <div className="league-feature-grid-wrap">
      <section className="league-feature-section">
        <h3>League platform</h3>
        <p className="muted small">
          What Disc Caddy leagues support today — and what is actively being built next.
        </p>
        <ul className="league-feature-list">
          {LEAGUE_CORE_FEATURES.map(f => (
            <li key={f.id}>
              <FeatureRow feature={f} />
            </li>
          ))}
        </ul>
      </section>

      <section className="league-feature-section">
        <h3>Coming improvements</h3>
        <p className="muted small">
          Social, discovery, handicaps, clubs, payouts, and deeper analytics on the roadmap.
        </p>
        <ul className="league-feature-list">
          {LEAGUE_ROADMAP_FEATURES.map(f => (
            <li key={f.id}>
              <FeatureRow feature={f} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
